import type { Content, GameState, Position } from '../domain/schemas';
import { damageHero } from './damage';
import { CELL_CAPACITY, doorBetween, edgeBlocked, hasLineOfSight, isClose, key, neighbors, occupancy, samePos, sightBlockedAt } from '../movement/board';
import type { PathStep } from '../movement/plan';
import { createOracle, type InputAnswer } from '../oracle';
import { CountingRandom } from '../random';
import { blockedByOtherHero, cloneState, log } from '../state';
import type { PhysicalInstruction } from '../activation/monsterTurn';
import { monsterAttacksHero, type ActionResult } from './heroActions';

export const HERO_MOVEMENT = 3;

/** Du point de vue d'un héros : ennemis = monstres, alliés = autres héros et familiers. */
function heroView(s: GameState, p: Position, heroId: string) {
  const o = occupancy(s, p, heroId);
  const enemies = o.monsters;
  const allies = o.heroes + o.pets;
  return { blocked: enemies >= CELL_CAPACITY, canTraverse: enemies < CELL_CAPACITY, canEnd: enemies + allies < CELL_CAPACITY };
}

export interface HeroNode {
  pos: Position;
  opened: string[];
  cost: number;
  /** Nombre de réactions Guard déclenchées le long du chemin. */
  triggers: number;
  prev: HeroNode | null;
  step: PathStep | null;
}

const nodeKey = (p: Position, opened: string[]) => `${key(p)}|${opened.join(',')}`;

/** Monstres (sur le plateau) dont la garde couvre cette Space. */
function guardingMonsters(s: GameState, at: Position, opened: ReadonlySet<string>) {
  return s.monsters.filter((m) => m.status === 'board' && m.position && isClose(s.board, m.position, at, opened));
}

/**
 * Recherche de Dijkstra : moins de réactions Guard d'abord, puis moins de PM.
 * Chaque pas coûte 1 PM : déplacement, porte ouverte, portail (rulebook p.14). Quitter une Space gardée
 * déclenche Guard ; un portail ne le fait pas (p.19).
 */
export function searchHeroMoves(s: GameState, heroId: string, mp: number): HeroNode[] {
  const hero = s.heroes.find((h) => h.id === heroId);
  if (!hero?.position) return [];
  const board = s.board;
  const better = (a: HeroNode, b: HeroNode) => a.triggers < b.triggers || (a.triggers === b.triggers && a.cost < b.cost);
  const root: HeroNode = { pos: hero.position, opened: [], cost: 0, triggers: 0, prev: null, step: null };
  const best = new Map<string, HeroNode>();
  best.set(nodeKey(root.pos, []), root);
  const open: HeroNode[] = [root];
  const done = new Set<string>();
  const out: HeroNode[] = [];
  while (open.length) {
    open.sort((a, b) => a.triggers - b.triggers || a.cost - b.cost);
    const cur = open.shift()!;
    const ck = nodeKey(cur.pos, cur.opened);
    if (done.has(ck)) continue;
    done.add(ck);
    out.push(cur);
    if (cur.cost >= mp) continue;
    const openedSet = new Set(cur.opened);
    const push = (n: HeroNode) => {
      const k = nodeKey(n.pos, n.opened);
      const prev = best.get(k);
      if (prev && !better(n, prev)) return;
      best.set(k, n);
      open.push(n);
    };
    for (const q of neighbors(board, cur.pos)) {
      const door = doorBetween(board, cur.pos, q);
      if (door && !door.open && !openedSet.has(door.id)) {
        push({ pos: cur.pos, opened: [...cur.opened, door.id].sort(), cost: cur.cost + 1, triggers: cur.triggers, prev: cur, step: { kind: 'open-door', from: cur.pos, to: q, doorId: door.id } });
        continue;
      }
      if (edgeBlocked(board, cur.pos, q, openedSet)) continue;
      if (!heroView(s, q, heroId).canTraverse) continue;
      const t = guardingMonsters(s, cur.pos, openedSet).length;
      push({ pos: q, opened: cur.opened, cost: cur.cost + 1, triggers: cur.triggers + t, prev: cur, step: { kind: 'move', from: cur.pos, to: q } });
    }
    const here = board.portals.find((p) => samePos(p.at, cur.pos));
    if (here) {
      for (const dest of board.portals) {
        if (dest.id === here.id || dest.color !== here.color) continue;
        if (!heroView(s, dest.at, heroId).canTraverse) continue;
        push({ pos: dest.at, opened: cur.opened, cost: cur.cost + 1, triggers: cur.triggers, prev: cur, step: { kind: 'portal', from: cur.pos, to: dest.at } });
      }
    }
  }
  return out;
}

export interface Reachable {
  pos: Position;
  cost: number;
  triggers: number;
  node: HeroNode;
}

/** Cases où le héros peut terminer son mouvement avec les PM restants (meilleur chemin pour chacune). */
export function reachableCells(s: GameState, heroId: string, mp: number): Reachable[] {
  const byPos = new Map<string, HeroNode>();
  for (const n of searchHeroMoves(s, heroId, mp)) {
    if (!n.step && !n.prev) continue;
    if (!heroView(s, n.pos, heroId).canEnd) continue;
    const k = key(n.pos);
    const cur = byPos.get(k);
    if (!cur || n.triggers < cur.triggers || (n.triggers === cur.triggers && n.cost < cur.cost)) byPos.set(k, n);
  }
  return [...byPos.values()].map((n) => ({ pos: n.pos, cost: n.cost, triggers: n.triggers, node: n }));
}

function chain(node: HeroNode): PathStep[] {
  const steps: PathStep[] = [];
  for (let n: HeroNode | null = node; n && n.step; n = n.prev) steps.unshift(n.step);
  return steps;
}

export function mpLeft(s: GameState, heroId: string): number {
  return s.heroTurn[heroId]?.mpLeft ?? HERO_MOVEMENT;
}

/** Validité d'une attaque : mêlée = cible Close ; distance = ligne de vue (rulebook p.15-17). */
export function canHeroTarget(s: GameState, heroId: string, monsterId: string, type: 'melee' | 'ranged'): boolean {
  const h = s.heroes.find((x) => x.id === heroId);
  const m = s.monsters.find((x) => x.id === monsterId);
  if (!h?.position || !m?.position || m.status !== 'board') return false;
  if (type === 'melee') return isClose(s.board, h.position, m.position);
  return hasLineOfSight(s, h.position, m.position, (p) => sightBlockedAt(s, heroId, p, heroView(s, p, heroId).blocked));
}

/** Marque l'activation d'un héros au premier geste (déplacement ou attaque). */
export function ensureActivated(s: GameState, heroId: string): void {
  const h = s.heroes.find((x) => x.id === heroId);
  if (!h || h.dead) throw new Error(`Héros indisponible : ${heroId}`);
  if (s.phase !== 'GUILD_TURN') throw new Error(`Action de héros impossible en phase ${s.phase}`);
  if (!s.activatedHeroIds.includes(heroId)) {
    if (blockedByOtherHero(s, heroId)) {
      throw new Error('Un seul héros est activé par tour (le même peut l’être plusieurs tours de suite)');
    }
    s.activatedHeroIds.push(heroId);
    log(s, 'hero-activated', `${h.name} est activé.`, { heroId });
  }
  s.heroTurn[heroId] ??= { mpLeft: HERO_MOVEMENT, moved: false, attacked: false };
}

/**
 * Déplace un héros vers une case, pas à pas. Avant chaque pas hors d'une Space gardée, les monstres
 * concernés attaquent (Guard) ; le joueur lance la défense. Si le héros meurt, le déplacement s'arrête.
 * Le mouvement ne peut pas être interrompu par l'attaque : il se fait avant ou après (rulebook p.14).
 */
export function moveHeroTo(
  state: GameState,
  content: Content,
  heroId: string,
  target: Position,
  answers: readonly InputAnswer[] = [],
): ActionResult {
  const s = cloneState(state);
  const rng = new CountingRandom(s.rngSeed, s.rngCounter);
  const oracle = createOracle(s, content, rng, answers);
  ensureActivated(s, heroId);
  const turn = s.heroTurn[heroId]!;
  if (turn.attacked && turn.moved) throw new Error("Le mouvement ne peut pas être repris après l'attaque");
  const hero = s.heroes.find((h) => h.id === heroId)!;
  const dest = reachableCells(s, heroId, turn.mpLeft).find((r) => samePos(r.pos, target));
  if (!dest) throw new Error(`Case (${target.x},${target.y}) hors de portée (${turn.mpLeft} PM restants)`);
  const steps = chain(dest.node);
  const instructions: PhysicalInstruction[] = [];
  const path: Position[] = [hero.position!];
  let spent = 0;
  const openedDoorIds: string[] = [];
  for (const st of steps) {
    if (hero.dead) break;
    if (st.kind === 'move') {
      for (const m of guardingMonsters(s, hero.position!, new Set())) {
        if (hero.dead) break;
        monsterAttacksHero(s, content, oracle, m.id, heroId, 'Réaction Guard', instructions);
      }
      if (hero.dead) break;
      hero.position = { ...st.to };
    } else if (st.kind === 'open-door') {
      const d = s.board.doors.find((x) => x.id === st.doorId);
      if (d) d.open = true;
      if (st.doorId) openedDoorIds.push(st.doorId);
    } else {
      hero.position = { ...st.to };
    }
    spent += 1;
    path.push(hero.position!);
  }
  turn.mpLeft = Math.max(0, turn.mpLeft - spent);
  turn.moved = true;
  if (!hero.dead) {
    log(s, 'hero-move', `${hero.name} → (${hero.position!.x},${hero.position!.y}) (${spent} PM, ${turn.mpLeft} restants)`, { heroId });
    instructions.unshift({ id: `move-${heroId}-${s.eventSeq}`, kind: 'move', text: `Déplacer ${hero.name} en (${hero.position!.x},${hero.position!.y}) (${spent} PM).`, actorId: heroId, path, visual: { type: 'move', actorId: heroId, path, doorIds: openedDoorIds } });
  }
  s.rngCounter = rng.counter;
  return { state: s, instructions };
}

/** Portes au bord de la case du héros, dans l'état demandé : il peut retourner chacune pour 1 point de mouvement. */
export function adjacentDoors(s: GameState, heroId: string, which: 'closed' | 'open' | 'any' = 'any'): string[] {
  const h = s.heroes.find((x) => x.id === heroId);
  const at = h?.position;
  if (!at) return [];
  return s.board.doors
    .filter((d) => (samePos(d.a, at) || samePos(d.b, at)) && (which === 'any' || (which === 'open') === d.open))
    .map((d) => d.id);
}

/** Portes fermées au bord de la case du héros (il peut en ouvrir une pour 1 point de mouvement). */
export const adjacentClosedDoors = (s: GameState, heroId: string): string[] => adjacentDoors(s, heroId, 'closed');

/**
 * Ouvre ou ferme une porte au bord de la case du héros (rulebook p.14 : le pion se retourne). Cela coûte 1 point de
 * mouvement mais n'est PAS une action : l'attaque reste disponible, le mouvement n'est pas terminé (le héros peut ensuite
 * avancer avec ses points restants) et aucune réaction Guard ne se déclenche, puisque le héros ne quitte pas sa case.
 */
export function setDoorAsHero(state: GameState, _content: Content, heroId: string, doorId: string, open: boolean): ActionResult {
  const s = cloneState(state);
  ensureActivated(s, heroId);
  const turn = s.heroTurn[heroId]!;
  const hero = s.heroes.find((h) => h.id === heroId)!;
  if (turn.attacked && turn.moved) throw new Error("Le mouvement ne peut pas être repris après l'attaque");
  if (turn.mpLeft < 1) throw new Error(`Aucun point de mouvement restant pour ${open ? 'ouvrir' : 'fermer'} une porte`);
  const door = s.board.doors.find((d) => d.id === doorId);
  if (!door) throw new Error(`Porte inconnue : ${doorId}`);
  if (door.open === open) throw new Error(open ? 'Cette porte est déjà ouverte' : 'Cette porte est déjà fermée');
  if (!adjacentDoors(s, heroId).includes(doorId)) throw new Error("Cette porte n'est pas au bord de la case du héros");
  door.open = open;
  turn.mpLeft -= 1;
  turn.moved = true; // des points de mouvement ont été dépensés : le mouvement ne pourra plus être repris après une attaque
  const verb = open ? 'ouvre' : 'ferme';
  log(s, 'hero-door', `${hero.name} ${verb} la porte ${doorId} (1 PM, ${turn.mpLeft} restants)`, { heroId, doorId, open });
  return {
    state: s,
    instructions: [
      {
        id: `door-${heroId}-${s.eventSeq}`,
        kind: 'move',
        label: open ? 'Ouvrir la porte' : 'Fermer la porte',
        text: `${open ? 'Ouvrir' : 'Fermer'} la porte (1 PM).`,
        actorId: heroId,
        visual: { type: 'door', doorId, open },
      },
    ],
  };
}

export const openDoorAsHero = (state: GameState, content: Content, heroId: string, doorId: string): ActionResult => setDoorAsHero(state, content, heroId, doorId, true);
export const closeDoorAsHero = (state: GameState, content: Content, heroId: string, doorId: string): ActionResult => setDoorAsHero(state, content, heroId, doorId, false);

export { damageHero };

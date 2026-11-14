import type { Content, GameState, Position } from '../domain/schemas';
import { hasLineOfSight, isClose, key, monsterView, neighbors, doorBetween, samePos, edgeBlocked, sightBlockedAt } from './board';

export interface PathStep {
  kind: 'move' | 'open-door' | 'portal';
  from: Position;
  to: Position;
  doorId?: string;
}

interface Node {
  pos: Position;
  opened: string[];
  cost: number;
  prev: Node | null;
  step: PathStep | null;
}

const nodeKey = (pos: Position, opened: string[]) => `${key(pos)}|${opened.join(',')}`;

/**
 * Recherche en largeur (tous les coûts valent 1 PM) des états atteignables : position + portes ouvertes.
 * Règles : déplacement orthogonal, ouvrir une porte = 1 PM, portail = 1 PM (rulebook p.14).
 * Algorithme distinct de la sélection du monstre (distance orthogonale du livret solo).
 */
export function searchReachable(state: GameState, actorId: string, start: Position, maxCost: number): Node[] {
  const board = state.board;
  const root: Node = { pos: start, opened: [], cost: 0, prev: null, step: null };
  const seen = new Set<string>([nodeKey(start, [])]);
  const queue: Node[] = [root];
  const all: Node[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    all.push(cur);
    if (cur.cost >= maxCost) continue;
    const openedSet = new Set(cur.opened);
    const push = (n: Node) => {
      const k = nodeKey(n.pos, n.opened);
      if (seen.has(k)) return;
      seen.add(k);
      queue.push(n);
    };
    for (const q of neighbors(board, cur.pos)) {
      const door = doorBetween(board, cur.pos, q);
      if (door && !door.open && !openedSet.has(door.id)) {
        push({
          pos: cur.pos,
          opened: [...cur.opened, door.id].sort(),
          cost: cur.cost + 1,
          prev: cur,
          step: { kind: 'open-door', from: cur.pos, to: q, doorId: door.id },
        });
        continue;
      }
      if (edgeBlocked(board, cur.pos, q, openedSet)) continue;
      if (!monsterView(state, q, actorId).canTraverse) continue;
      push({ pos: q, opened: cur.opened, cost: cur.cost + 1, prev: cur, step: { kind: 'move', from: cur.pos, to: q } });
    }
    const here = board.portals.find((p) => samePos(p.at, cur.pos));
    if (here) {
      for (const dest of board.portals) {
        if (dest.id === here.id || dest.color !== here.color) continue;
        if (!monsterView(state, dest.at, actorId).canTraverse) continue;
        push({
          pos: dest.at,
          opened: cur.opened,
          cost: cur.cost + 1,
          prev: cur,
          step: { kind: 'portal', from: cur.pos, to: dest.at },
        });
      }
    }
  }
  return all;
}

export function canAttackFrom(
  state: GameState,
  actorId: string,
  attackType: 'melee' | 'ranged',
  from: Position,
  target: Position,
  opened: ReadonlySet<string>,
): boolean {
  if (attackType === 'melee') return isClose(state.board, from, target, opened);
  return hasLineOfSight(state, from, target, (p) => sightBlockedAt(state, actorId, p, monsterView(state, p, actorId).blocked), opened);
}

function pathTo(node: Node): PathStep[] {
  const steps: PathStep[] = [];
  for (let n: Node | null = node; n && n.step; n = n.prev) steps.unshift(n.step);
  return steps;
}

export interface TargetEvaluation {
  id: string;
  cost: number | null;
  wounds: number;
  node: Node | null;
}

export interface ActionPlan {
  monsterId: string;
  targetId: string | null;
  steps: PathStep[];
  destination: Position;
  mpUsed: number;
  canAttack: boolean;
  evaluations: { id: string; cost: number | null; wounds: number }[];
  explanation: string[];
}

export interface PlanOptions {
  /** Cibles possibles : héros (par défaut) ou familiers (carte Wild Pet). */
  targetKind: 'hero' | 'pet';
  /** Réaction Payback : la cible est imposée (l'attaquant). */
  onlyTargetId?: string;
  choose: (purpose: string, options: string[]) => string;
}

const SEARCH_LIMIT = 40;

/**
 * Plan d'activation d'un monstre : cible la plus proche (coût minimal en PM), départage par blessures
 * puis par la politique de choix ; PM minimal pour attaquer ; sinon avance vers la cible (solo v1.3 p.2).
 */
export function planMonsterAction(
  state: GameState,
  content: Content,
  monsterId: string,
  mp: number,
  opts: PlanOptions,
): ActionPlan {
  const monster = state.monsters.find((m) => m.id === monsterId);
  if (!monster || !monster.position) throw new Error(`Monstre ${monsterId} absent du plateau`);
  const def = content.monsters[monster.definitionId];
  const stats = def?.levels[state.monsterCardSet];
  if (!def || !stats) throw new Error(`Stats manquantes pour ${monster.definitionId} (jeu ${state.monsterCardSet})`);
  const start = monster.position;
  const explanation: string[] = [];

  const pool =
    opts.targetKind === 'pet'
      ? state.pets.filter((p) => !p.dead && p.position)
      : state.heroes.filter((h) => !h.dead && h.position);
  const targets = opts.onlyTargetId ? pool.filter((t) => t.id === opts.onlyTargetId) : pool;
  const nodes = searchReachable(state, monster.id, start, SEARCH_LIMIT);

  const evaluations: TargetEvaluation[] = targets.map((t) => {
    let best: Node | null = null;
    for (const n of nodes) {
      if (!monsterView(state, n.pos, monster.id).canEnd && !samePos(n.pos, start)) continue;
      if (!canAttackFrom(state, monster.id, stats.attackType, n.pos, t.position!, new Set(n.opened))) continue;
      if (!best || n.cost < best.cost) best = n;
    }
    return { id: t.id, cost: best ? best.cost : null, wounds: t.wounds, node: best };
  });
  const summary = evaluations.map((e) => ({ id: e.id, cost: e.cost, wounds: e.wounds }));

  const reachable = evaluations.filter((e) => e.cost !== null);
  if (reachable.length === 0) {
    explanation.push('Aucune cible atteignable : le monstre ne bouge pas.');
    return { monsterId, targetId: null, steps: [], destination: start, mpUsed: 0, canAttack: false, evaluations: summary, explanation };
  }

  const minCost = Math.min(...reachable.map((e) => e.cost!));
  let tied = reachable.filter((e) => e.cost === minCost);
  explanation.push(`Cible la plus proche : coût minimal ${minCost} PM (${tied.map((e) => e.id).join(', ')}).`);
  if (tied.length > 1) {
    const maxWounds = Math.max(...tied.map((e) => e.wounds));
    tied = tied.filter((e) => e.wounds === maxWounds);
    explanation.push(`Départage : le plus de blessures (${maxWounds}) → ${tied.map((e) => e.id).join(', ')}.`);
  }
  const chosenId = tied.length > 1 ? opts.choose('Choisir la cible de l\'attaque', tied.map((e) => e.id).sort()) : tied[0]!.id;
  const chosen = evaluations.find((e) => e.id === chosenId)!;
  const fullSteps = pathTo(chosen.node!);

  if (chosen.cost! <= mp) {
    explanation.push(`Attaque possible en ${chosen.cost} PM sur ${chosenId} (minimum nécessaire).`);
    return {
      monsterId,
      targetId: chosenId,
      steps: fullSteps,
      destination: chosen.node!.pos,
      mpUsed: chosen.cost!,
      canAttack: true,
      evaluations: summary,
      explanation,
    };
  }

  // Trop loin : avancer le long du chemin vers la cible, en terminant sur une Space où l'on peut s'arrêter.
  let stop: Node | null = chosen.node!;
  while (stop && (stop.cost > mp || (!samePos(stop.pos, start) && !monsterView(state, stop.pos, monster.id).canEnd))) {
    stop = stop.prev;
  }
  const end = stop ?? nodes[0]!;
  explanation.push(`Cible hors de portée (${chosen.cost} PM pour ${mp} disponibles) : avance de ${end.cost} PM vers ${chosenId}.`);
  return {
    monsterId,
    targetId: chosenId,
    steps: pathTo(end),
    destination: end.pos,
    mpUsed: end.cost,
    canAttack: false,
    evaluations: summary,
    explanation,
  };
}

import type { Content, GameState, Position, WeaponCard } from '../domain/schemas';
import { statsOfMonster } from '../monsters';
import { applyMonsterWounds, finalizeMonsterKill } from './damage';
import { monsterStrike, stunInstruction } from './monsterAttack';
import { isClose } from '../movement/board';
import { planMonsterAction } from '../movement/plan';
import { createOracle, type InputAnswer, type Oracle } from '../oracle';
import { CountingRandom } from '../random';
import { cloneState, log } from '../state';
import { spawnInstructions, type PhysicalInstruction } from '../activation/monsterTurn';
import { resolveSpawnTile } from '../spawn/spawn';
import { pruneEliminatedTypes } from '../activation/deck';
import { canHeroTarget, ensureActivated } from './heroMove';

export interface ActionResult {
  state: GameState;
  instructions: PhysicalInstruction[];
}

function begin(state: GameState, content: Content, answers: readonly InputAnswer[]) {
  const s = cloneState(state);
  const rng = new CountingRandom(s.rngSeed, s.rngCounter);
  const oracle = createOracle(s, content, rng, answers);
  return { s, rng, oracle };
}

export function monsterAttacksHero(
  s: GameState,
  content: Content,
  oracle: Oracle,
  monsterId: string,
  heroId: string,
  label: string,
  out: PhysicalInstruction[],
): void {
  const m = s.monsters.find((x) => x.id === monsterId)!;
  const hero = s.heroes.find((h) => h.id === heroId)!;
  const def = content.monsters[m.definitionId]!;
  const results = monsterStrike(s, content, oracle, monsterId, heroId, { purpose: `${label} : ${def.name} ${monsterId} attaque ${hero.name}`, cause: label });
  // Une cible : ids et textes habituels. Plusieurs (Troll) : une étape par héros ciblé, suffixée de son identifiant.
  const multi = results.length > 1;
  for (const r of results) {
    const o = r.outcome;
    const extra = o.extraWounds ? ` (dont ${o.extraWounds} de critique)` : '';
    out.push({
      id: multi ? `${label}-${monsterId}-${r.targetId}` : `${label}-${monsterId}`,
      kind: 'attack',
      text: `${label} — ${def.name} ${monsterId} attaque ${r.targetName} : ${o.hits} coup(s), ${o.saves} sauvegarde(s) → ${o.wounds} blessure(s)${extra}.`,
      visual: { type: 'attack', attackerId: monsterId, targetId: r.targetId, wounds: o.wounds },
    });
    if (r.died) out.push({ id: `${label}-${r.targetId}-down`, kind: 'info', text: `${r.targetName} est mis hors combat.`, actorId: r.targetId, visual: { type: 'remove', actorId: r.targetId, ...(r.at ? { at: r.at } : {}) } });
    if (r.stunned) out.push(stunInstruction(`${label}-${r.targetId}-stun`, r));
  }
}

/**
 * Un monstre ciblé par `heroId` pourrait-il l'attaquer en riposte (Payback) : avec son propre mouvement, par le plus court
 * chemin, en ouvrant les portes (1 PM chacune) ? Sert à retirer sans détour un monstre tombé qui ne le pourrait pas.
 */
export function monsterCanPayback(state: GameState, content: Content, monsterId: string, heroId: string): boolean {
  const m = state.monsters.find((x) => x.id === monsterId);
  const stats = m && statsOfMonster(content, state, m);
  if (!m?.position || m.status !== 'board' || !stats) return false;
  return planMonsterAction(state, content, monsterId, stats.movement, { targetKind: 'hero', onlyTargetId: heroId, choose: (_p, o) => o[0]! }).canAttack;
}

/** Monstres (sur le plateau) Close à une Space donnée. */
function closeMonsters(s: GameState, at: Position, exclude: string[] = []) {
  return s.monsters.filter(
    (m) => m.status === 'board' && m.position && !exclude.includes(m.id) && isClose(s.board, m.position, at),
  );
}

/**
 * Déplacement d'un héros d'une Space à une autre (rulebook p.19). Quitter une Space Close à un monstre
 * déclenche sa réaction Guard (attaque sans mouvement) AVANT le déplacement ; un portail ne la déclenche pas.
 * Entrer dans une Space Close ne la déclenche pas.
 */
export function resolveHeroMove(
  state: GameState,
  content: Content,
  heroId: string,
  to: Position,
  via: 'step' | 'portal' = 'step',
  answers: readonly InputAnswer[] = [],
): ActionResult {
  const { s, rng, oracle } = begin(state, content, answers);
  const hero = s.heroes.find((h) => h.id === heroId);
  if (!hero || hero.dead || !hero.position) throw new Error(`Héros indisponible : ${heroId}`);
  const instructions: PhysicalInstruction[] = [];
  if (via === 'step') {
    for (const m of closeMonsters(s, hero.position)) {
      if (hero.dead) break;
      monsterAttacksHero(s, content, oracle, m.id, heroId, 'Réaction Guard', instructions);
    }
  }
  if (!hero.dead) {
    hero.position = { ...to };
    log(s, 'hero-move', `${hero.name} → (${to.x},${to.y})${via === 'portal' ? ' (portail)' : ''}`, { heroId });
  }
  s.rngCounter = rng.counter;
  return { state: s, instructions };
}

export interface TargetOutcome {
  monsterId: string;
  /** Blessures subies par ce monstre : le joueur lance ses dés physiquement et les indique (parades du monstre comprises). */
  wounds: number;
}

/**
 * Attaque d'un héros sur un ou plusieurs monstres. Le joueur lance les dés et indique les blessures de chaque monstre
 * ciblé ; l'application ne calcule que la portée (type de l'arme). Enchaîne Payback (un seul monstre : tier le plus
 * élevé parmi les cibles, FAQ solo p.20), Overkill.
 */
export function resolveHeroAttack(
  state: GameState,
  content: Content,
  heroId: string,
  targets: TargetOutcome[],
  answers: readonly InputAnswer[] = [],
  options: { attackType?: 'melee' | 'ranged'; weaponId?: string } = {},
): ActionResult {
  const { s, rng, oracle } = begin(state, content, answers);
  const hero = s.heroes.find((h) => h.id === heroId);
  if (!hero || hero.dead || !hero.position) throw new Error(`Héros indisponible : ${heroId}`);
  if (targets.length === 0) throw new Error('Aucune cible');
  // Les cartes équipement sont gérées par les joueurs : sans `weaponId`, seul le type d'attaque compte. Si une carte est
  // désignée, elle fixe le type d'attaque et doit être disponible (non épuisée).
  let attackType = options.attackType;
  let weapon: WeaponCard | undefined;
  if (options.weaponId) {
    weapon = hero.weapons?.find((w) => w.id === options.weaponId);
    if (!weapon) throw new Error(`Carte arme inconnue : ${options.weaponId}`);
    if (weapon.exhausted) throw new Error(`${weapon.name} est épuisée : reposez la guilde pour retirer les jetons`);
    attackType = weapon.attackType;
  }
  ensureActivated(s, heroId);
  const turn = s.heroTurn[heroId]!;
  if (turn.attacked) throw new Error(`${hero.name} a déjà attaqué pendant cette activation`);
  if (attackType) {
    for (const t of targets) {
      if (!canHeroTarget(s, heroId, t.monsterId, attackType)) {
        throw new Error(`${t.monsterId} n'est pas une cible valide en ${attackType === 'melee' ? 'mêlée (il doit être Close)' : 'distance (ligne de vue requise)'}`);
      }
    }
  }
  // Le mouvement a déjà commencé (pas, porte…) : l'attaque le scinde, il ne peut plus reprendre ensuite.
  if (turn.moved) turn.moveLocked = true;
  turn.attacked = true;
  if (weapon) weapon.exhausted = true;
  const instructions: PhysicalInstruction[] = [];
  const targeted: { id: string; killed: boolean; overkill: boolean; /** Tombé et incapable de riposter, même en se déplaçant : retiré tout de suite. */ removedNow?: boolean }[] = [];

  for (const t of targets) {
    const m = s.monsters.find((x) => x.id === t.monsterId);
    if (!m || m.status !== 'board') throw new Error(`Cible indisponible : ${t.monsterId}`);
    if (!Number.isInteger(t.wounds) || t.wounds < 0) throw new Error(`Blessures invalides pour ${t.monsterId}`);
    const wounds = t.wounds;
    const r = applyMonsterWounds(s, content, m.id, wounds);
    targeted.push({ id: m.id, killed: r.killed, overkill: r.overkill });
    instructions.push({
      id: `hit-${m.id}`,
      kind: 'attack',
      text: `${hero.name} → ${m.id} : ${wounds} blessure(s).${r.killed ? ' Le monstre est tué.' : ''}`,
      visual: { type: 'attack', attackerId: heroId, targetId: m.id, wounds },
    });
    // Tué sur le coup (overkill) : aucune riposte, il part tout de suite. Sinon il riposte d'abord (Payback), même s'il
    // vient de perdre son dernier point de vie, puis il est retiré de sa case finale (voir plus bas).
    if (r.overkill && m.position) {
      instructions.push({ id: `kill-${m.id}`, kind: 'info', text: `${m.id} est retiré du plateau.`, actorId: m.id, visual: { type: 'remove', actorId: m.id, at: { ...m.position } } });
    }
  }

  // Un monstre tombé qui ne pourrait pas attaquer son attaquant, même en se déplaçant, n'a rien à faire : il est retiré
  // directement, sur place, sans déplacement. Il ne prend pas non plus la place de la riposte d'un autre monstre.
  for (const t of targeted) {
    if (!t.killed || t.overkill) continue;
    const m = s.monsters.find((x) => x.id === t.id)!;
    if (!m.position) continue;
    if (!monsterCanPayback(s, content, t.id, heroId)) {
      t.removedNow = true;
      instructions.push({ id: `kill-${m.id}`, kind: 'info', text: `${m.id} est retiré du plateau.`, actorId: m.id, visual: { type: 'remove', actorId: m.id, at: { ...m.position } } });
    }
  }

  // Payback : un seul monstre, du tier le plus élevé ; pas de Payback en cas d'Overkill ni pour un monstre déjà retiré.
  const eligible = targeted.filter((t) => !t.overkill && !t.removedNow);
  if (eligible.length) {
    const maxTier = Math.max(...eligible.map((t) => content.monsters[s.monsters.find((m) => m.id === t.id)!.definitionId]!.tier));
    const top = eligible
      .filter((t) => content.monsters[s.monsters.find((m) => m.id === t.id)!.definitionId]!.tier === maxTier)
      .map((t) => t.id);
    const chosen = oracle.choose('Quel monstre riposte (Payback) ?', top.sort());
    const m = s.monsters.find((x) => x.id === chosen)!;
    const stats = statsOfMonster(content, s, m)!;
    const plan = planMonsterAction(s, content, chosen, stats.movement, {
      targetKind: 'hero',
      onlyTargetId: heroId,
      choose: (p, o) => oracle.choose(p, o),
    });
    const openedDoorIds: string[] = [];
    for (const st of plan.steps) {
      if (st.kind === 'open-door') {
        const d = s.board.doors.find((x) => x.id === st.doorId);
        if (d) d.open = true;
        if (st.doorId) openedDoorIds.push(st.doorId);
      }
    }
    if (plan.steps.length) {
      const path = [{ ...m.position! }, ...plan.steps.map((st) => ({ ...st.to }))];
      m.position = { ...plan.destination };
      instructions.push({
        id: `payback-move-${chosen}`,
        kind: 'move',
        text: `Payback : déplacer ${chosen} en (${plan.destination.x},${plan.destination.y}) (${plan.mpUsed} PM).`,
        actorId: chosen,
        path,
        visual: { type: 'move', actorId: chosen, path, doorIds: openedDoorIds },
      });
    }
    log(s, 'payback', `Payback de ${chosen} (tier ${maxTier}).`, { monsterId: chosen });
    if (plan.canAttack) monsterAttacksHero(s, content, oracle, chosen, heroId, 'Payback', instructions);
  }
  // Les monstres tombés à la perte de leur dernier point de vie sont retirés après leur riposte, de leur case d'arrivée.
  for (const t of targeted) {
    const m = s.monsters.find((x) => x.id === t.id);
    if (t.killed && !t.overkill && !t.removedNow && m?.position) {
      instructions.push({ id: `kill-${m.id}`, kind: 'info', text: `${m.id} est retiré du plateau.`, actorId: m.id, visual: { type: 'remove', actorId: m.id, at: { ...m.position } } });
    }
  }
  for (const t of targeted) {
    if (!t.killed) continue;
    finalizeMonsterKill(s, content, t.id, true, t.overkill);
    // Dès que la Spawn Tile est pleine, et à n'importe quel moment, les monstres qui s'y trouvent apparaissent.
    const nameOf = (id: string): string => content.monsters[s.monsters.find((x) => x.id === id)?.definitionId ?? '']?.name ?? id;
    instructions.push(...spawnInstructions(resolveSpawnTile(s, oracle, rng), nameOf));
  }

  // Aucune réaction Guard après une attaque : elle ne se déclenche que lorsque le héros quitte sa Space (déplacement).
  pruneEliminatedTypes(s);
  s.rngCounter = rng.counter;
  return { state: s, instructions };
}



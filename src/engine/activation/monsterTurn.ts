import type { Content, DecisionTrace, GameState } from '../domain/schemas';
import { damageHero, damagePet } from '../combat/damage';
import { selectionDistance } from '../movement/board';
import { planMonsterAction, type ActionPlan } from '../movement/plan';
import { createOracle, NeedInput, type InputAnswer, type InputRequest, type Oracle } from '../oracle';
import { CountingRandom, type RandomSource } from '../random';
import { resolveSpawnPhase, rollSpawnPoint } from '../spawn/spawn';
import { cloneState, isTerminal, log } from '../state';
import type { VisualAction } from '../visual';
import { discardCard, drawCard, pruneEliminatedTypes, recycleDiscard } from './deck';

export const MONSTER_TURN_MOVEMENT = 3;

export interface PhysicalInstruction {
  id: string;
  kind: 'spawn' | 'move' | 'attack' | 'info';
  text: string;
  /** Personnage concerné et trajet (pour l'afficher sur le plateau). */
  actorId?: string;
  path?: { x: number; y: number }[];
  /** Rubrique du Monster Turn (« Activation 1 »…) et intitulé de l'étape, pour que la phase des monstres soit lisible. */
  group?: string;
  label?: string;
  /** Description visuelle de l'action : c'est elle que l'interface montre au joueur (le `text` sert au journal). */
  visual?: VisualAction;
}

export interface MonsterTurnResult {
  state: GameState;
  instructions: PhysicalInstruction[];
  traces: DecisionTrace[];
}

export type MonsterTurnOutcome =
  | ({ status: 'done' } & MonsterTurnResult)
  | { status: 'awaiting-input'; request: InputRequest; partial: PhysicalInstruction[]; partialTraces: DecisionTrace[] }
  | { status: 'blocked'; error: string };

function describePlan(plan: ActionPlan, name: string): string[] {
  const out: string[] = [];
  for (const st of plan.steps) {
    if (st.kind === 'open-door') out.push(`Ouvrir la porte vers (${st.to.x},${st.to.y}) (1 PM)`);
    else if (st.kind === 'portal') out.push(`Portail : (${st.from.x},${st.from.y}) → (${st.to.x},${st.to.y}) (1 PM)`);
    else out.push(`Avancer en (${st.to.x},${st.to.y}) (1 PM)`);
  }
  return out.length ? [`${name} :`, ...out] : [`${name} ne bouge pas.`];
}

function activateOne(
  s: GameState,
  content: Content,
  oracle: Oracle,
  rng: RandomSource,
  n: 1 | 2,
  out: MonsterTurnResult,
): void {
  const tag = `R${s.round}-A${n}`;
  const group = `Activation ${n}`;
  const { point, dice } = rollSpawnPoint(s, oracle, `Activation ${n} : Spawn Point de référence`);
  out.instructions.push({
    id: `${tag}-dice`,
    kind: 'info',
    group,
    label: 'Jeton Spawn de référence',
    text: `Dés de référence : ${dice[0]} / ${dice[1]} → jeton ${point.id}.`,
    visual: { type: 'spawn-point', at: { ...point.at }, pointId: point.id },
  });

  // Carte d'activation ; les cartes Wild Pet modifient la cible de la prochaine activation (Pets).
  let card = drawCard(s, rng, oracle.cardPick());
  while (card.kind === 'wild-pet') {
    discardCard(s, card);
    if (s.nextActivationTargetsPet) recycleDiscard(s, rng, 'deux cartes Wild Pet consécutives');
    s.nextActivationTargetsPet = true;
    log(s, 'wild-pet', 'Carte Wild Pet : le prochain monstre vise le familier le plus proche.');
    card = drawCard(s, rng, oracle.cardPick());
  }
  const targetsPet = s.nextActivationTargetsPet && s.pets.some((p) => !p.dead && p.position);
  s.nextActivationTargetsPet = false;
  const def = content.monsters[card.monsterDefId!];
  if (!def) throw new Error(`Monstre inconnu : ${card.monsterDefId}`);

  const onBoard = s.monsters.filter((m) => m.status === 'board' && m.position && m.definitionId === def.id);
  const rejected: { entityId: string; reason: string }[] = [];
  const explanation = [
    `La carte révélée demande : ${def.name}.`,
    `Spawn Point de référence : ${point.id} en (${point.at.x},${point.at.y}).`,
  ];
  const trace: DecisionTrace = {
    decisionId: `${tag}-select`,
    ruleIds: ['RULE-SOLO-009', 'RULE-SOLO-010', 'RULE-SOLO-011', 'RULE-SOLO-014'],
    summary: '',
    explanation,
    candidates: onBoard.map((m) => m.id),
    rejectedCandidates: rejected,
  };

  const finish = (summary: string) => {
    trace.summary = summary;
    out.traces.push(trace);
    log(s, 'activation', summary, { card: card.id }, trace);
    discardCard(s, card);
  };

  if (onBoard.length === 0) {
    explanation.push('Aucune figurine de ce type sur le plateau : rien ne se passe (solo p.6).');
    out.instructions.push({ id: `${tag}-none`, kind: 'info', group, label: `Aucun ${def.name} sur le plateau : rien ne se passe`, text: `Activation ${n} : aucun ${def.name} sur le plateau.` });
    return finish(`Activation ${n} : aucun ${def.name} sur le plateau.`);
  }
  const ranked = onBoard
    .map((m) => ({ m, d: selectionDistance(point.at, m.position!) }))
    .sort((a, b) => a.d - b.d || a.m.id.localeCompare(b.m.id));
  const free = ranked.filter((r) => !r.m.isGuard);
  for (const r of ranked.filter((x) => x.m.isGuard)) {
    rejected.push({ entityId: r.m.id, reason: 'garde : ignoré pour l\'activation' });
  }
  if (free.length === 0) {
    explanation.push('Tous les monstres de ce type sont des gardes : aucune activation (question ouverte B6).');
    out.instructions.push({ id: `${tag}-guards`, kind: 'info', group, label: `Seuls des gardes ${def.name} restent : personne n'agit`, text: `Activation ${n} : seuls des gardes ${def.name} restent.` });
    return finish(`Activation ${n} : seuls des gardes ${def.name} restent.`);
  }
  const minD = free[0]!.d;
  const tied = free.filter((r) => r.d === minD).map((r) => r.m.id);
  explanation.push(`Distance orthogonale minimale (terrain ignoré) : ${minD} Space(s).`);
  const chosenId = oracle.choose(`Départager les ${def.name} à égalité (distance ${minD})`, tied);
  if (tied.length > 1) explanation.push(`Égalité entre ${tied.join(', ')} : ${chosenId} choisi (${s.settings.tiePolicy}).`);
  for (const r of free) if (r.m.id !== chosenId) rejected.push({ entityId: r.m.id, reason: `plus loin ou non retenu (distance ${r.d})` });
  trace.selectedEntityId = chosenId;
  out.instructions.push({
    id: `${tag}-select`,
    kind: 'info',
    group,
    label: `${def.name} est activé`,
    text: `${def.name} ${chosenId} est activé.`,
    actorId: chosenId,
    visual: { type: 'activate', actorId: chosenId, at: { ...ranked.find((r) => r.m.id === chosenId)!.m.position! } },
  });

  const kind: 'hero' | 'pet' = targetsPet ? 'pet' : 'hero';
  const plan = planMonsterAction(s, content, chosenId, MONSTER_TURN_MOVEMENT, {
    targetKind: kind,
    choose: (purpose, options) => oracle.choose(purpose, options),
  });
  explanation.push(...plan.explanation);
  trace.ruleIds.push('RULE-SOLO-012');

  const monster = s.monsters.find((m) => m.id === chosenId)!;
  const openedDoorIds: string[] = [];
  for (const st of plan.steps) {
    if (st.kind === 'open-door') {
      const d = s.board.doors.find((x) => x.id === st.doorId);
      if (d) d.open = true;
      if (st.doorId) openedDoorIds.push(st.doorId);
    }
  }
  const from = monster.position!;
  monster.position = { ...plan.destination };
  if (plan.steps.length) {
    out.instructions.push({
      id: `${tag}-move`,
      kind: 'move',
      group,
      label: `${def.name} avance`,
      text: describePlan(plan, `${def.name} ${chosenId} (depuis (${from.x},${from.y}))`).join('\n'),
      actorId: chosenId,
      path: [from, ...plan.steps.map((st) => st.to)],
      visual: { type: 'move', actorId: chosenId, path: [from, ...plan.steps.map((st) => st.to)], doorIds: openedDoorIds },
    });
    log(s, 'monster-move', `${chosenId} → (${plan.destination.x},${plan.destination.y}) en ${plan.mpUsed} PM`, { plan: plan.steps });
  }

  if (plan.canAttack && plan.targetId) {
    const stats = def.levels[s.monsterCardSet]!;
    const targetHero = s.heroes.find((h) => h.id === plan.targetId);
    const targetPet = s.pets.find((p) => p.id === plan.targetId);
    const defenseDice = targetHero ? targetHero.defense : (targetPet?.defense ?? 0);
    const outcome = oracle.attack({
      attackDice: stats.attackDice,
      attackType: stats.attackType,
      attackerRerolls: stats.rerolls ?? 0,
      defenseDice,
      defenderRerolls: targetHero?.rerolls ?? 0,
      purpose: `${def.name} ${chosenId} attaque ${plan.targetId}`,
      defenderIsHero: !!targetHero,
      targetName: targetHero?.name ?? targetPet?.name,
      attackerId: chosenId,
      targetId: plan.targetId,
      attackerAt: monster.position,
      targetAt: targetHero?.position ?? targetPet?.position ?? null,
    });
    out.instructions.push({
      id: `${tag}-attack`,
      kind: 'attack',
      group,
      label: `${def.name} attaque`,
      text:
        `${def.name} ${chosenId} attaque ${plan.targetId} : ${outcome.hits} coup(s), ${outcome.saves} sauvegarde(s) → ` +
        `${outcome.wounds} blessure(s).`,
      visual: { type: 'attack', attackerId: chosenId, targetId: plan.targetId, wounds: outcome.wounds },
    });
    if (targetHero) damageHero(s, targetHero.id, outcome.wounds, `attaque de ${chosenId}`);
    else if (targetPet) damagePet(s, targetPet.id, outcome.wounds, `attaque de ${chosenId}`);
    log(s, 'monster-attack', `${chosenId} → ${plan.targetId} : ${outcome.hits}/${outcome.saves} → ${outcome.wounds}`, {
      attackFaces: outcome.attackFaces,
      defenseFaces: outcome.defenseFaces,
    });
  } else if (plan.targetId) {
    explanation.push(`${chosenId} ne peut pas atteindre ${plan.targetId} ce tour-ci.`);
  }
  finish(
    `Activation ${n} : ${chosenId} (${def.name}) ${plan.canAttack ? `attaque ${plan.targetId}` : plan.steps.length ? 'avance sans pouvoir attaquer' : 'reste en place'}.`,
  );
}

/**
 * Pilote le Monster Turn complet : Spawn puis deux activations. Fonction pure : renvoie un nouvel état.
 * Doit partir de la phase MONSTER_TURN_SPAWN. Lève NeedInput si une saisie physique manque.
 */
export function runMonsterTurn(state: GameState, content: Content, answers: readonly InputAnswer[] = []): MonsterTurnResult {
  if (state.phase !== 'MONSTER_TURN_SPAWN') throw new Error(`Monster Turn impossible depuis la phase ${state.phase}`);
  if (state.dragonPart2) throw new Error('Dragon Partie 2 : pas de Monster Turn');
  const s = cloneState(state);
  const rng = new CountingRandom(s.rngSeed, s.rngCounter);
  const oracle = createOracle(s, content, rng, answers);
  const out: MonsterTurnResult = { state: s, instructions: [], traces: [] };

  const nameOf = (id: string): string => {
    const m = s.monsters.find((x) => x.id === id);
    return (m && content.monsters[m.definitionId]?.name) || id;
  };

  try {
    const report = resolveSpawnPhase(s, oracle, rng);
    for (const p of report.placed) {
      out.instructions.push({ id: `spawn-${p.monsterId}`, kind: 'spawn', group: 'Apparition des monstres', label: `${nameOf(p.monsterId)} apparaît`, text: `Placer ${p.monsterId} en (${p.at.x},${p.at.y}).`, actorId: p.monsterId, visual: { type: 'place', actorId: p.monsterId, at: p.at } });
    }
    for (const b of report.boxed) {
      out.instructions.push({ id: `box-${b.monsterId}`, kind: 'spawn', group: 'Apparition des monstres', label: `${nameOf(b.monsterId)} retourne dans la boîte`, text: `Remettre ${b.monsterId} dans la boîte (${b.reason}).`, actorId: b.monsterId, visual: { type: 'remove', actorId: b.monsterId } });
    }

    for (const n of [1, 2] as const) {
      s.phase = n === 1 ? 'MONSTER_TURN_ACTIVATION_1' : 'MONSTER_TURN_ACTIVATION_2';
      activateOne(s, content, oracle, rng, n, out);
      pruneEliminatedTypes(s);
      if (isTerminal(s.phase)) break;
    }
    if (!isTerminal(s.phase)) {
      s.phase = 'GUILD_TURN';
      s.round += 1;
      s.activatedHeroIds = [];
      s.heroTurn = {};
      log(s, 'round-start', `Manche ${s.round} : Guild Turn.`);
    }
  } catch (e) {
    if (e instanceof NeedInput) e.partial = { instructions: out.instructions, traces: out.traces };
    throw e;
  }
  s.rngCounter = rng.counter;
  return out;
}

/** Enveloppe sûre : renvoie un statut au lieu de lever (saisie physique requise, blocage). */
export function runMonsterTurnSafe(state: GameState, content: Content, answers: readonly InputAnswer[] = []): MonsterTurnOutcome {
  try {
    return { status: 'done', ...runMonsterTurn(state, content, answers) };
  } catch (e) {
    if (e instanceof NeedInput) return { status: 'awaiting-input', request: e.request, partial: e.partial?.instructions ?? [], partialTraces: e.partial?.traces ?? [] };
    return { status: 'blocked', error: e instanceof Error ? e.message : String(e) };
  }
}

import type { ActivationCard, Content, DecisionTrace, GameState, MonsterDefinition, MonsterInstance } from '../domain/schemas';
import { monsterStrike, stunInstruction } from '../combat/monsterAttack';
import { monsterView, selectionDistance } from '../movement/board';
import { statsOfMonster } from '../monsters';
import { planMonsterAction, searchReachable, type ActionPlan, type PathStep } from '../movement/plan';
import { createOracle, NeedInput, type InputAnswer, type InputRequest, type Oracle } from '../oracle';
import { CountingRandom, type RandomSource } from '../random';
import { resolveSpawnPhase, type SpawnReport } from '../spawn/spawn';
import { cloneState, isTerminal, log } from '../state';
import type { VisualAction } from '../visual';
import { discardCard, drawCard, pruneEliminatedTypes, recycleDiscard } from './deck';

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

/** Étapes à jouer sur la table pour une apparition depuis la Spawn Tile : poser les monstres, retirer les autres du jeu. */
export function spawnInstructions(report: SpawnReport, nameOf: (id: string) => string): PhysicalInstruction[] {
  return [
    ...report.placed.map((p): PhysicalInstruction => ({
      id: `spawn-${p.monsterId}`,
      kind: 'spawn',
      group: 'Apparition des monstres',
      label: `${nameOf(p.monsterId)} apparaît`,
      text: `Placer ${p.monsterId} en (${p.at.x},${p.at.y})${p.adjacent ? ` (Space voisine du jeton ${p.tokenId}, sa Space étant pleine)` : ''}.`,
      actorId: p.monsterId,
      visual: { type: 'place', actorId: p.monsterId, at: p.at },
    })),
    ...report.boxed.map((b): PhysicalInstruction => ({
      id: `box-${b.monsterId}`,
      kind: 'spawn',
      group: 'Apparition des monstres',
      label: `${nameOf(b.monsterId)} est retiré du jeu`,
      text: `Retirer ${b.monsterId} définitivement du jeu (${b.reason}).`,
      actorId: b.monsterId,
      visual: { type: 'remove', actorId: b.monsterId },
    })),
  ];
}

/** Cases où un monstre à distance peut se replier après son tir : plus loin des héros que sa case actuelle. */
function retreatPlan(s: GameState, monsterId: string, mp: number): ActionPlan | null {
  const m = s.monsters.find((x) => x.id === monsterId);
  const heroes = s.heroes.filter((h) => !h.dead && h.position);
  if (!m?.position || mp <= 0 || heroes.length === 0) return null;
  const nearest = (p: { x: number; y: number }) => Math.min(...heroes.map((h) => selectionDistance(p, h.position!)));
  const here = nearest(m.position);
  type SearchNode = ReturnType<typeof searchReachable>[number];
  let best: SearchNode | null = null;
  for (const n of searchReachable(s, monsterId, m.position, mp)) {
    if (!n.step || !monsterView(s, n.pos, monsterId).canEnd) continue;
    const d = nearest(n.pos);
    const bd = best ? nearest(best.pos) : here;
    if (d > bd || (best && d === bd && n.cost < best.cost)) best = n;
  }
  if (!best) return null;
  const steps: PathStep[] = [];
  for (let n: SearchNode | null = best; n && n.step; n = n.prev) steps.unshift(n.step);
  return { monsterId, targetId: null, steps, destination: best.pos, mpUsed: best.cost, canAttack: false, evaluations: [], explanation: ['Se replie après son tir.'] };
}

/**
 * Une activation, jouée comme le ferait un joueur humain : on tire des cartes jusqu'à tomber sur un type de monstre dont une
 * figurine peut agir (pas encore activée ce tour, pas un garde), on active celle qui atteint le plus facilement un héros, elle
 * utilise TOUT son mouvement : se déplace puis attaque, ou, si elle tire déjà sur un héros à distance, attaque puis se replie.
 */
function activateOne(
  s: GameState,
  content: Content,
  oracle: Oracle,
  rng: RandomSource,
  n: 1 | 2,
  out: MonsterTurnResult,
  activated: Set<string>,
): void {
  const tag = `R${s.round}-A${n}`;
  const group = `Activation ${n}`;
  const explanation: string[] = [];
  const rejected: { entityId: string; reason: string }[] = [];
  const trace: DecisionTrace = {
    decisionId: `${tag}-select`,
    ruleIds: ['RULE-SOLO-009', 'RULE-SOLO-010', 'RULE-SOLO-011', 'RULE-SOLO-014'],
    summary: '',
    explanation,
    candidates: [],
    rejectedCandidates: rejected,
  };
  const candidatesOf = (defId: string) => s.monsters.filter((m) => m.status === 'board' && m.position && m.definitionId === defId && !m.isGuard && !activated.has(m.id));

  // Carte d'activation ; les cartes Wild Pet modifient la cible de la prochaine activation (Pets). Une carte dont aucune
  // figurine ne peut agir est défaussée et on en pioche une autre : il y a toujours deux monstres activés par tour.
  let card: ActivationCard | null = null;
  let def: MonsterDefinition | undefined;
  let candidates: MonsterInstance[] = [];
  for (let tries = s.deck.draw.length + s.deck.discard.length + 1; tries > 0; tries--) {
    let c = drawCard(s, rng, oracle.cardPick());
    while (c.kind === 'wild-pet') {
      discardCard(s, c);
      if (s.nextActivationTargetsPet) recycleDiscard(s, rng, 'deux cartes Wild Pet consécutives');
      s.nextActivationTargetsPet = true;
      log(s, 'wild-pet', 'Carte Wild Pet : le prochain monstre vise le familier le plus proche.');
      c = drawCard(s, rng, oracle.cardPick());
    }
    const d = content.monsters[c.monsterDefId!];
    if (!d) throw new Error(`Monstre inconnu : ${c.monsterDefId}`);
    const cands = candidatesOf(d.id);
    if (cands.length > 0) {
      card = c;
      def = d;
      candidates = cands;
      break;
    }
    explanation.push(`Carte ${d.name} : aucune figurine disponible, on en pioche une autre.`);
    discardCard(s, c);
  }
  if (!card || !def) {
    out.instructions.push({ id: `${tag}-none`, kind: 'info', group, label: 'Aucun monstre ne peut agir', text: `Activation ${n} : aucun monstre disponible.` });
    trace.summary = `Activation ${n} : aucun monstre disponible.`;
    out.traces.push(trace);
    log(s, 'activation', trace.summary, {}, trace);
    return;
  }
  const targetsPet = s.nextActivationTargetsPet && s.pets.some((p) => !p.dead && p.position);
  s.nextActivationTargetsPet = false;
  explanation.unshift(`La carte révélée demande : ${def.name}.`);
  trace.candidates = candidates.map((m) => m.id);
  const kind: 'hero' | 'pet' = targetsPet ? 'pet' : 'hero';
  const monsterName = def.name;

  // Comme un joueur : on active la figurine qui peut attaquer au plus vite (sans saisie : les égalités sont tranchées après).
  const stat = (m: MonsterInstance) => statsOfMonster(content, s, m)!;
  const scored = candidates.map((m) => {
    const p = planMonsterAction(s, content, m.id, stat(m).movement, { targetKind: kind, choose: (_q, o) => o[0]! });
    const cost = p.evaluations.reduce<number>((acc, e) => (e.cost === null ? acc : Math.min(acc, e.cost)), Infinity);
    return { m, rank: (p.canAttack ? 0 : 1000) + cost };
  });
  const bestRank = Math.min(...scored.map((x) => x.rank));
  const tied = scored.filter((x) => x.rank === bestRank).map((x) => x.m.id).sort();
  const chosenId = tied.length > 1 ? oracle.choose(`Départager les ${monsterName} à égalité`, tied) : tied[0]!;
  if (tied.length > 1) explanation.push(`Égalité entre ${tied.join(', ')} : ${chosenId} choisi (${s.settings.tiePolicy}).`);
  for (const r of scored) if (r.m.id !== chosenId) rejected.push({ entityId: r.m.id, reason: 'moins bien placé pour attaquer' });
  trace.selectedEntityId = chosenId;
  activated.add(chosenId);
  const monster = s.monsters.find((m) => m.id === chosenId)!;
  const mstats = stat(monster);
  out.instructions.push({
    id: `${tag}-select`,
    kind: 'info',
    group,
    label: `${monsterName} est activé`,
    text: `${monsterName} ${chosenId} est activé.`,
    actorId: chosenId,
    visual: { type: 'activate', actorId: chosenId, at: { ...monster.position! } },
  });

  const plan = planMonsterAction(s, content, chosenId, mstats.movement, {
    targetKind: kind,
    choose: (purpose, options) => oracle.choose(purpose, options),
  });
  explanation.push(...plan.explanation);
  trace.ruleIds.push('RULE-SOLO-012');

  const doMove = (p: ActionPlan, label: string): void => {
    const openedDoorIds: string[] = [];
    for (const st of p.steps) {
      if (st.kind === 'open-door') {
        const d = s.board.doors.find((x) => x.id === st.doorId);
        if (d) d.open = true;
        if (st.doorId) openedDoorIds.push(st.doorId);
      }
    }
    const from = monster.position!;
    monster.position = { ...p.destination };
    if (!p.steps.length) return;
    const path = [from, ...p.steps.map((st) => st.to)];
    out.instructions.push({
      id: `${tag}-move`,
      kind: 'move',
      group,
      label,
      text: describePlan(p, `${monsterName} ${chosenId} (depuis (${from.x},${from.y}))`).join('\n'),
      actorId: chosenId,
      path,
      visual: { type: 'move', actorId: chosenId, path, doorIds: openedDoorIds },
    });
    log(s, 'monster-move', `${chosenId} → (${p.destination.x},${p.destination.y}) en ${p.mpUsed} PM`, { plan: p.steps });
  };

  const doAttack = (): void => {
    // Point d'entrée unique de l'attaque d'un monstre : applique ses compétences (relances, critiques, Troll, Spear, étourdi).
    const results = monsterStrike(s, content, oracle, chosenId, plan.targetId!, { purpose: `${monsterName} ${chosenId} attaque ${plan.targetId}`, cause: `attaque de ${chosenId}` });
    // Une cible : id et texte habituels ; plusieurs (Troll) : une étape par héros ciblé, suffixée de son identifiant.
    const multi = results.length > 1;
    for (const r of results) {
      const outcome = r.outcome;
      const extra = outcome.extraWounds ? ` (dont ${outcome.extraWounds} de critique)` : '';
      out.instructions.push({
        id: multi ? `${tag}-attack-${r.targetId}` : `${tag}-attack`,
        kind: 'attack',
        group,
        label: `${monsterName} attaque`,
        text:
          `${monsterName} ${chosenId} attaque ${r.targetId} : ${outcome.hits} coup(s), ${outcome.saves} sauvegarde(s) → ` +
          `${outcome.wounds} blessure(s)${extra}.`,
        visual: { type: 'attack', attackerId: chosenId, targetId: r.targetId, wounds: outcome.wounds },
      });
      if (r.stunned) out.instructions.push({ ...stunInstruction(`${tag}-stun-${r.targetId}`, r), group });
      log(s, 'monster-attack', `${chosenId} → ${r.targetId} : ${outcome.hits}/${outcome.saves} → ${outcome.wounds}`, {
        attackFaces: outcome.attackFaces,
        defenseFaces: outcome.defenseFaces,
      });
    }
  };

  let retreated = false;
  if (plan.canAttack && plan.targetId) {
    if (mstats.attackType === 'ranged' && plan.steps.length === 0) {
      // Il voit déjà sa cible : il tire d'abord, puis utilise son mouvement pour se replier.
      doAttack();
      const back = retreatPlan(s, chosenId, mstats.movement);
      if (back) {
        retreated = true;
        explanation.push(...back.explanation);
        doMove(back, `${monsterName} se replie`);
      }
    } else {
      doMove(plan, `${monsterName} avance`);
      doAttack();
    }
  } else {
    doMove(plan, `${monsterName} avance`);
    if (plan.targetId) explanation.push(`${chosenId} ne peut pas atteindre ${plan.targetId} ce tour-ci.`);
  }
  trace.summary = `Activation ${n} : ${chosenId} (${monsterName}) ${plan.canAttack ? `attaque ${plan.targetId}${retreated ? ' puis se replie' : ''}` : plan.steps.length ? 'avance sans pouvoir attaquer' : 'reste en place'}.`;
  out.traces.push(trace);
  log(s, 'activation', trace.summary, { card: card.id }, trace);
  discardCard(s, card);
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
    out.instructions.push(...spawnInstructions(report, nameOf));

    const activated = new Set<string>();
    for (const n of [1, 2] as const) {
      s.phase = n === 1 ? 'MONSTER_TURN_ACTIVATION_1' : 'MONSTER_TURN_ACTIVATION_2';
      activateOne(s, content, oracle, rng, n, out, activated);
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

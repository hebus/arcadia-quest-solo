import { type } from 'arktype';
import type { PhysicalInstruction } from '../activation/monsterTurn';
import { PositionSchema, type GameState, type Position } from '../domain/schemas';
import { CELL_CAPACITY } from '../movement/board';
import { drawEvent, occupants } from './events';
import type { MonsterDefinition } from '../domain/schemas';
import { CountingRandom } from '../random';
import { availableRewards, drawReward, rewardById, type RewardCard } from '../rewards';
import { cloneState, completeQuest, isTerminal, log } from '../state';

/**
 * Moteur de scénario scripté : le maître de jeu. Après chaque action, les règles « quand… alors… » sont évaluées ;
 * celles dont toutes les conditions sont vraies se déclenchent une seule fois (récit, quête validée, renfort, porte).
 */

export const ConditionSchema = type({ type: "'hero-on'", at: PositionSchema })
  .or({ type: "'door-open'", doorId: 'string' })
  .or({ type: "'monster-down'", monsterId: 'string' })
  .or({ type: "'quest-done'", questId: 'string' })
  .or({ type: "'round-reached'", round: 'number.integer > 0' })
  /** Au moins `count` monstres hors du plateau (abattus), tous types ou d'un type donné. */
  .or({ type: "'monsters-down'", count: 'number.integer > 0', 'definitionId?': 'string | undefined' })
  /** Au moins `count` héros vivants (tous les héros vivants par défaut) sur les cases données : une zone de sortie, de ralliement. */
  .or({ type: "'heroes-on'", cells: PositionSchema.array(), 'count?': 'number.integer > 0 | undefined' });
export type Condition = typeof ConditionSchema.infer;

const BeatToneSchema = type("'story' | 'quest' | 'danger' | 'reward'");
export type BeatTone = typeof BeatToneSchema.infer;

export const EffectSchema = type({ type: "'narrate'", 'title?': 'string | undefined', text: 'string', 'tone?': BeatToneSchema.or('undefined') })
  .or({ type: "'complete-quest'", questId: 'string', 'text?': 'string | undefined' })
  .or({ type: "'spawn'", monsterId: 'string', definitionId: 'string', at: PositionSchema })
  .or({ type: "'open-door'", doorId: 'string' })
  /** Carte Récompense : une carte précise (identifiant) ou « random » (tirée au hasard parmi celles qui restent dans la boîte). */
  .or({ type: "'reward'", card: 'string', 'text?': 'string | undefined' })
  /** Événement aléatoire : un tirage parmi ceux qui peuvent se produire (renfort, alarme, bourse…), différent à chaque partie. */
  .or({ type: "'random-event'" });
export type Effect = typeof EffectSchema.infer;

export const RuleSchema = type({
  id: 'string',
  /** Toutes les conditions doivent être vraies en même temps. */
  when: ConditionSchema.array(),
  then: EffectSchema.array(),
});
export type Rule = typeof RuleSchema.infer;

/** Moment de récit à montrer au joueur (le journal en garde une trace). */
export interface StoryBeat {
  id: string;
  title?: string;
  text: string;
  tone: BeatTone;
}

export interface ScriptResult {
  state: GameState;
  beats: StoryBeat[];
  instructions: PhysicalInstruction[];
}

const same = (a: Position, b: Position) => a.x === b.x && a.y === b.y;
const MAX_PASSES = 8;
/** Valeur de `card` pour une récompense tirée au hasard. */
export const RANDOM_REWARD = 'random';

export function holds(c: Condition, s: GameState): boolean {
  switch (c.type) {
    case 'hero-on':
      return s.heroes.some((h) => !h.dead && h.position !== null && same(h.position, c.at));
    case 'door-open':
      return s.board.doors.some((d) => d.id === c.doorId && d.open);
    case 'monster-down': {
      const m = s.monsters.find((x) => x.id === c.monsterId);
      return !!m && m.status !== 'board';
    }
    case 'quest-done':
      return s.quests.some((q) => q.id === c.questId && q.done);
    case 'round-reached':
      return s.round >= c.round;
    case 'monsters-down':
      return s.monsters.filter((m) => (!c.definitionId || m.definitionId === c.definitionId) && m.status !== 'board').length >= c.count;
    case 'heroes-on': {
      const alive = s.heroes.filter((h) => !h.dead);
      const there = alive.filter((h) => h.position !== null && c.cells.some((x) => same(h.position!, x))).length;
      return alive.length > 0 && there >= Math.min(c.count ?? alive.length, alive.length);
    }
  }
}

function apply(rule: Rule, e: Effect, s: GameState, out: { beats: StoryBeat[]; instructions: PhysicalInstruction[] }, n: number, rewards: readonly RewardCard[], monsters: Record<string, MonsterDefinition>): void {
  const tag = `script-${rule.id}-${n}`;
  switch (e.type) {
    case 'narrate':
      out.beats.push({ id: tag, ...(e.title ? { title: e.title } : {}), text: e.text, tone: e.tone ?? 'story' });
      log(s, 'story', e.text, { rule: rule.id });
      break;
    case 'complete-quest': {
      const q = s.quests.find((x) => x.id === e.questId);
      if (!q || q.done) break;
      completeQuest(s, e.questId);
      out.beats.push({ id: tag, title: q.title, text: e.text ?? 'Quête accomplie.', tone: 'quest' });
      break;
    }
    case 'spawn': {
      if (s.monsters.some((m) => m.id === e.monsterId)) break;
      if (occupants(s, e.at) >= CELL_CAPACITY) {
        log(s, 'script-skipped', `Renfort ${e.monsterId} annulé : case pleine.`, { rule: rule.id });
        break;
      }
      s.monsters.push({ id: e.monsterId, definitionId: e.definitionId, position: { ...e.at }, status: 'board', isGuard: false, wounds: 0 });
      log(s, 'script-spawn', `Renfort : ${e.monsterId} apparaît.`, { rule: rule.id, at: e.at });
      out.instructions.push({
        id: tag,
        kind: 'spawn',
        text: `Renfort : placer ${e.monsterId}.`,
        actorId: e.monsterId,
        visual: { type: 'place', actorId: e.monsterId, at: { ...e.at } },
      });
      break;
    }
    case 'reward': {
      const owned = (s.rewards ?? []).map((r) => r.cardId);
      let cardId: string | undefined = e.card;
      if (e.card === RANDOM_REWARD) {
        const rng = new CountingRandom(s.rngSeed, s.rngCounter);
        cardId = drawReward(rewards, owned, rng);
        s.rngCounter = rng.counter;
      }
      const card = cardId && availableRewards(rewards, owned).includes(cardId) ? rewardById(rewards, cardId) : undefined;
      if (!card) {
        log(s, 'script-skipped', 'Récompense : plus aucune carte disponible dans la boîte.', { rule: rule.id });
        break;
      }
      s.rewards = [...(s.rewards ?? []), { cardId: card.id, ruleId: rule.id }];
      log(s, 'reward', `Récompense : ${card.name} (${card.id}).`, { rule: rule.id, cardId: card.id });
      out.beats.push({ id: tag, title: `Récompense : ${card.name}`, text: `${e.text ? `${e.text} ` : ''}${card.type}. ${card.effect} Prenez la carte (${card.id}) et donnez-la à un héros.`, tone: 'reward' });
      break;
    }
    case 'random-event': {
      const rng = new CountingRandom(s.rngSeed, s.rngCounter);
      const ev = drawEvent({ s, rng, monsters, rewards, tag, ruleId: rule.id });
      s.rngCounter = rng.counter;
      if (!ev) {
        log(s, 'script-skipped', 'Événement : rien ne peut se produire.', { rule: rule.id });
        break;
      }
      out.beats.push({ id: tag, title: ev.title, text: ev.text, tone: ev.tone });
      out.instructions.push(...ev.instructions);
      break;
    }
    case 'open-door': {
      const d = s.board.doors.find((x) => x.id === e.doorId);
      if (!d || d.open) break;
      d.open = true;
      log(s, 'script-door', `La porte ${e.doorId} s'ouvre.`, { rule: rule.id });
      out.instructions.push({ id: tag, kind: 'info', text: `Ouvrir la porte ${e.doorId}.`, visual: { type: 'door', doorId: e.doorId, open: true } });
      break;
    }
  }
}

/**
 * Évalue le script sur un état et renvoie l'état résultant (nouveau clone s'il se passe quelque chose), les moments
 * de récit et les actions physiques à montrer. Les déclenchements en cascade (une quête validée qui en débloque une autre)
 * sont traités jusqu'à stabilité. Pur : la partie en cours n'est pas modifiée.
 */
export function runScript(state: GameState, rules: readonly Rule[], rewards: readonly RewardCard[] = [], monsters: Record<string, MonsterDefinition> = {}): ScriptResult {
  const none: ScriptResult = { state, beats: [], instructions: [] };
  if (rules.length === 0 || state.phase === 'SCENARIO_SETUP' || isTerminal(state.phase)) return none;
  let s = state;
  let cloned = false;
  const out = { beats: [] as StoryBeat[], instructions: [] as PhysicalInstruction[] };
  const fired = new Set(state.scriptFired ?? []);
  let counter = 0;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let progressed = false;
    for (const rule of rules) {
      if (fired.has(rule.id) || !rule.when.every((c) => holds(c, s))) continue;
      if (!cloned) {
        s = cloneState(s);
        cloned = true;
      }
      fired.add(rule.id);
      progressed = true;
      for (const e of rule.then) {
        if (isTerminal(s.phase)) break;
        apply(rule, e, s, out, counter++, rewards, monsters);
      }
      s.scriptFired = [...fired];
      if (isTerminal(s.phase)) break;
    }
    if (!progressed || isTerminal(s.phase)) break;
  }
  return cloned ? { state: s, ...out } : none;
}

/** Références du script vérifiées contre le scénario : renvoie la liste des problèmes. */
export function validateScript(
  rules: readonly Rule[],
  ctx: { questIds: string[]; doorIds: string[]; monsterIds: string[]; knownDefinitions: (id: string) => boolean; playable: (p: Position) => boolean; rewards?: readonly RewardCard[] },
): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const spawned = new Set<string>();
  for (const r of rules) {
    if (ids.has(r.id)) problems.push(`Script : règle en double « ${r.id} »`);
    ids.add(r.id);
    if (r.when.length === 0) problems.push(`Script « ${r.id} » : aucune condition`);
    if (r.then.length === 0) problems.push(`Script « ${r.id} » : aucun effet`);
    for (const e of r.then) if (e.type === 'spawn') spawned.add(e.monsterId);
  }
  const monsters = new Set([...ctx.monsterIds, ...spawned]);
  for (const r of rules) {
    for (const c of r.when) {
      if (c.type === 'hero-on' && !ctx.playable(c.at)) problems.push(`Script « ${r.id} » : case hors du plateau`);
      if (c.type === 'monsters-down' && c.definitionId && !ctx.knownDefinitions(c.definitionId)) problems.push(`Script « ${r.id} » : monstre inconnu ${c.definitionId}`);
      if (c.type === 'heroes-on' && (c.cells.length === 0 || c.cells.some((p) => !ctx.playable(p)))) problems.push(`Script « ${r.id} » : zone de ralliement vide ou hors du plateau`);
      if (c.type === 'door-open' && !ctx.doorIds.includes(c.doorId)) problems.push(`Script « ${r.id} » : porte inconnue ${c.doorId}`);
      if (c.type === 'monster-down' && !monsters.has(c.monsterId)) problems.push(`Script « ${r.id} » : monstre inconnu ${c.monsterId}`);
      if (c.type === 'quest-done' && !ctx.questIds.includes(c.questId)) problems.push(`Script « ${r.id} » : quête inconnue ${c.questId}`);
    }
    for (const e of r.then) {
      if (e.type === 'complete-quest' && !ctx.questIds.includes(e.questId)) problems.push(`Script « ${r.id} » : quête inconnue ${e.questId}`);
      if (e.type === 'reward' && e.card !== RANDOM_REWARD && ctx.rewards && !ctx.rewards.some((c) => c.id === e.card)) problems.push(`Script « ${r.id} » : carte Récompense inconnue ${e.card}`);
      if (e.type === 'open-door' && !ctx.doorIds.includes(e.doorId)) problems.push(`Script « ${r.id} » : porte inconnue ${e.doorId}`);
      if (e.type === 'spawn') {
        if (!ctx.knownDefinitions(e.definitionId)) problems.push(`Script « ${r.id} » : monstre inconnu ${e.definitionId}`);
        if (!ctx.playable(e.at)) problems.push(`Script « ${r.id} » : renfort hors du plateau`);
        if (ctx.monsterIds.includes(e.monsterId)) problems.push(`Script « ${r.id} » : identifiant déjà pris ${e.monsterId}`);
      }
    }
  }
  return problems;
}

import type { PhysicalInstruction } from '../activation/monsterTurn';
import type { GameState, MonsterDefinition, Position } from '../domain/schemas';
import { boxRemaining } from '../figurines';
import { monsterStats } from '../monsters';
import { CELL_CAPACITY } from '../movement/board';
import type { RandomSource } from '../random';
import { availableRewards, drawReward, rewardById, type RewardCard } from '../rewards';
import { log } from '../state';

/**
 * Événements aléatoires : de la surprise quand on rejoue un scénario. Une règle de script `random-event` en tire un au sort
 * avec le hasard de la partie (donc différent à chaque partie) parmi ceux qui peuvent se produire sur le plateau du moment ;
 * un même événement ne se produit qu'une fois par partie. Les effets sont ceux que l'application suit vraiment : renforts
 * (dans les limites des boîtes), portes, pièces, cartes Récompense, gardes.
 */

export type EventTone = 'story' | 'danger' | 'reward';

export interface EventContext {
  s: GameState;
  rng: RandomSource;
  monsters: Record<string, MonsterDefinition>;
  rewards: readonly RewardCard[];
  /** Identifiant de base pour les instructions. */
  tag: string;
  ruleId: string;
}

export interface EventOutcome {
  title: string;
  text: string;
  tone: EventTone;
  instructions: PhysicalInstruction[];
}

interface RandomEvent {
  id: string;
  weight: number;
  /** Renvoie l'application de l'événement s'il peut se produire maintenant, sinon null. */
  plan(ctx: EventContext): (() => EventOutcome) | null;
}

const same = (a: Position, b: Position) => a.x === b.x && a.y === b.y;

export const occupants = (s: GameState, at: Position): number =>
  s.heroes.filter((h) => !h.dead && h.position && same(h.position, at)).length +
  s.monsters.filter((m) => m.status === 'board' && m.position && same(m.position, at)).length +
  s.pets.filter((p) => !p.dead && p.position && same(p.position, at)).length;

const WEIGHT: Record<string, number> = { OM: 4, OC: 2, GA: 2, SB: 1, HB: 1 };

/** Les types qu'un renfort peut être : pas un vilain, avec une fiche au niveau de la partie et une figurine libre dans la boîte. */
function reinforcementTypes(ctx: EventContext, already: Map<string, number> = new Map()): MonsterDefinition[] {
  const inPlay = new Map<string, number>(already);
  for (const m of ctx.s.monsters) if (m.status === 'board' || m.status === 'spawn-tile') inPlay.set(m.definitionId, (inPlay.get(m.definitionId) ?? 0) + 1);
  return Object.values(ctx.monsters).filter((d) => d.kind !== 'villain' && monsterStats(d, ctx.s.monsterCardSet) && boxRemaining(d, ctx.monsters, inPlay) > 0);
}

function drawType(ctx: EventContext, pool: MonsterDefinition[]): MonsterDefinition {
  const total = pool.reduce((n, d) => n + (WEIGHT[d.id] ?? 1), 0);
  let draw = ctx.rng.nextInt(1, total);
  return pool.find((d) => (draw -= WEIGHT[d.id] ?? 1) <= 0) ?? pool[0]!;
}

const freeSpawnCells = (ctx: EventContext): Position[] => ctx.s.spawnPoints.map((p) => p.at).filter((at) => occupants(ctx.s, at) < CELL_CAPACITY);

function placeMonster(ctx: EventContext, def: MonsterDefinition, at: Position, n: number): PhysicalInstruction {
  let k = 1;
  while (ctx.s.monsters.some((m) => m.id === `${def.id}E${k}`)) k++;
  const id = `${def.id}E${k}`;
  ctx.s.monsters.push({ id, definitionId: def.id, position: { ...at }, status: 'board', isGuard: false, wounds: 0 });
  log(ctx.s, 'script-spawn', `Événement : ${id} (${def.name}) apparaît.`, { rule: ctx.ruleId, at });
  return { id: `${ctx.tag}-${n}`, kind: 'spawn', text: `Renfort : placer ${def.name} (${id}).`, actorId: id, visual: { type: 'place', actorId: id, at: { ...at } } };
}

const pickOne = <T>(rng: RandomSource, list: readonly T[]): T => list[rng.nextInt(0, list.length - 1)]!;

const EVENTS: RandomEvent[] = [
  {
    id: 'renfort',
    weight: 5,
    plan(ctx) {
      const types = reinforcementTypes(ctx);
      const cells = freeSpawnCells(ctx);
      if (types.length === 0 || cells.length === 0) return null;
      return () => {
        const def = drawType(ctx, types);
        const at = pickOne(ctx.rng, cells);
        return { title: 'Des renforts !', text: `Un cri retentit : ${def.name} accourt sur le jeton Spawn le plus proche.`, tone: 'danger', instructions: [placeMonster(ctx, def, at, 0)] };
      };
    },
  },
  {
    id: 'embuscade',
    weight: 2,
    plan(ctx) {
      const cells = freeSpawnCells(ctx);
      if (cells.length < 2 || reinforcementTypes(ctx).length === 0) return null;
      return () => {
        const first = pickOne(ctx.rng, cells);
        const second = pickOne(ctx.rng, cells.filter((c) => !same(c, first)));
        const used = new Map<string, number>();
        const out: PhysicalInstruction[] = [];
        for (const [i, at] of [first, second].entries()) {
          const pool = reinforcementTypes(ctx, used);
          if (pool.length === 0) break;
          const def = drawType(ctx, pool);
          out.push(placeMonster(ctx, def, at, i));
        }
        return { title: 'Embuscade !', text: 'Des ombres jaillissent des ruelles : l’ennemi vous prend à revers.', tone: 'danger', instructions: out };
      };
    },
  },
  {
    id: 'alarme',
    weight: 3,
    plan(ctx) {
      const closed = ctx.s.board.doors.filter((d) => !d.open && !d.special);
      if (closed.length === 0) return null;
      return () => {
        const door = pickOne(ctx.rng, closed);
        door.open = true;
        log(ctx.s, 'script-door', `Événement : la porte ${door.id} s'ouvre.`, { rule: ctx.ruleId });
        return {
          title: 'L’alarme !',
          text: 'Une cloche sonne : une porte s’ouvre à la volée et le quartier s’éveille.',
          tone: 'danger',
          instructions: [{ id: `${ctx.tag}-0`, kind: 'info', text: `Ouvrir la porte ${door.id}.`, visual: { type: 'door', doorId: door.id, open: true } }],
        };
      };
    },
  },
  {
    id: 'porte-claque',
    weight: 2,
    plan(ctx) {
      const open = ctx.s.board.doors.filter((d) => d.open && !d.special);
      if (open.length === 0) return null;
      return () => {
        const door = pickOne(ctx.rng, open);
        door.open = false;
        log(ctx.s, 'script-door', `Événement : la porte ${door.id} se referme.`, { rule: ctx.ruleId });
        return {
          title: 'La porte claque',
          text: 'Un courant d’air : une porte se referme violemment derrière vous.',
          tone: 'story',
          instructions: [{ id: `${ctx.tag}-0`, kind: 'info', text: `Fermer la porte ${door.id}.`, visual: { type: 'door', doorId: door.id, open: false } }],
        };
      };
    },
  },
  {
    id: 'bourse',
    weight: 3,
    plan() {
      return () => ({ title: 'Une bourse oubliée', text: 'Dans la poussière, une bourse que personne n’a réclamée : +1 pièce pour la guilde.', tone: 'reward', instructions: [] });
    },
    // la pièce est ajoutée par `drawEvent` (voir plus bas), après le tirage
  },
  {
    id: 'butin',
    weight: 1,
    plan(ctx) {
      const owned = (ctx.s.rewards ?? []).map((r) => r.cardId);
      if (availableRewards(ctx.rewards, owned).length === 0) return null;
      return () => {
        const id = drawReward(ctx.rewards, owned, ctx.rng)!;
        const card = rewardById(ctx.rewards, id)!;
        ctx.s.rewards = [...(ctx.s.rewards ?? []), { cardId: id, ruleId: ctx.ruleId }];
        log(ctx.s, 'reward', `Récompense : ${card.name} (${id}).`, { rule: ctx.ruleId, cardId: id });
        return { title: `Un butin : ${card.name}`, text: `Un cadavre serrait encore une arme. ${card.type}. ${card.effect} Prenez la carte (${id}) et donnez-la à un héros.`, tone: 'reward', instructions: [] };
      };
    },
  },
  {
    id: 'reveil',
    weight: 2,
    plan(ctx) {
      if (!ctx.s.monsters.some((m) => m.status === 'board' && m.isGuard)) return null;
      return () => {
        for (const m of ctx.s.monsters) if (m.status === 'board') m.isGuard = false;
        log(ctx.s, 'script-event', 'Événement : les gardes quittent leur poste.', { rule: ctx.ruleId });
        return { title: 'Les gardes s’éveillent', text: 'Le vacarme a tiré les gardes de leur torpeur : plus aucun ne tient sa place.', tone: 'danger', instructions: [] };
      };
    },
  },
  {
    id: 'accalmie',
    weight: 2,
    plan() {
      return () => ({ title: 'Un calme trompeur', text: 'Le quartier retient son souffle. Rien ne bouge… pour l’instant.', tone: 'story', instructions: [] });
    },
  },
];

export const EVENT_IDS = EVENTS.map((e) => e.id);

/** Tire un événement parmi ceux qui peuvent se produire et ne se sont pas déjà produits, l'applique à l'état, et le décrit. */
export function drawEvent(ctx: EventContext): (EventOutcome & { id: string }) | null {
  const done = new Set(ctx.s.eventsDone ?? []);
  const options = EVENTS.filter((e) => !done.has(e.id)).flatMap((e) => {
    const apply = e.plan(ctx);
    return apply ? [{ e, apply }] : [];
  });
  if (options.length === 0) return null;
  let draw = ctx.rng.nextInt(1, options.reduce((n, o) => n + o.e.weight, 0));
  const chosen = options.find((o) => (draw -= o.e.weight) <= 0) ?? options[0]!;
  const outcome = chosen.apply();
  if (chosen.e.id === 'bourse') ctx.s.coins += 1;
  ctx.s.eventsDone = [...(ctx.s.eventsDone ?? []), chosen.e.id];
  log(ctx.s, 'event', `Événement : ${outcome.title}`, { rule: ctx.ruleId, event: chosen.e.id });
  return { ...outcome, id: chosen.e.id };
}

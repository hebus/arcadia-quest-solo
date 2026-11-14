import type { AttackType, Content, DecisionTrace, GameState, Position } from './domain/schemas';
import type { PhysicalInstruction } from './activation/monsterTurn';
import { resolveAttackRoll, rollPool, type AttackOutcome } from './combat/dice';
import type { RandomSource } from './random';

/** Qui attaque qui, et sur quelles cases au moment de l'attaque : de quoi montrer l'attaque sur le plateau avant d'interroger le joueur. */
export interface AttackEncounter {
  attackerId?: string;
  targetId?: string;
  attackerAt?: Position | null;
  targetAt?: Position | null;
}

export type InputRequest =
  | { kind: 'die'; purpose: string; faces: string[] }
  | { kind: 'card'; purpose: string }
  | { kind: 'choice'; purpose: string; options: string[] }
  | ({ kind: 'attack-result'; purpose: string; attackDice: number; defenseDice: number; /** Chaque critique donne une blessure en plus : demander aussi le nombre de critiques. */ critWounds?: boolean } & AttackEncounter)
  | ({ kind: 'defense-result'; purpose: string; hits: number; defenseDice: number; targetName: string; /** Blessures supplémentaires dues aux critiques : elles ne se parent pas. */ extraWounds?: number } & AttackEncounter);

export type InputAnswer =
  | { kind: 'die'; value: string }
  | { kind: 'card'; value: string }
  | { kind: 'choice'; value: string }
  | { kind: 'attack-result'; hits: number; saves: number; /** Critiques obtenus (seulement si la compétence en tient compte). */ crits?: number }
  | { kind: 'defense-result'; saves: number };

/** Levée quand une saisie physique est nécessaire : l'agent s'arrête proprement, état précédent conservé. */
export class NeedInput extends Error {
  /** Ce que l'agent avait déjà décidé avant de s'arrêter : à montrer dans l'ordre, avant la saisie. */
  partial?: { instructions: PhysicalInstruction[]; traces: DecisionTrace[] };

  constructor(public readonly request: InputRequest) {
    super(`Saisie requise : ${request.purpose}`);
  }
}

export interface AttackContext extends AttackEncounter {
  attackDice: number;
  attackType: AttackType;
  attackerRerolls: number;
  defenseDice: number;
  defenderRerolls: number;
  purpose: string;
  /** Cible humaine : son jet de défense peut être lancé sur la table. */
  defenderIsHero?: boolean;
  targetName?: string;
  /** Compétence « chaque critique donne une blessure supplémentaire » (Minotaur). */
  critWounds?: boolean;
}

/** Une cible d'une attaque qui en vise plusieurs (Troll : tous les héros adjacents). */
export interface AttackTarget {
  targetId: string;
  targetName: string;
  defenseDice: number;
  defenderRerolls: number;
  targetAt?: Position | null;
}

const encounter = (c: AttackEncounter): AttackEncounter => ({ attackerId: c.attackerId, targetId: c.targetId, attackerAt: c.attackerAt ?? null, targetAt: c.targetAt ?? null });

/** Point d'entrée unique des tirages et des choix : numérique (graine) ou physique (saisie du joueur). */
export interface Oracle {
  spawnDie(purpose: string): string;
  /** Carte physique annoncée (« wild-pet » ou id de monstre), ou null en mode numérique. */
  cardPick(): string | null;
  choose(purpose: string, options: string[]): string;
  attack(ctx: AttackContext): AttackOutcome;
  /**
   * Une attaque qui vise plusieurs héros : elle n'est lancée qu'une fois, puis chaque cible se défend contre les mêmes touches
   * (livret, Troll : chaque héros ciblé lance sa défense contre les touches du troll). Un résultat par cible.
   */
  attackMany(ctx: Omit<AttackContext, 'defenseDice' | 'defenderRerolls' | 'targetId' | 'targetAt' | 'targetName' | 'defenderIsHero'>, targets: AttackTarget[]): AttackOutcome[];
}

export function createOracle(
  state: GameState,
  content: Content,
  rng: RandomSource,
  answers: readonly InputAnswer[],
): Oracle {
  let cursor = 0;
  const next = <K extends InputAnswer['kind']>(kind: K, req: InputRequest) => {
    const a = answers[cursor];
    if (!a || a.kind !== kind) throw new NeedInput(req);
    cursor++;
    return a as Extract<InputAnswer, { kind: K }>;
  };
  const symbols = content.attackDie.map((f) => f.symbol);
  /** Résultat saisi à la main : touches, sauvegardes et, pour le Minotaur, critiques (une blessure en plus chacun, non parable). */
  const physicalOutcome = (a: { hits: number; saves: number; crits?: number }, critWounds?: boolean): AttackOutcome => {
    const crits = critWounds ? Math.max(0, Math.min(a.crits ?? 0, a.hits)) : 0;
    const saves = Math.min(a.saves, a.hits);
    return { hits: a.hits, saves, wounds: Math.max(0, a.hits - saves) + crits, crits, extraWounds: crits, attackFaces: [], defenseFaces: [] };
  };
  return {
    spawnDie(purpose) {
      if (state.settings.diceMode === 'digital') return symbols[rng.nextInt(0, symbols.length - 1)]!;
      return next('die', { kind: 'die', purpose, faces: [...new Set(symbols)] }).value;
    },
    cardPick() {
      if (state.settings.cardMode === 'digital') return null;
      return next('card', { kind: 'card', purpose: 'Carte Monster Activation révélée' }).value;
    },
    choose(purpose, options) {
      if (options.length === 1) return options[0]!;
      if (state.settings.tiePolicy === 'stable-id') return [...options].sort()[0]!;
      return next('choice', { kind: 'choice', purpose, options }).value;
    },
    attack(ctx) {
      if (state.settings.diceMode === 'digital' && ctx.defenderIsHero && state.settings.defenseRoll === 'physical') {
        // L'application lance l'attaque du monstre ; le joueur lance la défense avec ses propres dés (leur nombre se gère en physique,
        // il n'est pas connu de l'application) et saisit les coups parés.
        const atk = rollPool(ctx.attackDice, content.attackDie, 'attack', ctx.attackType, ctx.attackerRerolls, rng);
        // Aucune touche : rien à parer, inutile de lancer les dés de défense.
        if (atk.successes === 0) return { hits: 0, saves: 0, wounds: 0, crits: 0, extraWounds: 0, attackFaces: atk.faces, defenseFaces: [] };
        const extraWounds = ctx.critWounds ? atk.crits : 0;
        const d = next('defense-result', {
          kind: 'defense-result',
          purpose: ctx.purpose,
          hits: atk.successes,
          defenseDice: ctx.defenseDice,
          targetName: ctx.targetName ?? '',
          ...(extraWounds ? { extraWounds } : {}),
          ...encounter(ctx),
        });
        const saves = Math.min(d.saves, atk.successes);
        return { hits: atk.successes, saves, wounds: atk.successes - saves + extraWounds, crits: atk.crits, extraWounds, attackFaces: atk.faces, defenseFaces: [] };
      }
      if (state.settings.diceMode === 'digital') {
        return resolveAttackRoll({
          attackDice: ctx.attackDice,
          attackType: ctx.attackType,
          attackerRerolls: ctx.attackerRerolls,
          defenseDice: ctx.defenseDice,
          defenderRerolls: ctx.defenderRerolls,
          attackDie: content.attackDie,
          defenseDie: content.defenseDie,
          rng,
          ...(ctx.critWounds ? { critWounds: true } : {}),
        });
      }
      const a = next('attack-result', {
        kind: 'attack-result',
        purpose: ctx.purpose,
        attackDice: ctx.attackDice,
        defenseDice: ctx.defenseDice,
        ...(ctx.critWounds ? { critWounds: true } : {}),
        ...encounter(ctx),
      });
      return physicalOutcome(a, ctx.critWounds);
    },
    attackMany(ctx, targets) {
      if (state.settings.diceMode === 'digital') {
        // L'attaque n'est lancée qu'une fois ; chaque cible se défend ensuite contre les mêmes touches.
        const atk = rollPool(ctx.attackDice, content.attackDie, 'attack', ctx.attackType, ctx.attackerRerolls, rng);
        const extraWounds = ctx.critWounds ? atk.crits : 0;
        return targets.map((t): AttackOutcome => {
          const base = { hits: atk.successes, crits: atk.crits, attackFaces: atk.faces };
          if (atk.successes === 0) return { ...base, saves: 0, wounds: 0, extraWounds: 0, defenseFaces: [] };
          if (state.settings.defenseRoll === 'physical') {
            const d = next('defense-result', {
              kind: 'defense-result',
              purpose: ctx.purpose,
              hits: atk.successes,
              defenseDice: t.defenseDice,
              targetName: t.targetName,
              ...(extraWounds ? { extraWounds } : {}),
              ...encounter({ ...ctx, targetId: t.targetId, targetAt: t.targetAt ?? null }),
            });
            const saves = Math.min(d.saves, atk.successes);
            return { ...base, saves, wounds: atk.successes - saves + extraWounds, extraWounds, defenseFaces: [] };
          }
          const def = t.defenseDice > 0 ? rollPool(t.defenseDice, content.defenseDie, 'defense', ctx.attackType, t.defenderRerolls, rng) : { faces: [] as string[], successes: 0 };
          return { ...base, saves: def.successes, wounds: Math.max(0, atk.successes - def.successes) + extraWounds, extraWounds, defenseFaces: def.faces };
        });
      }
      // Dés matériels : le joueur saisit le jet d'attaque avec la défense de la 1re cible, puis la défense de chacune des autres.
      const [first, ...rest] = targets;
      if (!first) return [];
      const a = next('attack-result', {
        kind: 'attack-result',
        purpose: ctx.purpose,
        attackDice: ctx.attackDice,
        defenseDice: first.defenseDice,
        ...(ctx.critWounds ? { critWounds: true } : {}),
        ...encounter({ ...ctx, targetId: first.targetId, targetAt: first.targetAt ?? null }),
      });
      const head = physicalOutcome(a, ctx.critWounds);
      const extra = head.extraWounds ?? 0;
      return [
        head,
        ...rest.map((t): AttackOutcome => {
          if (head.hits === 0) return { hits: 0, saves: 0, wounds: 0, crits: head.crits ?? 0, extraWounds: 0, attackFaces: [], defenseFaces: [] };
          const d = next('defense-result', {
            kind: 'defense-result',
            purpose: ctx.purpose,
            hits: head.hits,
            defenseDice: t.defenseDice,
            targetName: t.targetName,
            ...(extra ? { extraWounds: extra } : {}),
            ...encounter({ ...ctx, targetId: t.targetId, targetAt: t.targetAt ?? null }),
          });
          const saves = Math.min(d.saves, head.hits);
          return { hits: head.hits, saves, wounds: head.hits - saves + extra, crits: head.crits ?? 0, extraWounds: extra, attackFaces: [], defenseFaces: [] };
        }),
      ];
    },
  };
}

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
  | ({ kind: 'attack-result'; purpose: string; attackDice: number; defenseDice: number } & AttackEncounter)
  | ({ kind: 'defense-result'; purpose: string; hits: number; defenseDice: number; targetName: string } & AttackEncounter);

export type InputAnswer =
  | { kind: 'die'; value: string }
  | { kind: 'card'; value: string }
  | { kind: 'choice'; value: string }
  | { kind: 'attack-result'; hits: number; saves: number }
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
}

const encounter = (c: AttackEncounter): AttackEncounter => ({ attackerId: c.attackerId, targetId: c.targetId, attackerAt: c.attackerAt ?? null, targetAt: c.targetAt ?? null });

/** Point d'entrée unique des tirages et des choix : numérique (graine) ou physique (saisie du joueur). */
export interface Oracle {
  spawnDie(purpose: string): string;
  /** Carte physique annoncée (« wild-pet » ou id de monstre), ou null en mode numérique. */
  cardPick(): string | null;
  choose(purpose: string, options: string[]): string;
  attack(ctx: AttackContext): AttackOutcome;
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
      if (state.settings.diceMode === 'digital' && ctx.defenderIsHero && state.settings.defenseRoll === 'physical' && ctx.defenseDice > 0) {
        // L'application lance l'attaque du monstre ; le joueur lance la défense et saisit les coups parés.
        const atk = rollPool(ctx.attackDice, content.attackDie, 'attack', ctx.attackType, ctx.attackerRerolls, rng);
        // Aucune touche : rien à parer, inutile de lancer les dés de défense.
        if (atk.successes === 0) return { hits: 0, saves: 0, wounds: 0, attackFaces: atk.faces, defenseFaces: [] };
        const d = next('defense-result', {
          kind: 'defense-result',
          purpose: ctx.purpose,
          hits: atk.successes,
          defenseDice: ctx.defenseDice,
          targetName: ctx.targetName ?? '',
          ...encounter(ctx),
        });
        const saves = Math.min(d.saves, atk.successes);
        return { hits: atk.successes, saves, wounds: atk.successes - saves, attackFaces: atk.faces, defenseFaces: [] };
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
        });
      }
      const a = next('attack-result', {
        kind: 'attack-result',
        purpose: ctx.purpose,
        attackDice: ctx.attackDice,
        defenseDice: ctx.defenseDice,
        ...encounter(ctx),
      });
      return {
        hits: a.hits,
        saves: a.saves,
        wounds: Math.max(0, a.hits - a.saves),
        attackFaces: [],
        defenseFaces: [],
      };
    },
  };
}

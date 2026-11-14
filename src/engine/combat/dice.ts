import type { AttackType, DieFaceDef } from '../domain/schemas';
import type { RandomSource } from '../random';

export interface PoolResult {
  faces: string[];
  /** Nombre de faces critiques obtenues (le critique est aussi compté dans `successes`). */
  crits: number;
  successes: number;
  rerollsUsed: number;
}

const MAX_DICE = 60;

const isSuccess = (f: DieFaceDef, kind: 'attack' | 'defense', type: AttackType): boolean =>
  f.crit || (kind === 'defense' ? f.save : type === 'melee' ? f.melee : f.ranged);

/**
 * Lance un pool de dés. Un CRIT est une réussite et ajoute un dé (récursivement) ; les relances
 * remplacent les dés ratés au mieux (livret de base p.17, p.27 ; solo v1.3 p.6).
 */
export function rollPool(
  count: number,
  die: DieFaceDef[],
  kind: 'attack' | 'defense',
  type: AttackType,
  rerolls: number,
  rng: RandomSource,
): PoolResult {
  const results: DieFaceDef[] = [];
  const roll = () => die[rng.nextInt(0, die.length - 1)]!;
  const add = (n: number) => {
    for (let i = 0; i < n && results.length < MAX_DICE; i++) {
      const f = roll();
      results.push(f);
      if (f.crit) add(1);
    }
  };
  add(count);
  let used = 0;
  while (used < rerolls) {
    const idx = results.findIndex((f) => !isSuccess(f, kind, type));
    if (idx < 0) break;
    const f = roll();
    results[idx] = f;
    used++;
    if (f.crit) add(1);
  }
  return {
    faces: results.map((f) => f.symbol),
    crits: results.filter((f) => f.crit).length,
    successes: results.filter((f) => isSuccess(f, kind, type)).length,
    rerollsUsed: used,
  };
}

export interface AttackOutcome {
  hits: number;
  saves: number;
  wounds: number;
  /** Critiques de l'attaque (sert à la compétence « chaque critique donne une blessure supplémentaire »). */
  crits?: number;
  /** Blessures supplémentaires dues aux critiques, déjà comprises dans `wounds` (non parables). */
  extraWounds?: number;
  attackFaces: string[];
  defenseFaces: string[];
}

export function resolveAttackRoll(p: {
  attackDice: number;
  attackType: AttackType;
  attackerRerolls: number;
  defenseDice: number;
  defenderRerolls: number;
  attackDie: DieFaceDef[];
  defenseDie: DieFaceDef[];
  rng: RandomSource;
  /** Compétence du Minotaur : chaque critique de l'attaque donne une blessure supplémentaire, non parable. */
  critWounds?: boolean;
}): AttackOutcome {
  const atk = rollPool(p.attackDice, p.attackDie, 'attack', p.attackType, p.attackerRerolls, p.rng);
  const def =
    p.defenseDice > 0
      ? rollPool(p.defenseDice, p.defenseDie, 'defense', p.attackType, p.defenderRerolls, p.rng)
      : { faces: [], crits: 0, successes: 0, rerollsUsed: 0 };
  const extraWounds = p.critWounds ? atk.crits : 0;
  return {
    hits: atk.successes,
    saves: def.successes,
    wounds: Math.max(0, atk.successes - def.successes) + extraWounds,
    crits: atk.crits,
    extraWounds,
    attackFaces: atk.faces,
    defenseFaces: def.faces,
  };
}

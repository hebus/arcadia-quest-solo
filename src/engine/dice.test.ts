import { describe, expect, it } from 'vitest';
import { resolveAttackRoll, rollPool } from './combat/dice';
import type { RandomSource } from './random';
import { DEFAULT_ATTACK_DIE, DEFAULT_DEFENSE_DIE } from '@/game-data/dice';

const count = (die: { symbol: string }[], s: string) => die.filter((f) => f.symbol === s).length;

/** Source aléatoire qui fait sortir les faces voulues, dans l'ordre (par symbole). */
const rolling = (die: { symbol: string }[], symbols: string[]): RandomSource => {
  let i = 0;
  return {
    nextInt: () => {
      const wanted = symbols[i++];
      return die.findIndex((f) => f.symbol === wanted);
    },
  };
};

describe('dés de combat (noirs) et de défense (blancs)', () => {
  it('dé noir : 3 épées, 2 arcs, 1 critique, aucune face vide', () => {
    expect(DEFAULT_ATTACK_DIE).toHaveLength(6);
    expect(count(DEFAULT_ATTACK_DIE, 'sword')).toBe(3);
    expect(count(DEFAULT_ATTACK_DIE, 'bow')).toBe(2);
    expect(count(DEFAULT_ATTACK_DIE, 'crit')).toBe(1);
    expect(count(DEFAULT_ATTACK_DIE, 'blank')).toBe(0);
  });

  it('dé blanc : une seule face bouclier, une seule face critique, toutes les autres vides', () => {
    expect(DEFAULT_DEFENSE_DIE).toHaveLength(6);
    expect(count(DEFAULT_DEFENSE_DIE, 'shield')).toBe(1);
    expect(count(DEFAULT_DEFENSE_DIE, 'crit')).toBe(1);
    expect(count(DEFAULT_DEFENSE_DIE, 'blank')).toBe(4);
  });

  it('mêlée : épées et critique touchent, les arcs échouent', () => {
    const r = rollPool(3, DEFAULT_ATTACK_DIE, 'attack', 'melee', 0, rolling(DEFAULT_ATTACK_DIE, ['sword', 'bow', 'bow']));
    expect(r.successes).toBe(1);
    const c = rollPool(1, DEFAULT_ATTACK_DIE, 'attack', 'melee', 0, rolling(DEFAULT_ATTACK_DIE, ['crit', 'bow']));
    expect(c.successes).toBe(1 + 0); // le critique touche ; le dé qu'il ajoute (arc) échoue
    expect(c.faces).toEqual(['crit', 'bow']);
  });

  it('distance : arcs et critique touchent, les épées échouent', () => {
    const r = rollPool(3, DEFAULT_ATTACK_DIE, 'attack', 'ranged', 0, rolling(DEFAULT_ATTACK_DIE, ['bow', 'sword', 'sword']));
    expect(r.successes).toBe(1);
    const c = rollPool(1, DEFAULT_ATTACK_DIE, 'attack', 'ranged', 0, rolling(DEFAULT_ATTACK_DIE, ['crit', 'sword']));
    expect(c.successes).toBe(1);
  });

  it('défense : bouclier ou critique annulent une touche, une face vide non', () => {
    const r = rollPool(3, DEFAULT_DEFENSE_DIE, 'defense', 'melee', 0, rolling(DEFAULT_DEFENSE_DIE, ['shield', 'blank', 'blank']));
    expect(r.successes).toBe(1);
    const c = rollPool(1, DEFAULT_DEFENSE_DIE, 'defense', 'melee', 0, rolling(DEFAULT_DEFENSE_DIE, ['crit', 'blank']));
    expect(c.successes).toBe(1);
    const none = rollPool(2, DEFAULT_DEFENSE_DIE, 'defense', 'melee', 0, rolling(DEFAULT_DEFENSE_DIE, ['blank', 'blank']));
    expect(none.successes).toBe(0);
  });

  it('un monstre qui dispose de dés de défense : les touches moins les boucliers et critiques, jamais négatif', () => {
    const roll = (atk: string[], def: string[], defenseDice: number) =>
      resolveAttackRoll({
        attackDice: atk.length,
        attackType: 'melee',
        attackerRerolls: 0,
        defenseDice,
        defenderRerolls: 0,
        attackDie: DEFAULT_ATTACK_DIE,
        defenseDie: DEFAULT_DEFENSE_DIE,
        rng: sequence(atk, def),
      });
    // 3 touches (épées), 2 boucliers : 1 blessure.
    expect(roll(['sword', 'sword', 'sword'], ['shield', 'shield'], 2)).toMatchObject({ hits: 3, saves: 2, wounds: 1 });
    // 2 touches, un critique en défense (qui ajoute un dé vide) : 1 blessure.
    expect(roll(['sword', 'sword'], ['crit', 'blank'], 1)).toMatchObject({ hits: 2, saves: 1, wounds: 1 });
    // Plus de boucliers que de touches : aucune blessure.
    expect(roll(['sword'], ['shield', 'shield'], 2)).toMatchObject({ wounds: 0 });
  });
});

/** Fait sortir d'abord les faces d'attaque voulues, puis les faces de défense voulues. */
function sequence(atk: string[], def: string[]): RandomSource {
  const wanted = [...atk.map((s) => ({ die: DEFAULT_ATTACK_DIE, s })), ...def.map((s) => ({ die: DEFAULT_DEFENSE_DIE, s }))];
  let i = 0;
  return {
    nextInt: () => {
      const w = wanted[i++]!;
      return w.die.findIndex((f) => f.symbol === w.s);
    },
  };
}

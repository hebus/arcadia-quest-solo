import { describe, expect, it } from 'vitest';
import type { DieFaceDef } from './domain/schemas';
import { createOracle, NeedInput } from './oracle';
import { CountingRandom } from './random';
import { DEFAULT_SETTINGS } from './setup';
import { demoGame, testContent } from '@/tests/fixtures/demo';

const face = (symbol: string, melee: boolean): DieFaceDef => ({ symbol, melee, ranged: false, crit: false, save: false });
const ctx = { attackDice: 3, attackType: 'melee' as const, attackerRerolls: 0, defenseDice: 2, defenderRerolls: 0, purpose: 'x', defenderIsHero: true, targetName: 'Grom' };

/** Partie de test avec dés numériques pour l'attaque du monstre et jet de défense matériel pour le héros. */
const oracleWith = (attackDie: DieFaceDef[], answers: Parameters<typeof createOracle>[3] = []) => {
  const state = demoGame({ settings: { diceMode: 'digital', defenseRoll: 'physical' } });
  return createOracle(state, { ...testContent, attackDie }, new CountingRandom(7), answers);
};

describe('jet de défense du joueur', () => {
  it('par défaut, c’est le joueur humain qui lance ses dés de défense', () => {
    expect(DEFAULT_SETTINGS.defenseRoll).toBe('physical');
  });

  it('l’application tire l’attaque du monstre puis demande les boucliers, avec le nombre de touches', () => {
    const hits = [face('touche', true)]; // chaque dé touche : 3 dés → 3 touches
    try {
      oracleWith(hits).attack(ctx);
      throw new Error('une saisie était attendue');
    } catch (e) {
      expect(e).toBeInstanceOf(NeedInput);
      expect((e as NeedInput).request).toMatchObject({ kind: 'defense-result', hits: 3, defenseDice: 2, targetName: 'Grom' });
    }
  });

  it('chaque bouclier annule une touche : 3 touches, 1 bouclier → 2 blessures', () => {
    const r = oracleWith([face('touche', true)], [{ kind: 'defense-result', saves: 1 }]).attack(ctx);
    expect(r).toMatchObject({ hits: 3, saves: 1, wounds: 2 });
  });

  it('les boucliers en trop ne soignent pas : jamais de blessure négative', () => {
    const r = oracleWith([face('touche', true)], [{ kind: 'defense-result', saves: 9 }]).attack(ctx);
    expect(r).toMatchObject({ hits: 3, saves: 3, wounds: 0 });
  });

  it('aucune touche du monstre : pas de jet de défense à demander', () => {
    const r = oracleWith([face('raté', false)]).attack(ctx);
    expect(r).toMatchObject({ hits: 0, saves: 0, wounds: 0 });
  });

  it('les dés de défense du héros se gèrent en physique : leur nombre est inconnu (0), on demande quand même les boucliers', () => {
    try {
      oracleWith([face('touche', true)]).attack({ ...ctx, defenseDice: 0 });
      throw new Error('une saisie était attendue');
    } catch (e) {
      expect(e).toBeInstanceOf(NeedInput);
      expect((e as NeedInput).request).toMatchObject({ kind: 'defense-result', hits: 3, defenseDice: 0 });
    }
    const r = oracleWith([face('touche', true)], [{ kind: 'defense-result', saves: 2 }]).attack({ ...ctx, defenseDice: 0 });
    expect(r).toMatchObject({ hits: 3, saves: 2, wounds: 1 });
  });

  it('la saisie d’une attaque dit qui attaque qui et où, pour le montrer sur le plateau avant les dés', () => {
    try {
      oracleWith([face('touche', true)]).attack({ ...ctx, attackerId: 'g1', targetId: 'h1', attackerAt: { x: 2, y: 2 }, targetAt: { x: 2, y: 3 } });
      throw new Error('une saisie était attendue');
    } catch (e) {
      expect((e as NeedInput).request).toMatchObject({ kind: 'defense-result', attackerId: 'g1', targetId: 'h1', attackerAt: { x: 2, y: 2 }, targetAt: { x: 2, y: 3 } });
    }
  });
});

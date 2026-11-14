import { describe, expect, it } from 'vitest';
import {
  applyUpgradePhase,
  assertCanPlay,
  createCampaign,
  currentStage,
  drawDeathCurses,
  finishScenario,
  monsterCardSetFor,
  upgradeRevealCount,
} from './campaign';
import { applyCorrection } from './corrections';
import { completeQuest } from './state';
import { createSeededRandom } from './random';
import { startScenario } from './turn/machine';
import { demoGame } from '@/tests/fixtures/demo';

const fresh = () => createCampaign({ id: 'c', name: 'Test', contentVersion: 'v', heroIds: ['h1', 'h2', 'h3'] });

describe('campagne', () => {
  it('phase d amélioration solo : 8 cartes + 3 par tranche de 5 pièces, 6 en cas de défaite', () => {
    expect(upgradeRevealCount(true, 0)).toBe(8);
    expect(upgradeRevealCount(true, 4)).toBe(8);
    expect(upgradeRevealCount(true, 5)).toBe(11);
    expect(upgradeRevealCount(true, 12)).toBe(14);
    expect(upgradeRevealCount(false, 30)).toBe(6);
  });

  it('victoire : les pièces des quêtes sont comptées et la campagne avance', () => {
    let g = startScenario(demoGame());
    g.coins = 3;
    completeQuest(g, 'q1');
    completeQuest(g, 'q2');
    g = { ...g };
    expect(g.phase).toBe('SCENARIO_WON');
    const c = finishScenario(fresh(), g);
    expect(c.results).toHaveLength(1);
    expect(c.results[0]!.coinsWon).toBe(5);
    expect(c.pendingUpgrade?.revealCount).toBe(11);
    expect(() => assertCanPlay(c, 'x', 'outer')).toThrow(/amélioration/);
  });

  it('achats : 3 maximum, pièces suffisantes, 1 pièce économisable, 12 cartes maximum', () => {
    const g = startScenario(demoGame());
    g.deaths = 9;
    g.phase = 'SCENARIO_LOST';
    g.coins = 4;
    let c = finishScenario(fresh(), g);
    expect(c.pendingUpgrade?.revealCount).toBe(6);
    expect(() => applyUpgradePhase(c, [1, 2, 3, 4].map((n) => ({ card: `c${n}`, cost: 1 })))).toThrow(/3 achats/);
    expect(() => applyUpgradePhase(c, [{ card: 'a', cost: 9 }])).toThrow(/insuffisantes/);
    c = applyUpgradePhase(c, [{ card: 'a', cost: 2 }]);
    expect(c.savedCoin).toBe(1);
    expect(c.cards).toEqual(['a']);
  });

  it('étapes : 3 Outer, 2 Inner, Final ; le jeu de cartes Monster doit être renseigné', () => {
    const c = fresh();
    expect(currentStage(c)).toBe('outer');
    expect(monsterCardSetFor(c, 1)).toBe('1');
    expect(() => monsterCardSetFor(c, 2)).toThrow(/non renseigné/);
    expect(() => assertCanPlay(c, 'x', 'inner')).toThrow(/étape/);
  });

  it('Death Curses : la plus haute valeur parmi autant de cartes que de jetons', () => {
    const deck = [1, 2, 3, 4, 5].map((v) => ({ id: `d${v}`, value: v }));
    const r = drawDeathCurses({ a: 0, b: 5 }, deck, createSeededRandom(3));
    expect(r.a).toBeNull();
    expect(r.b!.value).toBe(5);
  });
});

describe('corrections manuelles', () => {
  it('sont historisées et refusées si l état devient invalide', () => {
    const s = startScenario(demoGame());
    const t = applyCorrection(s, { kind: 'hero-wounds', heroId: 'h1', wounds: 2 });
    expect(t.heroes[0]!.wounds).toBe(2);
    expect(t.events.at(-1)!.type).toBe('correction');
    expect(() => applyCorrection(s, { kind: 'hero-position', heroId: 'h1', to: { x: 99, y: 0 } })).toThrow(/refusée/);
    expect(s.heroes[0]!.wounds).toBe(0);
  });

  it('une quête ne s accomplit qu une fois par scénario', () => {
    const s = startScenario(demoGame());
    completeQuest(s, 'q1');
    expect(() => completeQuest(s, 'q1')).toThrow(/déjà/);
  });
});

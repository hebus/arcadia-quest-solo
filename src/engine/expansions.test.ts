import { describe, expect, it } from 'vitest';
import { runMonsterTurn } from './activation/monsterTurn';
import { killMount } from './combat/damage';
import type { Content, MonsterStats } from './domain/schemas';
import { buildActivationDeck } from './setup';
import { CountingRandom } from './random';
import { activateMount, activatePet, completeDragonTurn, finishHeroActivations, activateHero, startScenario } from './turn/machine';
import { allScenarios } from '@/game-data/scenarios/catalog';
import { demoGame, testContent } from '@/tests/fixtures/demo';

describe('Riders', () => {
  it('la monture est activée une fois par tour ; sa mort compte comme une mort de héros', () => {
    const base = startScenario(demoGame({ expansions: ['riders'], difficulty: 'hard' }));
    base.mounts = [{ id: 'm1', name: 'Samson', position: { x: 0, y: 4 }, dead: false }];
    const a = activateMount(base, 'm1');
    expect(() => activateMount(a, 'm1')).toThrow(/déjà/);
    const dead = structuredClone(base);
    killMount(dead, 'm1');
    expect(dead.deaths).toBe(1);
    killMount(dead, 'm1');
    expect(dead.deaths).toBe(1);
    expect(dead.heroes.every((h) => h.deaths === 0)).toBe(true);
    const second = structuredClone(dead);
    second.mounts.push({ id: 'm2', name: 'Toshi', position: null, dead: false });
    killMount(second, 'm2');
    expect(second.phase).toBe('SCENARIO_LOST');
  });
  it('refusée sans l extension', () => {
    expect(() => activateMount(startScenario(demoGame()), 'm1')).toThrow(/non activée/);
  });
});

describe('Pets', () => {
  it('activation des familiers avec les héros uniquement', () => {
    const g = startScenario(demoGame({ expansions: ['pets'] }));
    g.pets = [{ id: 'p1', name: 'Rawr', life: 2, defense: 0, position: { x: 0, y: 4 }, wounds: 0, dead: false }];
    const a = activatePet(g, 'p1');
    expect(a.activatedHeroIds).toContain('p1');
    expect(() => activatePet(a, 'p1')).toThrow(/déjà/);
  });
});

describe('Dragons', () => {
  it('Partie 2 : Dragon Turn puis Guild Turn, un seul héros, pas de Monster Turn', () => {
    let g = startScenario(demoGame({ dragonPart2: true, expansions: ['dragons'] }));
    expect(g.phase).toBe('DRAGON_TURN');
    g = completeDragonTurn(g, 'carte de test');
    expect(g.phase).toBe('GUILD_TURN');
    g = activateHero(g, 'h1');
    expect(() => activateHero(g, 'h2')).toThrow(/un seul héros/i);
    g = finishHeroActivations(g);
    expect(g.phase).toBe('DRAGON_TURN');
    expect(g.round).toBe(2);
    expect(() => runMonsterTurn(g, testContent)).toThrow(/Dragon Partie 2|impossible/);
  });
  it('Partie 2 : les seuils de mort du mode solo ne s appliquent pas', () => {
    const g = startScenario(demoGame({ dragonPart2: true, difficulty: 'legendary' }));
    g.deaths = 5;
    const next = completeDragonTurn(g, 'x');
    expect(next.phase).toBe('GUILD_TURN');
  });
});

describe('configuration de chaque scénario du livret (plan §12 phase 12)', () => {
  const stats: MonsterStats = { life: 2, overkill: 4, reward: 1, attackType: 'melee', attackDice: 1, defense: 0, movement: 1, rerolls: 0 };
  const slug = (s: string) => s.toLowerCase().replace(/\(.*\)/, '').trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  for (const s of allScenarios) {
    it(`${s.family} / ${s.name}`, () => {
      const names = [...s.excludedCards, ...Object.keys(s.limitedCards), ...s.delayedCards].filter((n) => !n.includes('/'));
      const ids = [...new Set([...names.map(slug), 'extra'])];
      const content: Content = {
        ...testContent,
        monsters: Object.fromEntries(ids.map((id) => [id, { id, name: id, tier: 1, levels: { '1': stats, a: stats, b: stats, c: stats } }])),
      };
      const deck = buildActivationDeck(
        content,
        '1',
        {
          excluded: s.excludedCards.filter((n) => !n.includes('/')).map(slug),
          limited: Object.fromEntries(Object.entries(s.limitedCards).map(([k, v]) => [slug(k), v])),
          delayed: s.delayedCards.map(slug),
          wildPetCards: s.wildPets,
        },
        ids,
        new CountingRandom(1),
      );
      const count = (id: string) => deck.draw.filter((c) => c.monsterDefId === id).length;
      for (const n of s.excludedCards.filter((x) => !x.includes('/'))) expect(count(slug(n)), n).toBe(0);
      for (const [n, cap] of Object.entries(s.limitedCards)) expect(count(slug(n)), n).toBe(cap);
      for (const n of s.delayedCards) {
        expect(count(slug(n))).toBe(0);
        expect(deck.delayed.filter((c) => c.monsterDefId === slug(n))).toHaveLength(3);
      }
      expect(deck.draw.filter((c) => c.kind === 'wild-pet')).toHaveLength(s.wildPets);
      expect(count('extra')).toBe(3);
    });
  }
});

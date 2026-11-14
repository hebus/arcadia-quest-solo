import { describe, expect, it } from 'vitest';
import { boxProblems } from '../figurines';
import { monsterStats } from '../monsters';
import { createScenarioGame, validateScenario } from './definition';
import { GENERATED_LEVELS, generateScenario, type GeneratedLevel } from './generate';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES } from '@/game-data/original';

const gen = (tileCount: number, seed: number, level?: GeneratedLevel) => generateScenario({ tileCount, seed, ...(level ? { level } : {}) }, ORIGINAL_CONTENT);
const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 42, 99, 123, 2024, 31337];
const heroes = ORIGINAL_HEROES.slice(0, 3);
const countOf = (def: ReturnType<typeof gen>, id: string) => def.monsters.filter((m) => m.definitionId === id).length;

describe('mode aléatoire : niveau des monstres (1, 2-3, 4-5 ou 6)', () => {
  it('quatre niveaux proposés : 1, 2-3, 4-5 et 6, par défaut le niveau 1', () => {
    expect([...GENERATED_LEVELS]).toEqual(['1', '2-3', '4-5', '6']);
    expect(gen(5, 7).monsterCardSet).toBe('1');
    expect(gen(5, 7, '1')).toEqual(gen(5, 7));
  });

  it.each([1, 2, 3, 5, 7, 9])('niveau 2-3, %i tuile(s) : valide, jouable, monsterCardSet « 2-3 »', (n) => {
    for (const seed of seeds) {
      const def = gen(n, seed, '2-3');
      expect(def.monsterCardSet, `graine ${seed}`).toBe('2-3');
      expect(validateScenario(def, ORIGINAL_CONTENT), `graine ${seed}`).toEqual([]);
      const g = createScenarioGame(def, { sessionId: 's', difficulty: 'medium', seed: 1, heroes }, ORIGINAL_CONTENT);
      expect(g.monsterCardSet).toBe('2-3');
      // Tous les monstres ont leurs statistiques de niveau 2-3.
      for (const m of def.monsters) expect(monsterStats(ORIGINAL_CONTENT.monsters[m.definitionId], '2-3'), `${m.id} (graine ${seed})`).toBeDefined();
    }
  });

  it('niveau 2-3 : le Goblin Archer rejoint les monstres possibles, dans la limite de sa boîte (6)', () => {
    let withArchers = 0;
    for (const seed of seeds) {
      const def = gen(9, seed, '2-3');
      const archers = countOf(def, 'GA');
      expect(archers, `graine ${seed}`).toBeLessThanOrEqual(6);
      if (archers > 0) withArchers++;
      const counts = new Map<string, number>();
      for (const m of def.monsters) {
        const d = ORIGINAL_CONTENT.monsters[m.definitionId]!;
        counts.set(d.group ?? d.id, (counts.get(d.group ?? d.id) ?? 0) + 1);
      }
      expect(boxProblems(counts, ORIGINAL_CONTENT.monsters)).toEqual([]);
      if (archers > 0) expect(def.deck!.listedMonsterIds).toContain('GA'); // une carte du deck par type présent
    }
    expect(withArchers).toBeGreaterThan(3); // sur un grand terrain, les archers apparaissent souvent
  });

  it('niveau 1 : le Goblin Archer peut apparaître (même fiche qu’au niveau 2-3), dans la limite de sa boîte', () => {
    let withArchers = 0;
    for (const seed of seeds) {
      const n = countOf(gen(9, seed, '1'), 'GA');
      expect(n).toBeLessThanOrEqual(6);
      if (n > 0) withArchers++;
    }
    expect(withArchers).toBeGreaterThan(3);
  });

  it('même graine et même niveau, même scénario ; le niveau change le scénario et son identifiant', () => {
    expect(gen(6, 11, '2-3')).toEqual(gen(6, 11, '2-3'));
    expect(gen(6, 11, '2-3').id).toBe('aleatoire-2-3-11');
    expect(gen(6, 11, '1').id).toBe('aleatoire-11');
    expect(gen(6, 11, '2-3').title).toContain('niveau 2-3');
    expect(gen(6, 11, '1').title).not.toContain('niveau');
  });

  it('le chef reste un vilain, avec ses statistiques de niveau 2-3 (Minotaur 6 de vie, Troll 5)', () => {
    for (const seed of seeds) {
      const def = gen(5, seed, '2-3');
      const chief = def.monsters.at(-1)!;
      expect(['M', 'T']).toContain(chief.definitionId);
      const g = createScenarioGame(def, { sessionId: 's', difficulty: 'medium', seed: 1, heroes }, ORIGINAL_CONTENT);
      const stats = monsterStats(ORIGINAL_CONTENT.monsters[chief.definitionId], g.monsterCardSet)!;
      expect(stats.life).toBe(chief.definitionId === 'M' ? 6 : 5);
    }
  });

  it.each(['4-5', '6'] as const)('niveau %s : valide, jouable, identifiant et titre au niveau, Goblin Archer possible', (level) => {
    for (const seed of seeds) {
      const def = gen(7, seed, level);
      expect(def.monsterCardSet).toBe(level);
      expect(def.id).toBe(`aleatoire-${level}-${seed}`);
      expect(def.title).toContain(`niveau ${level}`);
      expect(validateScenario(def, ORIGINAL_CONTENT), `graine ${seed}`).toEqual([]);
      createScenarioGame(def, { sessionId: 's', difficulty: 'medium', seed: 1, heroes }, ORIGINAL_CONTENT);
      for (const m of def.monsters) expect(monsterStats(ORIGINAL_CONTENT.monsters[m.definitionId], level), `${m.id} (graine ${seed})`).toBeDefined();
    }
  });

  it('un niveau inconnu, ou sans aucune statistique saisie, est refusé avec un message clair', () => {
    expect(() => generateScenario({ tileCount: 4, seed: 1, level: '7' as never }, ORIGINAL_CONTENT)).toThrow(/Niveau « 7 » inconnu : choisissez 1 ou 2-3 ou 4-5 ou 6/);
    const noStats = { ...ORIGINAL_CONTENT, monsters: Object.fromEntries(Object.entries(ORIGINAL_CONTENT.monsters).map(([k, d]) => [k, { ...d, levels: {}, majorLevels: {} }])) };
    expect(() => generateScenario({ tileCount: 4, seed: 1, level: '2-3' }, { monsters: noStats.monsters, tiles: ORIGINAL_CONTENT.tiles! })).toThrow(/Aucun monstre n'a de statistiques au niveau 2-3/);
  });
});

import { describe, expect, it } from 'vitest';
import { createScenarioGame, validateScenario } from './scenario/definition';
import { generateScenario } from './scenario/generate';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES } from '@/game-data/original';
import { CAVE_AUX_CENDRES } from '@/game-data/original/scenarios/cave-aux-cendres';

const spawnLines = (board: string) => board.split('\n').filter((l) => l.startsWith('spawn'));
/** Le scénario 1 avec seulement ses `n` premiers jetons Spawn (S1 à Sn). */
const withTokens = (n: number) => ({
  ...CAVE_AUX_CENDRES,
  board: CAVE_AUX_CENDRES.board
    .split('\n')
    .filter((l) => !l.startsWith('spawn') || Number(l.split(' ')[1]!.slice(1)) <= n)
    .join('\n'),
});

describe('un scénario pose de 1 à 5 jetons Spawn', () => {
  it.each([1, 2, 3, 4, 5])('%i jeton(s) Spawn : valide, les 5 ne sont pas obligatoires', (n) => {
    const def = withTokens(n);
    expect(spawnLines(def.board)).toHaveLength(n);
    expect(validateScenario(def, ORIGINAL_CONTENT)).toEqual([]);
    expect(createScenarioGame(def, { sessionId: 's', difficulty: 'medium', seed: 1, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT).spawnPoints).toHaveLength(n);
  });

  it('au moins un jeton est obligatoire : sans aucun, le scénario est refusé', () => {
    const def = withTokens(0);
    expect(spawnLines(def.board)).toHaveLength(0);
    expect(validateScenario(def, ORIGINAL_CONTENT).join()).toMatch(/Aucun jeton Spawn/);
    expect(() => createScenarioGame(def, { sessionId: 's', difficulty: 'medium', seed: 1, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT)).toThrow(/Aucun jeton Spawn/);
  });

  it('le générateur pose de 1 à 5 jetons, pas toujours 5', () => {
    const counts = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const n = spawnLines(generateScenario({ tileCount: 6, seed }, ORIGINAL_CONTENT).board).length;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(5);
      counts.add(n);
    }
    expect(counts.size).toBeGreaterThan(2);
    expect(counts.has(5)).toBe(true);
    expect([...counts].some((n) => n < 5)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import type { MonsterDefinition } from './domain/schemas';
import { MONSTER_LEVELS, monsterStats, statsOfMonster } from './monsters';
import { createScenarioGame, validateScenario } from './scenario/definition';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES } from '@/game-data/original';
import { CAVE_AUX_CENDRES } from '@/game-data/original/scenarios/cave-aux-cendres';
import { TEST_ORIGINAL_CONTENT } from '@/tests/fixtures/originalContent';

const GA = ORIGINAL_CONTENT.monsters.GA!;
const OM = ORIGINAL_CONTENT.monsters.OM!;

describe('monstres : niveaux, rangs et figurines', () => {
  it('quatre niveaux : 1, 2-3, 4-5 et 6', () => {
    expect([...MONSTER_LEVELS]).toEqual(['1', '2-3', '4-5', '6']);
  });

  it('les stats se lisent par niveau et par rang ; ce qui n’est pas saisi (le Goblin Archer au niveau 1) est absent', () => {
    expect(monsterStats(OM, '1')).toMatchObject({ life: 2, overkill: 3, movement: 1, reward: 1, attackType: 'melee', attackDice: 3 });
    expect(monsterStats(OM, '1', 'minor')).toBe(monsterStats(OM, '1'));
    expect(monsterStats(GA, '2-3')).toMatchObject({ life: 2, overkill: 3, movement: 1, reward: 1, attackType: 'ranged', attackDice: 2 });
    expect(monsterStats(OM, '2-3')).toMatchObject({ life: 3, overkill: 4, attackDice: 3 }); // niveau 2-3 saisi
    expect(monsterStats(OM, '4-5')).toMatchObject({ life: 4, overkill: 5, attackDice: 4 });
    expect(monsterStats(OM, '6')).toMatchObject({ life: 5, overkill: 6, attackDice: 4 });
    expect(monsterStats(OM, '7')).toBeUndefined(); // niveau qui n'existe pas
    expect(monsterStats(GA, '1')).toBeUndefined();
    expect(monsterStats(OM, '1', 'major')).toBeUndefined(); // les major ne sont pas saisis
  });

  it('une version major a ses propres stats', () => {
    const major: MonsterDefinition = { ...OM, majorLevels: { '1': { life: 3, overkill: 4, movement: 1, reward: 2, attackType: 'melee', attackDice: 4 } } };
    expect(monsterStats(major, '1', 'major')).toMatchObject({ life: 3, attackDice: 4 });
    expect(monsterStats(major, '1', 'minor')).toMatchObject({ life: 2, attackDice: 3 });
    const content = { ...ORIGINAL_CONTENT, monsters: { ...ORIGINAL_CONTENT.monsters, OM: major } };
    expect(statsOfMonster(content, { monsterCardSet: '1' }, { definitionId: 'OM', rank: 'major' })).toMatchObject({ life: 3 });
    expect(statsOfMonster(content, { monsterCardSet: '1' }, { definitionId: 'OM' })).toMatchObject({ life: 2 });
  });

  it('un monstre major sans stats saisies est signalé à la mise en place', () => {
    let done = false; // un Orc Marauder en major : ses stats major ne sont pas saisies
    const def = { ...CAVE_AUX_CENDRES, monsters: CAVE_AUX_CENDRES.monsters.map((m) => (!done && m.definitionId === 'OM' ? ((done = true), { ...m, rank: 'major' as const }) : m)) };
    expect(() => createScenarioGame(def, { sessionId: 's', difficulty: 'medium', seed: 1, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT)).toThrow(/Stats manquantes : OM \(major\)/);
  });

  it('on ne pose pas plus de figurines que la boîte n’en contient (8 Orc Marauder, 6 Goblin Archer)', () => {
    const om = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `x${i}`, definitionId: 'OM', at: { x: i % 9, y: 8 - Math.floor(i / 9) } }));
    expect(validateScenario({ ...CAVE_AUX_CENDRES, script: [], monsters: om(8) }, ORIGINAL_CONTENT).join()).not.toMatch(/Trop de figurines/);
    expect(validateScenario({ ...CAVE_AUX_CENDRES, script: [], monsters: om(9) }, ORIGINAL_CONTENT).join()).toMatch(/Trop de figurines Orc Marauder : 9 pour 8 dans la boîte/);
    const ga = Array.from({ length: 7 }, (_, i) => ({ id: `g${i}`, definitionId: 'GA', at: { x: i, y: 8 } }));
    expect(validateScenario({ ...CAVE_AUX_CENDRES, script: [], monsters: ga }, ORIGINAL_CONTENT).join()).toMatch(/Trop de figurines Goblin Archer : 7 pour 6/);
  });

  it('le scénario livré tient dans la boîte des Orcs (8, renforts compris)', () => {
    const orcs = (id: string) => id === 'OM' || id === 'OC';
    const reinforcements = (JSON.stringify(CAVE_AUX_CENDRES.script).match(/"definitionId":"(\w+)"/g) ?? []).filter((m) => orcs(m.split('"')[3]!)).length;
    expect(CAVE_AUX_CENDRES.monsters.filter((m) => orcs(m.definitionId)).length + reinforcements).toBeLessThanOrEqual(OM.copies!);
  });

  it('pour les tests, le Goblin Archer de niveau 1 reprend les stats du niveau 2-3', () => {
    const ga = TEST_ORIGINAL_CONTENT.monsters.GA!;
    expect(ga.levels['1']).toEqual(ga.levels['2-3']);
    expect(ORIGINAL_CONTENT.monsters.GA!.levels['1']).toBeUndefined(); // l'application, elle, ne l'invente pas
  });

  it('le deck d’activation compte une carte par niveau autre que celui du scénario, même sans stats saisies', () => {
    const g = createScenarioGame(CAVE_AUX_CENDRES, { sessionId: 's', difficulty: 'medium', seed: 1, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT);
    const cards = [...g.deck.draw, ...g.deck.discard].filter((c) => c.monsterDefId === 'OM');
    expect(cards).toHaveLength(3); // niveaux 2-3, 4-5 et 6 pour un scénario de niveau 1
    expect(cards.map((c) => c.id).sort()).toEqual(['OM:2-3', 'OM:4-5', 'OM:6']);
  });
});

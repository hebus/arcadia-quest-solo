import { describe, expect, it } from 'vitest';
import { key, samePos } from '../movement/board';
import { boxProblems } from '../figurines';
import { createScenarioGame, scenarioBoard, validateScenario } from './definition';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES } from '@/game-data/original';
import { TERRAIN_ESSAI } from '@/game-data/original/scenarios/terrain-essai';
import { startScenario } from '../turn/machine';

const def = TERRAIN_ESSAI;
const board = scenarioBoard(def, ORIGINAL_CONTENT).board;
const has = (list: { x: number; y: number }[] | undefined, p: { x: number; y: number }) => (list ?? []).some((c) => samePos(c, p));
const countByType = (): Record<string, number> => Object.fromEntries([...def.monsters.reduce((m, x) => m.set(x.definitionId, (m.get(x.definitionId) ?? 0) + 1), new Map<string, number>())]);

describe('terrain d’essai : le plateau vierge de 2×2 tuiles', () => {
  it('est valide et se réduit à 2×2 tuiles vierges (6×6), sans bâtiment, mur, porte ni case bloquée', () => {
    expect(validateScenario(def, ORIGINAL_CONTENT)).toEqual([]);
    expect(def.sandbox).toBe(true);
    expect(def.tiles).toBeUndefined();
    expect(def.monsterCardSet).toBe('1');
    expect(board.width).toBe(6);
    expect(board.height).toBe(6);
    expect(board.interior ?? []).toEqual([]);
    expect(board.rooms ?? []).toEqual([]);
    expect(board.blocked ?? []).toEqual([]);
    expect(board.holes).toEqual([]);
    expect(board.walls).toEqual([]);
    expect(board.doors).toEqual([]);
  });

  it('cinq jetons Spawn, un de chaque type, sur des cases distinctes', () => {
    const tokens = def.board.split('\n').filter((l) => l.startsWith('spawn'));
    expect(tokens).toHaveLength(5);
    const types = tokens.map((l) => l.split(' ')[3]!.split('+').sort().join('+'));
    expect(types.sort()).toEqual(['bow+bow', 'bow+crit', 'bow+sword', 'crit+sword', 'sword+sword']);
    expect(new Set(tokens.map((l) => l.split(' ')[2]!)).size).toBe(5);
    // Les préréglages de dés du terrain visent S1 (épée+épée) et S2 (arc+arc).
    expect(tokens.find((l) => l.startsWith('spawn S1'))).toContain('sword+sword');
    expect(tokens.find((l) => l.startsWith('spawn S2'))).toContain('bow+bow');
  });
});

describe('terrain d’essai : la population', () => {
  it('un monstre de chaque type du niveau 1', () => {
    expect(countByType()).toEqual({ OM: 1, OC: 1, M: 1, T: 1, SB: 1, HB: 1 });
    expect(def.deck?.listedMonsterIds?.slice().sort()).toEqual(['HB', 'M', 'OC', 'OM', 'SB', 'T']);
    expect(boxProblems(new Map(Object.entries(countByType())), ORIGINAL_CONTENT.monsters)).toEqual([]);
  });

  it('tout le monde est sur le plateau, au plus 2 figurines par case, et la partie démarre', () => {
    const cells = [...def.monsters.map((m) => m.at), ...def.heroStarts];
    for (const p of cells) expect(p.x >= 0 && p.y >= 0 && p.x < board.width && p.y < board.height, JSON.stringify(p)).toBe(true);
    const count = new Map<string, number>();
    for (const p of cells) count.set(key(p), (count.get(key(p)) ?? 0) + 1);
    expect(Math.max(...count.values())).toBeLessThanOrEqual(2);
    const g = startScenario(createScenarioGame(def, { sessionId: 's', difficulty: 'easy', seed: 1, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT));
    expect(g.monsters.filter((m) => m.status === 'board')).toHaveLength(6);
    expect(g.heroes.every((h) => !!h.position)).toBe(true);
  });

  it('les gardes (Captain, Minotaur) sont marqués ; la quête « essai » est un drapeau sur une case du plateau', () => {
    expect(def.monsters.find((m) => m.id === 'OC1')!.guard).toBe(true);
    expect(def.monsters.find((m) => m.id === 'M1')!.guard).toBe(true);
    expect(def.quests).toHaveLength(1);
    expect(def.quests[0]).toMatchObject({ id: 'essai', icon: 'flag' });
    expect(has([{ x: 3, y: 2 }], def.quests[0]!.at!)).toBe(true);
  });
});

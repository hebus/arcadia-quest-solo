import { describe, expect, it } from 'vitest';
import { DOOR_TOKENS, SPECIAL_DOOR_TOKENS, doorTokenProblems } from './doorTokens';
import { parseBoardDsl } from './boardDsl';
import { validateScenario } from './scenario/definition';
import { TileDefSchema, boardFromLayout, layoutDoors, type TileDef } from './tiles';
import { parse } from './domain/validate';
import { ORIGINAL_CONTENT } from '@/game-data/original';
import { CAVE_AUX_CENDRES } from '@/game-data/original/scenarios/cave-aux-cendres';

const doors = (n: number, special = 0) => Array.from({ length: n }, (_, i) => ({ special: i < special }));

describe('pions porte : 22 pions recto/verso, dont un seul spécial (violet)', () => {
  it('constantes du jeu physique', () => {
    expect(DOOR_TOKENS).toBe(22);
    expect(SPECIAL_DOOR_TOKENS).toBe(1);
  });

  it('jusqu’à 22 portes, dont une spéciale : accepté ; au-delà : refusé', () => {
    expect(doorTokenProblems(doors(22, 1))).toEqual([]);
    expect(doorTokenProblems(doors(0))).toEqual([]);
    expect(doorTokenProblems(doors(23)).join()).toMatch(/Trop de portes : 23 pour 22/);
    expect(doorTokenProblems(doors(5, 2)).join()).toMatch(/Une seule porte peut être spéciale/);
  });

  it('le DSL de scénario accepte « special » sur une porte, pas autre chose', () => {
    const { board } = parseBoardDsl('size 4x1\ndoor a 0,0-1,0 closed\ndoor b 1,0-2,0 open special');
    expect(board.doors.map((d) => [d.id, d.open, d.special ?? false])).toEqual([['a', false, false], ['b', true, true]]);
    expect(() => parseBoardDsl('size 4x1\ndoor a 0,0-1,0 closed violet')).toThrow(/special/);
  });

  it('un scénario qui dépasse 22 portes, ou qui a deux portes spéciales, est refusé', () => {
    // 4 colonnes de 9 cases : on pose des portes sur les arêtes verticales.
    const lines = Array.from({ length: 23 }, (_, i) => `door p${i} ${i % 3},${Math.floor(i / 3)}-${(i % 3) + 1},${Math.floor(i / 3)} closed`);
    const tooMany = { ...CAVE_AUX_CENDRES, board: `size 9x9\n${lines.join('\n')}\nspawn S1 0,8 sword+bow` };
    expect(validateScenario({ ...tooMany, monsters: [], quests: CAVE_AUX_CENDRES.quests, script: [] }, ORIGINAL_CONTENT).join()).toMatch(/Trop de portes : 23/);
    const twoSpecial = { ...CAVE_AUX_CENDRES, board: 'size 9x9\ndoor a 0,0-1,0 closed special\ndoor b 0,1-1,1 closed special\nspawn S1 0,8 sword+bow', monsters: [], script: [] };
    expect(validateScenario(twoSpecial, ORIGINAL_CONTENT).join()).toMatch(/Une seule porte peut être spéciale/);
  });

  it('le scénario livré tient dans les pions porte', () => {
    expect(validateScenario(CAVE_AUX_CENDRES, ORIGINAL_CONTENT).join()).not.toMatch(/portes/);
  });
});

describe('porte spéciale sur un plateau de tuiles', () => {
  const tile: TileDef = parse(TileDefSchema, { id: '1A', name: '1A', interior: [{ x: 1, y: 1 }], doors: [[{ x: 1, y: 1 }, { x: 0, y: 1 }]] });
  const layout = { tilesW: 1, tilesH: 1, placements: [{ tileId: '1A', tx: 0, ty: 0, rotation: 0 as const }] };
  const doorId = layoutDoors({ '1A': tile }, layout)[0]!.id;

  it('la porte désignée porte le marquage spécial, pas les autres', () => {
    expect(boardFromLayout({ '1A': tile }, layout).doors[0]!.special).toBeUndefined();
    expect(boardFromLayout({ '1A': tile }, layout, { specialDoorId: doorId }).doors[0]!.special).toBe(true);
  });

  it('une porte retirée (pion rendu) ne peut pas rester spéciale', () => {
    const board = boardFromLayout({ '1A': tile }, layout, { specialDoorId: doorId, doorStates: { [doorId]: 'none' } });
    expect(board.doors).toHaveLength(0);
  });

  it('les tuiles se posent par quarts de tour, recto ou verso : la porte suit la rotation', () => {
    const rotated = (rotation: 0 | 90 | 180 | 270) => boardFromLayout({ '1A': tile }, { ...layout, placements: [{ tileId: '1A', tx: 0, ty: 0, rotation }] }).doors[0]!;
    // Porte entre (0,1) et (1,1) : un quart de tour horaire l'amène entre (1,0) et (1,1).
    expect([rotated(0).a, rotated(0).b]).toEqual([{ x: 1, y: 1 }, { x: 0, y: 1 }]);
    const r = rotated(90);
    expect([r.a, r.b]).toEqual([{ x: 1, y: 1 }, { x: 1, y: 0 }]);
    for (const rot of [0, 90, 180, 270] as const) expect(rotated(rot)).toBeDefined();
  });
});

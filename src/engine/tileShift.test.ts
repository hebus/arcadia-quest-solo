import { describe, expect, it } from 'vitest';
import { reachableCells } from './combat/heroMove';
import { parse } from './domain/validate';
import { createScenarioGame, validateScenario, type ScenarioDefinition } from './scenario/definition';
import { TileDefSchema, boardFromLayout, layoutExtent, layoutHeroStarts, layoutProblems, placementOrigin, type TileDef, type TileLayout } from './tiles';
import { startScenario } from './turn/machine';
import { demoGame } from '@/tests/fixtures/demo';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES } from '@/game-data/original';
import { CAVE_AUX_CENDRES } from '@/game-data/original/scenarios/cave-aux-cendres';

const street = (id: string, extra: Partial<TileDef> = {}): TileDef => parse(TileDefSchema, { id, name: id, ...extra });
const tiles = { X: street('X', { heroStart: [{ x: 0, y: 2 }] }), Y: street('Y') };
const has = (list: { x: number; y: number }[], x: number, y: number) => list.some((c) => c.x === x && c.y === y);
const two = (dx = 0, dy = 0): TileLayout => ({ tilesW: 2, tilesH: 1, placements: [{ tileId: 'X', tx: 0, ty: 0, rotation: 0 }, { tileId: 'Y', tx: 1, ty: 0, rotation: 0, ...(dx ? { dx } : {}), ...(dy ? { dy } : {}) }] });

describe('un scénario peut utiliser moins de 9 tuiles', () => {
  it('un plateau d’une seule tuile est un plateau de 3×3 cases', () => {
    const board = boardFromLayout(tiles, { tilesW: 1, tilesH: 1, placements: [{ tileId: 'X', tx: 0, ty: 0, rotation: 0 }] });
    expect([board.width, board.height, board.holes.length]).toEqual([3, 3, 0]);
  });

  it('les emplacements vides d’une grille sont des cases absentes', () => {
    const board = boardFromLayout(tiles, { tilesW: 3, tilesH: 2, placements: [{ tileId: 'X', tx: 0, ty: 0, rotation: 0 }, { tileId: 'Y', tx: 2, ty: 1, rotation: 0 }] });
    expect([board.width, board.height]).toEqual([9, 6]);
    expect(board.holes).toHaveLength(54 - 18); // seulement 2 tuiles de 9 cases
    expect(has(board.holes, 4, 1)).toBe(true); // emplacement (1,0) vide
    expect(has(board.holes, 1, 1)).toBe(false); // sous la tuile X
  });

  it('un scénario de 2 tuiles, dont la description ne porte que sur ces 6×3 cases, est valide et jouable', () => {
    const def: ScenarioDefinition = {
      ...CAVE_AUX_CENDRES,
      tiles: { tilesW: 2, tilesH: 1, placements: [{ tileId: '7A', tx: 0, ty: 0, rotation: 0 }, { tileId: '5A', tx: 1, ty: 0, rotation: 0 }] },
      board: 'size 6x3\ndoor sortie 1,1-1,2 open\nspawn S1 4,0 sword+sword',
      heroStarts: [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }],
      monsters: [{ id: 'OM1', definitionId: 'OM', at: { x: 5, y: 0 } }],
      quests: [{ id: 'q', icon: 'flag', title: 'Atteindre la rue', completion: 'Fait.', at: { x: 4, y: 1 } }],
      script: [],
    };
    expect(validateScenario(def, ORIGINAL_CONTENT)).toEqual([]);
    const g = createScenarioGame(def, { sessionId: 's', difficulty: 'medium', seed: 1, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT);
    expect([g.board.width, g.board.height]).toEqual([6, 3]);
  });
});

describe('une tuile peut être décalée pour laisser des cases bloquantes entre les tuiles', () => {
  it('décalage vers la droite : une colonne vide apparaît entre les deux tuiles, et le plateau s’élargit', () => {
    expect(placementOrigin(two(1).placements[1]!)).toEqual({ x: 4, y: 0 });
    expect(layoutExtent(two(1))).toEqual({ width: 7, height: 3 });
    const board = boardFromLayout(tiles, two(1));
    expect(board.width).toBe(7);
    for (const y of [0, 1, 2]) expect(has(board.holes, 3, y)).toBe(true); // l'écart
    expect(has(board.holes, 4, 0)).toBe(false); // la tuile décalée
    expect(has(board.holes, 6, 2)).toBe(false);
    expect(board.holes).toHaveLength(3);
  });

  it('décalage vers le bas : des cases vides au-dessus de la tuile, et le plateau s’allonge', () => {
    const board = boardFromLayout(tiles, two(0, 2));
    expect([board.width, board.height]).toEqual([6, 5]);
    expect(has(board.holes, 3, 0)).toBe(true);
    expect(has(board.holes, 3, 1)).toBe(true);
    expect(has(board.holes, 3, 2)).toBe(false); // la tuile commence à la ligne 2
    expect(has(board.holes, 0, 3)).toBe(true); // sous la tuile X
  });

  it('on ne traverse pas l’écart : il est impassable, comme une case absente', () => {
    const heroes = [
      { id: 'h1', name: 'Grom', life: 4, defense: 0, position: { x: 2, y: 1 } },
      { id: 'h2', name: 'Maya', life: 3, defense: 0, position: { x: 0, y: 0 } },
      { id: 'h3', name: 'Zazu', life: 3, defense: 0, position: { x: 0, y: 2 } },
    ];
    const gap = startScenario(demoGame({ board: boardFromLayout(tiles, two(1)), heroes, monsters: [] }));
    const reach = reachableCells(gap, 'h1', 3);
    expect(reach.some((r) => r.pos.x === 3)).toBe(false); // l'écart
    expect(reach.some((r) => r.pos.x >= 4)).toBe(false); // rien au-delà : aucun chemin ne passe
    // Sans décalage, les mêmes 3 PM atteignent la tuile voisine.
    const joined = startScenario(demoGame({ board: boardFromLayout(tiles, two()), heroes, monsters: [] }));
    expect(reachableCells(joined, 'h1', 3).some((r) => r.pos.x === 3)).toBe(true);
  });

  it('un décalage peut aller vers la gauche ou le haut, tant que la tuile reste sur le plateau', () => {
    const layout: TileLayout = { tilesW: 3, tilesH: 1, placements: [{ tileId: 'X', tx: 0, ty: 0, rotation: 0 }, { tileId: 'Y', tx: 2, ty: 0, rotation: 0, dx: -1 }] };
    expect(placementOrigin(layout.placements[1]!)).toEqual({ x: 5, y: 0 });
    expect(layoutProblems(layout)).toEqual([]);
    expect(boardFromLayout(tiles, layout).width).toBe(9);
  });

  it('une tuile décalée hors du plateau, ou deux tuiles qui se chevauchent, sont signalées', () => {
    const off: TileLayout = { tilesW: 2, tilesH: 1, placements: [{ tileId: 'X', tx: 0, ty: 0, rotation: 0, dx: -1 }] };
    expect(layoutProblems(off).join()).toMatch(/La tuile X est décalée hors du plateau/);
    const overlap: TileLayout = { tilesW: 2, tilesH: 1, placements: [{ tileId: 'X', tx: 0, ty: 0, rotation: 0 }, { tileId: 'Y', tx: 1, ty: 0, rotation: 0, dx: -1 }] };
    expect(layoutProblems(overlap).join()).toMatch(/Les tuiles X et Y se chevauchent/);
    expect(layoutProblems(two(1))).toEqual([]);
    expect(layoutProblems(two(0, 3))).toEqual([]); // décalée d'une tuile entière vers le bas : plus de chevauchement
  });

  it('les éléments de la tuile suivent son décalage (zones de départ)', () => {
    const layout: TileLayout = { tilesW: 2, tilesH: 1, placements: [{ tileId: 'X', tx: 1, ty: 0, rotation: 0, dx: 1, dy: 2 }] };
    expect(layoutHeroStarts(tiles, layout)).toEqual([{ x: 4, y: 4 }]); // (0,2) local → colonne 3+1, ligne 0+2+2
  });

  it('un scénario dont la description ne tient pas compte du décalage est refusé : la taille doit suivre', () => {
    const shifted = { ...CAVE_AUX_CENDRES, tiles: { ...CAVE_AUX_CENDRES.tiles!, placements: CAVE_AUX_CENDRES.tiles!.placements.map((p) => (p.tileId === '1B' ? { ...p, dx: 1 } : p)) } };
    expect(validateScenario(shifted, ORIGINAL_CONTENT).join()).toMatch(/Les tuiles \(10×9 cases\) ne correspondent pas au plateau \(9×9\)/);
  });
});

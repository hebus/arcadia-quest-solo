import { describe, expect, it } from 'vitest';
import { reachableCells } from './combat/heroMove';
import { parse } from './domain/validate';
import { validateScenario } from './scenario/definition';
import { TileDefSchema, boardFromLayout, doorsWithoutWall, type TileDef } from './tiles';
import { startScenario } from './turn/machine';
import { demoGame } from '@/tests/fixtures/demo';
import { ORIGINAL_CONTENT } from '@/game-data/original';
import { CAVE_AUX_CENDRES } from '@/game-data/original/scenarios/cave-aux-cendres';

// Deux tuiles côte à côte, chacune avec un bâtiment sur sa rangée du bas : (0..2,2) et (3..5,2), séparés par le mur du bord des tuiles.
const hall = (id: string): TileDef => parse(TileDefSchema, { id, name: id, interior: [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }] });
const tiles = { X: hall('X'), Y: hall('Y') };
const layout = { tilesW: 2, tilesH: 1, placements: [{ tileId: 'X', tx: 0, ty: 0, rotation: 0 as const }, { tileId: 'Y', tx: 1, ty: 0, rotation: 0 as const }] };
const between = { a: { x: 2, y: 2 }, b: { x: 3, y: 2 } };
const wallBetween = (b: ReturnType<typeof boardFromLayout>) => b.walls.some(([p, q]) => (p.x === 2 && q.x === 3) || (p.x === 3 && q.x === 2) ? p.y === 2 && q.y === 2 : false);

describe('un pion porte côté « porte ouverte » supprime un mur', () => {
  it('sans pion, les deux bâtiments sont séparés par un mur', () => {
    expect(wallBetween(boardFromLayout(tiles, layout))).toBe(true);
  });

  it('un pion porte ouvert supprime ce mur : les deux bâtiments n’en font plus qu’un', () => {
    const board = boardFromLayout(tiles, layout, { doors: [{ id: 'ouverture', ...between, open: true }] });
    expect(wallBetween(board)).toBe(false);
    expect(board.doors).toEqual([expect.objectContaining({ id: 'ouverture', open: true })]);
    const g = startScenario(
      demoGame({
        board,
        heroes: [
          { id: 'h1', name: 'Grom', life: 4, defense: 0, position: { x: 2, y: 2 } },
          { id: 'h2', name: 'Maya', life: 3, defense: 0, position: { x: 0, y: 2 } },
          { id: 'h3', name: 'Zazu', life: 3, defense: 0, position: { x: 1, y: 2 } },
        ],
        monsters: [],
      }),
    );
    const reach = reachableCells(g, 'h1', 1);
    expect(reach.some((r) => r.pos.x === 3 && r.pos.y === 2)).toBe(true); // 1 PM suffit : aucun mur, aucune porte à ouvrir
  });

  it('fermé, le même pion est une porte : il faut l’ouvrir (1 PM) avant de passer', () => {
    const board = boardFromLayout(tiles, layout, { doors: [{ id: 'porte', ...between, open: false }] });
    const g = startScenario(
      demoGame({
        board,
        heroes: [
          { id: 'h1', name: 'Grom', life: 4, defense: 0, position: { x: 2, y: 2 } },
          { id: 'h2', name: 'Maya', life: 3, defense: 0, position: { x: 0, y: 2 } },
          { id: 'h3', name: 'Zazu', life: 3, defense: 0, position: { x: 1, y: 2 } },
        ],
        monsters: [],
      }),
    );
    expect(reachableCells(g, 'h1', 1).some((r) => r.pos.x === 3 && r.pos.y === 2)).toBe(false);
    expect(reachableCells(g, 'h1', 2).some((r) => r.pos.x === 3 && r.pos.y === 2)).toBe(true);
  });

  it('un pion porte se pose sur un mur : sur une arête sans mur, il est signalé', () => {
    const onWall = { id: 'a', ...between, open: true };
    const onStreet = { id: 'b', a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, open: true };
    expect(doorsWithoutWall(tiles, layout, { doors: [onWall] })).toEqual([]);
    expect(doorsWithoutWall(tiles, layout, { doors: [onWall, onStreet] }).map((d) => d.id)).toEqual(['b']);
  });

  it('un mur ajouté par le scénario peut porter un pion porte', () => {
    const street = { id: 'c', a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, open: false };
    expect(doorsWithoutWall(tiles, layout, { walls: [[street.a, street.b]], doors: [street] })).toEqual([]);
  });

  it('un scénario dont une porte est posée sur une arête sans mur est refusé', () => {
    const stray = { ...CAVE_AUX_CENDRES, board: `${CAVE_AUX_CENDRES.board}\ndoor erreur 0,0-1,0 closed` };
    expect(validateScenario(stray, ORIGINAL_CONTENT).join()).toMatch(/La porte « erreur » est posée sur une arête sans mur/);
    // Les portes du scénario livré sont toutes sur des murs, dont la porte ouverte de départ.
    expect(validateScenario(CAVE_AUX_CENDRES, ORIGINAL_CONTENT).join()).not.toMatch(/sans mur/);
  });
});

import { parse } from '@/engine/domain/validate';
import { describe, expect, it } from 'vitest';
import { reachableCells } from './combat/heroMove';
import {
  TileDefSchema,
  autoWalls,
  boardFromLayout,
  buildings,
  effectiveWalls,
  layoutDoors,
  pruneTile,
  sameEdge,
  type Edge,
  type TileDef,
  type TileLayout,
} from './tiles';
import { startScenario } from './turn/machine';
import { demoGame } from '@/tests/fixtures/demo';

const cell = (x: number, y: number) => ({ x, y });
const edge = (a: [number, number], b: [number, number]): Edge => [cell(...a), cell(...b)];
const tile = (over: Partial<TileDef> = {}) => parse(TileDefSchema, { id: 't', name: 'T', ...over });
const layout1: TileLayout = { tilesW: 1, tilesH: 1, placements: [{ tileId: 't', tx: 0, ty: 0, rotation: 0 }] };

describe('tuile de rue par défaut', () => {
  it('sans intérieur : aucun mur, toutes les cases accessibles', () => {
    const b = boardFromLayout({ t: tile() }, layout1);
    expect(b.walls).toHaveLength(0);
    expect(b.interior).toHaveLength(0);
  });
});

describe('bâtiments', () => {
  const two = tile({ interior: [cell(1, 1), cell(1, 2)] });

  it('des cases d intérieur contiguës forment un seul bâtiment, sans mur entre elles', () => {
    expect(buildings(two)).toHaveLength(1);
    expect(buildings(two)[0]).toHaveLength(2);
    expect(autoWalls(two)).toHaveLength(6);
    expect(autoWalls(two).some((w) => sameEdge(w, edge([1, 1], [1, 2])))).toBe(false);
  });

  it('des cases non contiguës forment des bâtiments distincts (diagonale comprise)', () => {
    expect(buildings(tile({ interior: [cell(0, 0), cell(1, 1)] }))).toHaveLength(2);
    expect(buildings(tile({ interior: [cell(0, 0), cell(2, 2), cell(2, 1)] }))).toHaveLength(2);
  });

  it('le contour muré inclut les arêtes vers l extérieur de la tuile', () => {
    const t = tile({ interior: [cell(0, 0)] });
    const walls = autoWalls(t);
    expect(walls.some((w) => sameEdge(w, edge([-1, 0], [0, 0])))).toBe(true);
    expect(walls.some((w) => sameEdge(w, edge([0, -1], [0, 0])))).toBe(true);
    expect(walls).toHaveLength(4);
  });

  it('supprimer un mur de bâtiment ouvre le contour ; ajouter un mur cloisonne', () => {
    const open = tile({ interior: [cell(1, 1), cell(1, 2)], openedWalls: [edge([0, 1], [1, 1])] });
    expect(effectiveWalls(open)).toHaveLength(5);
    const split = tile({ interior: [cell(1, 1), cell(1, 2)], walls: [edge([1, 1], [1, 2])] });
    expect(effectiveWalls(split)).toHaveLength(7);
  });

  it('retirer une case d intérieur retire les portes et ouvertures devenues sans objet', () => {
    const t = tile({ interior: [cell(1, 1)], doors: [edge([0, 1], [1, 1])], openedWalls: [edge([1, 0], [1, 1])] });
    const gone = pruneTile({ ...t, interior: [] });
    expect(gone.doors).toHaveLength(0);
    expect(gone.openedWalls).toHaveLength(0);
    expect(pruneTile(t).doors).toHaveLength(1);
  });
});

describe('déplacement autour d un bâtiment', () => {
  // Bâtiment sur la case (1,1) de la tuile ; porte sur son côté gauche (0,1)-(1,1).
  const building = tile({ interior: [cell(1, 1)], doors: [edge([0, 1], [1, 1])] });
  const reach = (extras = {}) => {
    const board = boardFromLayout({ t: building }, layout1, extras);
    const g = startScenario(demoGame({ board: { ...board, width: 9, height: 9 }, heroes: [{ id: 'h1', name: 'A', life: 3, defense: 0, position: cell(0, 1) }, { id: 'h2', name: 'B', life: 3, defense: 0, position: cell(8, 8) }, { id: 'h3', name: 'C', life: 3, defense: 0, position: cell(8, 7) }], monsters: [{ id: 'g1', definitionId: 'goblin', position: cell(7, 8) }], spawnPoints: [{ id: 'S', at: cell(8, 8), dice: ['A', 'B'] }] }));
    return reachableCells(g, 'h1', 3);
  };
  const costTo = (cells: ReturnType<typeof reach>, x: number, y: number) => cells.find((c) => c.pos.x === x && c.pos.y === y)?.cost;

  it('porte fermée : le héros doit l ouvrir (1 PM) avant d entrer', () => {
    expect(costTo(reach(), 1, 1)).toBe(2);
  });

  it('porte ouverte : entrée directe ; porte retirée : le mur revient', () => {
    expect(costTo(reach({ doorStates: { [layoutDoors({ t: building }, layout1)[0]!.id]: 'open' } }), 1, 1)).toBe(1);
    const removed = reach({ doorStates: { [layoutDoors({ t: building }, layout1)[0]!.id]: 'none' } });
    expect(costTo(removed, 1, 1)).toBeUndefined();
  });

  it('sans porte, le bâtiment est infranchissable', () => {
    const closed = tile({ interior: [cell(1, 1)] });
    const board = boardFromLayout({ t: closed }, layout1);
    expect(board.walls).toHaveLength(4);
    expect(board.doors).toHaveLength(0);
  });
});

describe('assemblage des tuiles', () => {
  it('un bâtiment en bord de tuile est muré du côté de la tuile voisine, tuile de rue comprise', () => {
    const house = tile({ id: 'h', interior: [cell(2, 1)] });
    const street = tile({ id: 's' });
    const b = boardFromLayout(
      { h: house, s: street },
      { tilesW: 2, tilesH: 1, placements: [{ tileId: 'h', tx: 0, ty: 0, rotation: 0 }, { tileId: 's', tx: 1, ty: 0, rotation: 0 }] },
    );
    expect(b.walls.some((w) => sameEdge(w, edge([2, 1], [3, 1])))).toBe(true);
  });

  it('pas de mur vers une tuile absente', () => {
    const house = tile({ interior: [cell(2, 1)] });
    const b = boardFromLayout({ t: house }, { tilesW: 2, tilesH: 1, placements: [{ tileId: 't', tx: 0, ty: 0, rotation: 0 }] });
    expect(b.walls.some((w) => sameEdge(w, edge([2, 1], [3, 1])))).toBe(false);
  });

  it('la rotation fait tourner intérieur, murs et portes ensemble', () => {
    const t = tile({ interior: [cell(0, 0)], doors: [edge([0, 0], [1, 0])] });
    const b = boardFromLayout({ t }, { tilesW: 1, tilesH: 1, placements: [{ tileId: 't', tx: 0, ty: 0, rotation: 90 }] });
    expect(b.interior).toEqual([cell(2, 0)]);
    expect(b.doors[0]!.a).toEqual(cell(2, 0));
    expect(b.doors[0]!.b).toEqual(cell(2, 1));
    expect(b.walls.some((w) => sameEdge(w, [b.doors[0]!.a, b.doors[0]!.b]))).toBe(false);
  });
});

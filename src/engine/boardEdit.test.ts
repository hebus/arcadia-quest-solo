import { describe, expect, it } from 'vitest';
import { applyCorrection } from './corrections';
import { edgeBlocked } from './movement/board';
import { skillGame } from '@/tests/fixtures/skillGame';

const g0 = () => skillGame([{ id: 'P1', definitionId: 'plain', position: { x: 6, y: 2 } }]);
const A = { x: 3, y: 1 };
const B = { x: 4, y: 1 };

describe('construction du plateau (terrain d’essai)', () => {
  it('un mur se pose puis se retire sur une arête, et bloque le passage', () => {
    const walled = applyCorrection(g0(), { kind: 'board-wall', a: A, b: B });
    expect(edgeBlocked(walled.board, A, B)).toBe(true);
    expect(edgeBlocked(walled.board, B, A)).toBe(true);
    const clear = applyCorrection(walled, { kind: 'board-wall', a: B, b: A });
    expect(edgeBlocked(clear.board, A, B)).toBe(false);
  });

  it('une porte passe de fermée à ouverte puis disparaît, et remplace un mur existant', () => {
    let g = applyCorrection(g0(), { kind: 'board-wall', a: A, b: B });
    g = applyCorrection(g, { kind: 'board-door', a: A, b: B });
    expect(g.board.walls).toHaveLength(0);
    expect(g.board.doors).toHaveLength(1);
    expect(g.board.doors[0]).toMatchObject({ open: false });
    expect(edgeBlocked(g.board, A, B)).toBe(true);
    g = applyCorrection(g, { kind: 'board-door', a: A, b: B });
    expect(g.board.doors[0]).toMatchObject({ open: true });
    expect(edgeBlocked(g.board, A, B)).toBe(false);
    g = applyCorrection(g, { kind: 'board-door', a: A, b: B });
    expect(g.board.doors).toHaveLength(0);
  });

  it('un mur posé sur une porte la remplace', () => {
    let g = applyCorrection(g0(), { kind: 'board-door', a: A, b: B });
    g = applyCorrection(g, { kind: 'board-wall', a: A, b: B });
    expect(g.board.doors).toHaveLength(0);
    expect(g.board.walls).toHaveLength(1);
  });

  it('un bâtiment : la case devient intérieure et son contour est muré, puis tout se retire', () => {
    let g = applyCorrection(g0(), { kind: 'board-interior', at: { x: 2, y: 2 } });
    expect(g.board.interior).toEqual([{ x: 2, y: 2 }]);
    expect(g.board.walls).toHaveLength(4);
    g = applyCorrection(g, { kind: 'board-interior', at: { x: 3, y: 2 } });
    // Les deux cases voisines partagent une arête sans mur : 6 murs autour du bâtiment de 2 cases.
    expect(g.board.walls).toHaveLength(6);
    g = applyCorrection(g, { kind: 'board-interior', at: { x: 3, y: 2 } });
    g = applyCorrection(g, { kind: 'board-interior', at: { x: 2, y: 2 } });
    expect(g.board.interior).toEqual([]);
    expect(g.board.walls).toHaveLength(0);
  });

  it('une case bloquée devient impassable ; refusée si une figurine s’y trouve', () => {
    const g = applyCorrection(g0(), { kind: 'board-blocked', at: { x: 4, y: 3 } });
    expect(g.board.holes).toContainEqual({ x: 4, y: 3 });
    expect(g.board.blocked).toContainEqual({ x: 4, y: 3 });
    expect(() => applyCorrection(g0(), { kind: 'board-blocked', at: { x: 6, y: 2 } })).toThrow(/figurine/);
    const back = applyCorrection(g, { kind: 'board-blocked', at: { x: 4, y: 3 } });
    expect(back.board.holes).not.toContainEqual({ x: 4, y: 3 });
  });

  it('une salle change le sol d’une case sans poser de mur', () => {
    const g = applyCorrection(g0(), { kind: 'board-room', at: { x: 1, y: 1 } });
    expect(g.board.rooms).toEqual([{ x: 1, y: 1 }]);
    expect(g.board.walls).toHaveLength(0);
    expect(applyCorrection(g, { kind: 'board-room', at: { x: 1, y: 1 } }).board.rooms).toEqual([]);
  });
});

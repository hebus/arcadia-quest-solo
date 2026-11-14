import { describe, expect, it } from 'vitest';
import { cellArt, cellKind, hash01 } from './tileArt';

describe('art de tuiles généré', () => {
  it('hash01 est déterministe et borné', () => {
    for (let i = 0; i < 50; i++) {
      const v = hash01(i, i * 3, 7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(hash01(i, i * 3, 7)).toBe(v);
    }
  });

  it('une même case produit toujours le même dessin, des cases voisines varient', () => {
    expect(cellArt('street', { x: 2, y: 3 })).toEqual(cellArt('street', { x: 2, y: 3 }));
    expect(cellArt('street', { x: 2, y: 3 })).not.toEqual(cellArt('street', { x: 3, y: 3 }));
  });

  it('rue (pavés) et intérieur (parquet) sont distincts et restent dans la case', () => {
    const street = cellArt('street', { x: 0, y: 0 });
    const inside = cellArt('interior', { x: 0, y: 0 });
    expect(street.filter((p) => p.kind === 'rect')).toHaveLength(5);
    expect(inside.some((p) => p.kind === 'line')).toBe(true);
    for (const p of [...street, ...inside]) {
      if (p.kind === 'rect') {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x + p.w).toBeLessThanOrEqual(1.001);
        expect(p.y + p.h).toBeLessThanOrEqual(1.001);
      }
    }
  });

  it('cellKind lit les cases d’intérieur du plateau', () => {
    const board = { interior: [{ x: 1, y: 1 }] };
    expect(cellKind(board, { x: 1, y: 1 })).toBe('interior');
    expect(cellKind(board, { x: 0, y: 1 })).toBe('street');
    expect(cellKind({}, { x: 0, y: 0 })).toBe('street');
  });
});

const p = { x: 1, y: 1 };
const board = { interior: [{ x: 0, y: 0 }], rooms: [{ x: 1, y: 1 }, { x: 0, y: 0 }], blocked: [{ x: 2, y: 2 }, { x: 1, y: 1 }] };

describe('sol des cases : rue, bâtiment, salle, case bloquée', () => {
  it('la nature d’une case : bloquée avant tout, puis bâtiment, puis salle, sinon rue', () => {
    expect(cellKind(board, { x: 2, y: 2 })).toBe('blocked');
    expect(cellKind(board, { x: 1, y: 1 })).toBe('blocked'); // bloquée l'emporte sur salle
    expect(cellKind(board, { x: 0, y: 0 })).toBe('interior'); // bâtiment l'emporte sur salle
    expect(cellKind({ rooms: [{ x: 1, y: 1 }] }, p)).toBe('room');
    expect(cellKind({}, p)).toBe('street');
  });

  it('une salle a un sol à part : ni les pavés de la rue, ni le parquet des bâtiments', () => {
    const art = (k: Parameters<typeof cellArt>[0]) => JSON.stringify(cellArt(k, p));
    expect(art('room')).not.toBe(art('street'));
    expect(art('room')).not.toBe(art('interior'));
    expect(art('blocked')).not.toBe(art('street'));
  });

  it('le dessin d’une même case est toujours identique', () => {
    expect(cellArt('room', p)).toEqual(cellArt('room', p));
  });
});

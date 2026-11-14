import { describe, expect, it } from 'vitest';
import { parseBoardDsl } from './boardDsl';

describe('parseBoardDsl', () => {
  it('lit plateau, murs, portes, portails et jetons Spawn', () => {
    const r = parseBoardDsl(`# test
size 8x5
hole 3,2
wall 1,0-1,1
door d1 3,3-4,3 closed
portal p1 2,3 red
spawn S1 0,0 A+B`);
    expect(r.board.width).toBe(8);
    expect(r.board.holes).toHaveLength(1);
    expect(r.board.doors[0]).toMatchObject({ id: 'd1', open: false });
    expect(r.spawnPoints[0]!.dice).toEqual(['A', 'B']);
  });

  it('signale les erreurs avec le numéro de ligne', () => {
    expect(() => parseBoardDsl('size 4x4\nwall 0,0-2,2')).toThrow(/Ligne 2/);
    expect(() => parseBoardDsl('size 4x4\nfoo')).toThrow(/inconnue/);
    expect(() => parseBoardDsl('hole 1,1')).toThrow(/Taille/);
    expect(() => parseBoardDsl('size 2x2\nhole 5,5')).toThrow(/hors du plateau/);
  });
});

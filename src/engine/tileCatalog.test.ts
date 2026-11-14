import { describe, expect, it } from 'vitest';
import { CATALOG_TILE_IDS, CELLS_PER_TILE, TILES_IN_GAME, freeTileFaces, isCatalogTile, otherFace, parseTileCode, tilePlacementProblems } from './tileCatalog';
import { TILE, boardFromLayout, type TileDef } from './tiles';
import { parse } from './domain/validate';
import { TileDefSchema } from './tiles';

const BLANK_TILE: TileDef = parse(TileDefSchema, { id: '__blank', name: 'Tuile de rue vierge' });

describe('les tuiles du jeu de base', () => {
  it('9 tuiles doubles faces, A1/A2 à I1/I2, soit 18 faces', () => {
    expect(TILES_IN_GAME).toBe(9);
    expect(CATALOG_TILE_IDS).toHaveLength(18);
    expect(CATALOG_TILE_IDS.slice(0, 4)).toEqual(['A1', 'A2', 'B1', 'B2']);
    expect(CATALOG_TILE_IDS.at(-1)).toBe('I2');
    expect(isCatalogTile('E2')).toBe(true);
    expect(isCatalogTile('J1')).toBe(false);
    expect(isCatalogTile('A3')).toBe(false);
    expect(otherFace('A1')).toBe('A2');
    expect(otherFace('I2')).toBe('I1');
  });

  it('une tuile est une grille de 3×3 cases : un plateau fait 3 cases par tuile', () => {
    expect(TILE).toBe(3);
    expect(CELLS_PER_TILE).toBe(9);
    const tiles: Record<string, TileDef> = { [BLANK_TILE.id]: BLANK_TILE };
    const layout = { tilesW: 3, tilesH: 2, placements: [0, 1, 2, 3, 4, 5].map((i) => ({ tileId: BLANK_TILE.id, tx: i % 3, ty: Math.floor(i / 3), rotation: 0 as const })) };
    const board = boardFromLayout(tiles, layout);
    expect([board.width, board.height]).toEqual([9, 6]);
    expect(board.holes).toHaveLength(0);
  });

  it('le code d’une face se lit dans un nom de fichier', () => {
    expect(parseTileCode('A1.png')).toBe('A1');
    expect(parseTileCode('b2')).toBe('B2');
    expect(parseTileCode('tuile-C 1.jpg')).toBe('C1');
    expect(parseTileCode('scan_i2.jpeg')).toBe('I2');
    expect(parseTileCode('J1.png')).toBeNull();
    expect(parseTileCode('A3.png')).toBeNull();
    expect(parseTileCode('photo.png')).toBeNull();
  });

  it('une tuile se pose une seule fois, sur une seule de ses deux faces', () => {
    expect(tilePlacementProblems(['A1', 'B2', 'C1']).errors).toEqual([]);
    expect(tilePlacementProblems(['A1', 'A2']).errors.join()).toMatch(/tuile A est posée sur ses deux faces \(A1 et A2\)/);
    expect(tilePlacementProblems(['A1', 'A1']).errors.join()).toMatch(/face A1 est posée 2 fois/);
    expect(tilePlacementProblems(['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1']).errors).toEqual([]); // les 9 tuiles
  });

  it('les tuiles de test hors du jeu sont signalées, sans erreur', () => {
    const r = tilePlacementProblems(['A1', '__blank', '__blank']);
    expect(r.errors).toEqual([]);
    expect(r.notInGame).toEqual(['__blank']);
  });

  it('les faces encore posables : celles dont la tuile n’est pas déjà sur le plateau', () => {
    expect(freeTileFaces([])).toHaveLength(18);
    const free = freeTileFaces(['A1', 'C2']);
    expect(free).toHaveLength(14);
    expect(free).not.toContain('A1');
    expect(free).not.toContain('A2'); // l'autre face de A
    expect(free).not.toContain('C1');
    // En changeant la tuile d'un emplacement, ses deux faces redeviennent disponibles.
    expect(freeTileFaces(['A1', 'C2'], 'A1')).toEqual(expect.arrayContaining(['A1', 'A2']));
  });
});

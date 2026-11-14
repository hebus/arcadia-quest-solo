import { describe, expect, it } from 'vitest';
import { CATALOG_TILE_IDS, CELLS_PER_TILE, TILES_IN_GAME, freeTileFaces, isCatalogTile, otherFace, parseTileCode, tilePlacementProblems } from './tileCatalog';
import { TILE, boardFromLayout, layoutHeroStarts, type TileDef } from './tiles';
import { parse } from './domain/validate';
import { TileDefSchema } from './tiles';

const BLANK_TILE: TileDef = parse(TileDefSchema, { id: '__blank', name: 'Tuile de rue vierge' });

describe('les tuiles du jeu de base', () => {
  it('9 tuiles doubles faces, 1A/1B à 9A/9B, soit 18 faces', () => {
    expect(TILES_IN_GAME).toBe(9);
    expect(CATALOG_TILE_IDS).toHaveLength(18);
    expect(CATALOG_TILE_IDS.slice(0, 4)).toEqual(['1A', '1B', '2A', '2B']);
    expect(CATALOG_TILE_IDS.at(-1)).toBe('9B');
    expect(isCatalogTile('5B')).toBe(true);
    expect(isCatalogTile('0A')).toBe(false);
    expect(isCatalogTile('10A')).toBe(false);
    expect(isCatalogTile('1C')).toBe(false);
    expect(isCatalogTile('A1')).toBe(false); // ancienne numérotation
    expect(otherFace('1A')).toBe('1B');
    expect(otherFace('9B')).toBe('9A');
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
    expect(parseTileCode('1A.png')).toBe('1A');
    expect(parseTileCode('2b')).toBe('2B');
    expect(parseTileCode('tuile-3 A.jpg')).toBe('3A');
    expect(parseTileCode('scan_9b.jpeg')).toBe('9B');
    expect(parseTileCode('0A.png')).toBeNull();
    expect(parseTileCode('1C.png')).toBeNull();
    expect(parseTileCode('photo.png')).toBeNull();
  });

  it('une tuile se pose une seule fois, sur une seule de ses deux faces', () => {
    expect(tilePlacementProblems(['1A', '2B', '3A']).errors).toEqual([]);
    expect(tilePlacementProblems(['1A', '1B']).errors.join()).toMatch(/tuile 1 est posée sur ses deux faces \(1A et 1B\)/);
    expect(tilePlacementProblems(['1A', '1A']).errors.join()).toMatch(/face 1A est posée 2 fois/);
    expect(tilePlacementProblems(['1A', '2A', '3A', '4A', '5A', '6A', '7A', '8A', '9A']).errors).toEqual([]); // les 9 tuiles
  });

  it('les tuiles de test hors du jeu sont signalées, sans erreur', () => {
    const r = tilePlacementProblems(['1A', '__blank', '__blank']);
    expect(r.errors).toEqual([]);
    expect(r.notInGame).toEqual(['__blank']);
  });

  it('les faces encore posables : celles dont la tuile n’est pas déjà sur le plateau', () => {
    expect(freeTileFaces([])).toHaveLength(18);
    const free = freeTileFaces(['1A', '3B']);
    expect(free).toHaveLength(14);
    expect(free).not.toContain('1A');
    expect(free).not.toContain('1B'); // l'autre face de la tuile 1
    expect(free).not.toContain('3A');
    // En changeant la tuile d'un emplacement, ses deux faces redeviennent disponibles.
    expect(freeTileFaces(['1A', '3B'], '1A')).toEqual(expect.arrayContaining(['1A', '1B']));
  });
});

describe('zones de départ des héros sur les tuiles', () => {
  const tile = (heroStart: { x: number; y: number }[]): TileDef => parse(TileDefSchema, { id: '1A', name: '1A', heroStart });

  it('une face n’a aucune zone de départ par défaut', () => {
    expect(parse(TileDefSchema, { id: '2B', name: '2B' }).heroStart).toEqual([]);
  });

  it('les zones suivent la tuile : position sur le plateau et rotation', () => {
    const tiles = { '1A': tile([{ x: 0, y: 2 }, { x: 1, y: 2 }]) };
    const at = (rotation: 0 | 90 | 180 | 270) => layoutHeroStarts(tiles, { tilesW: 2, tilesH: 1, placements: [{ tileId: '1A', tx: 1, ty: 0, rotation }] });
    expect(at(0)).toEqual([{ x: 3, y: 2 }, { x: 4, y: 2 }]); // tuile en deuxième colonne : décalée de 3 cases
    expect(at(90)).toEqual([{ x: 3, y: 0 }, { x: 3, y: 1 }]); // un quart de tour horaire : le bas passe à gauche
    expect(at(180)).toEqual([{ x: 5, y: 0 }, { x: 4, y: 0 }]);
  });

  it('plusieurs tuiles : les zones s’additionnent, une tuile sans zone n’en ajoute pas', () => {
    const tiles = { '1A': tile([{ x: 0, y: 0 }]), '2A': parse(TileDefSchema, { id: '2A', name: '2A' }) };
    const starts = layoutHeroStarts(tiles, {
      tilesW: 2,
      tilesH: 1,
      placements: [
        { tileId: '1A', tx: 0, ty: 0, rotation: 0 },
        { tileId: '2A', tx: 1, ty: 0, rotation: 0 },
      ],
    });
    expect(starts).toEqual([{ x: 0, y: 0 }]);
  });
});

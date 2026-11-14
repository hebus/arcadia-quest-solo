import { describe, expect, it } from 'vitest';
import type { Board, TileLayout } from '../domain/schemas';
import { HERO_START_ENCLOSED, heroStartsEnclosed } from '../startArea';
import { createScenarioGame, scenarioBoard, validateScenario } from './definition';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES } from '@/game-data/original';
import { GAME_TILES } from '@/game-data/original/tiles';
import { CAVE_AUX_CENDRES } from '@/game-data/original/scenarios/cave-aux-cendres';

const tiles = CAVE_AUX_CENDRES.tiles!;
const withTiles = (t: TileLayout) => ({ ...CAVE_AUX_CENDRES, tiles: t });
const has = (list: { x: number; y: number }[] | undefined, x: number, y: number) => (list ?? []).some((c) => c.x === x && c.y === y);

describe('tuiles du jeu livrées avec l’application', () => {
  it('les 18 faces sont définies (1A/1B à 9A/9B)', () => {
    expect(GAME_TILES.map((t) => t.id)).toEqual(['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B', '7A', '7B', '8A', '8B', '9A', '9B']);
    expect(Object.keys(ORIGINAL_CONTENT.tiles ?? {})).toHaveLength(18);
  });
});

describe('scénario 1 construit depuis les tuiles', () => {
  const board = scenarioBoard(CAVE_AUX_CENDRES, ORIGINAL_CONTENT).board;

  it('le plateau reprend les définitions des tuiles : bâtiments, salle, case bloquée', () => {
    expect(board.width).toBe(9);
    expect(board.height).toBe(9);
    expect(has(board.blocked, 4, 4)).toBe(true); // le puits : case bloquée de la tuile 4A, au centre
    expect(has(board.holes, 4, 4)).toBe(true); // impassable pour le moteur
    expect(has(board.interior, 8, 0)).toBe(true); // la chapelle : bâtiment en L de la tuile 2A
    expect(has(board.interior, 0, 3)).toBe(true); // la remise : bâtiment en L de la tuile 8A
    expect(has(board.rooms, 7, 7)).toBe(true); // la grande salle de la tuile 1B
    expect(board.rooms).toHaveLength(9);
  });

  it('les tuiles n’ont pas de porte : les portes du scénario sont des pions posés sur les contours', () => {
    expect(board.doors.map((d) => d.id).sort()).toEqual(['porte-chapelle', 'porte-depart', 'porte-remise', 'porte-salle']);
    expect(board.doors.find((d) => d.id === 'porte-depart')!.open).toBe(true);
    expect(board.doors.filter((d) => !d.open)).toHaveLength(3);
  });

  it('une partie se crée depuis ce plateau et garde les tuiles pour l’affichage', () => {
    const g = createScenarioGame(CAVE_AUX_CENDRES, { sessionId: 's', difficulty: 'medium', seed: 1, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT);
    expect(g.tileLayout).toEqual(tiles);
    expect(g.board.holes).toEqual([{ x: 4, y: 4 }]);
  });

  it('une tuile non définie, ou des bâtiments décrits à la main, sont refusés', () => {
    expect(() => scenarioBoard(CAVE_AUX_CENDRES, { tiles: {} })).toThrow(/tuile 5A n'est pas définie/);
    const handMade = { ...CAVE_AUX_CENDRES, board: `${CAVE_AUX_CENDRES.board}\nroom 0,0 2x2` };
    expect(() => scenarioBoard(handMade, ORIGINAL_CONTENT)).toThrow(/viennent des tuiles/);
  });
});

describe('tuiles à utiliser dans un scénario : une seule face par tuile', () => {
  it('le scénario livré est valide : 9 tuiles, chacune sur une seule face', () => {
    expect(validateScenario(CAVE_AUX_CENDRES, ORIGINAL_CONTENT)).toEqual([]);
    expect(new Set(tiles.placements.map((p) => p.tileId.slice(0, 1))).size).toBe(9);
  });

  it('on ne peut pas utiliser les deux faces d’une même tuile, ni deux fois la même', () => {
    const both = validateScenario(withTiles({ ...tiles, placements: [...tiles.placements, { tileId: '2B', tx: 1, ty: 1, rotation: 0 }] }), ORIGINAL_CONTENT);
    expect(both.join()).toMatch(/tuile 2 est posée sur ses deux faces \(2A et 2B\)/);
    const twice = validateScenario(withTiles({ ...tiles, placements: [...tiles.placements, { tileId: '3B', tx: 1, ty: 1, rotation: 0 }] }), ORIGINAL_CONTENT);
    expect(twice.join()).toMatch(/face 3B est posée 2 fois/);
  });

  it('une tuile inconnue est refusée', () => {
    const unknown = validateScenario(withTiles({ ...tiles, placements: [{ tileId: '10A', tx: 0, ty: 0, rotation: 0 }] }), ORIGINAL_CONTENT);
    expect(unknown.join()).toMatch(/tuile 10A n'est pas définie/);
  });

  it('les tuiles doivent correspondre à la taille du plateau (3 cases par tuile)', () => {
    const small = { tilesW: 2, tilesH: 3, placements: tiles.placements.filter((p) => p.tx < 2) };
    expect(validateScenario(withTiles(small), ORIGINAL_CONTENT).join()).toMatch(/ne correspondent pas au plateau \(9×9\)/);
  });
});

describe('les héros doivent pouvoir sortir de leur bâtiment de départ', () => {
  const square = (walls: Board['walls'], doors: Board['doors'] = []): Board => ({
    width: 3,
    height: 3,
    holes: [],
    interior: [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }],
    walls,
    doors,
    portals: [],
  });
  const roof: Board['walls'] = [[{ x: 0, y: 1 }, { x: 0, y: 2 }], [{ x: 1, y: 1 }, { x: 1, y: 2 }], [{ x: 2, y: 1 }, { x: 2, y: 2 }]];
  const starts = [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }];

  it('un bâtiment de départ muré sans porte enferme les héros', () => {
    expect(heroStartsEnclosed(square(roof), starts)).toBe(true);
    expect(HERO_START_ENCLOSED).toMatch(/au moins une porte/);
  });

  it('une porte sur son contour, fermée ou ouverte, leur permet de sortir', () => {
    const door = (open: boolean) => [{ id: 'd', a: { x: 1, y: 1 }, b: { x: 1, y: 2 }, open }];
    const walls = roof.filter((w) => w[0].x !== 1); // la porte remplace le mur de son arête
    expect(heroStartsEnclosed(square(walls, door(false)), starts)).toBe(false);
    expect(heroStartsEnclosed(square(walls, door(true)), starts)).toBe(false);
  });

  it('partir dans la rue : rien à vérifier', () => {
    expect(heroStartsEnclosed(square(roof), [{ x: 1, y: 0 }])).toBe(false);
  });

  it('un scénario dont les héros sont enfermés est refusé', () => {
    const noDoor = { ...CAVE_AUX_CENDRES, board: CAVE_AUX_CENDRES.board.replace('door porte-depart 1,7-1,8 open\n', '') };
    expect(validateScenario(noDoor, ORIGINAL_CONTENT)).toContain(HERO_START_ENCLOSED);
    // Le scénario livré a la porte de départ (« porte-depart ») : ses héros sortent.
    expect(validateScenario(CAVE_AUX_CENDRES, ORIGINAL_CONTENT)).not.toContain(HERO_START_ENCLOSED);
  });
});

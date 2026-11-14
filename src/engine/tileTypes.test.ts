import { describe, expect, it } from 'vitest';
import { canHeroTarget, reachableCells } from './combat/heroMove';
import { parse } from './domain/validate';
import { TileDefSchema, boardFromLayout, effectiveWalls, pruneTile, roomGroups, type TileDef } from './tiles';
import { startScenario } from './turn/machine';
import { demoGame } from '@/tests/fixtures/demo';

const tile = (over: Partial<TileDef>): TileDef => parse(TileDefSchema, { id: '1A', name: '1A', ...over });
const layout = (rotation: 0 | 90 | 180 | 270 = 0) => ({ tilesW: 1, tilesH: 1, placements: [{ tileId: '1A', tx: 0, ty: 0, rotation }] });
const has = (list: { x: number; y: number }[] | undefined, x: number, y: number) => (list ?? []).some((c) => c.x === x && c.y === y);

describe('types de cases d’une tuile : rue, bâtiment, salle, bloquée', () => {
  it('par défaut, une face n’a ni salle ni case bloquée', () => {
    const t = tile({});
    expect(t.rooms).toEqual([]);
    expect(t.blocked).toEqual([]);
  });

  it('salle : fonctionne comme un bâtiment — contour muré automatiquement, une seule salle pour des cases contiguës', () => {
    const t = tile({ rooms: [{ x: 1, y: 1 }, { x: 2, y: 1 }] });
    const board = boardFromLayout({ '1A': t }, layout());
    expect(board.rooms).toEqual([{ x: 1, y: 1 }, { x: 2, y: 1 }]);
    expect(board.holes).toHaveLength(0);
    // Salle de 2 cases : 6 arêtes de contour, comme un bâtiment de 2 cases (sur un plateau d'une seule tuile, l'arête qui donne hors de la tuile est écartée).
    expect(effectiveWalls(t)).toHaveLength(6);
    expect(board.walls).toHaveLength(5);
    expect(roomGroups(t)).toHaveLength(1);
    expect(roomGroups(tile({ rooms: [{ x: 0, y: 0 }, { x: 2, y: 2 }] }))).toHaveLength(2);
    // Même contour qu'un bâtiment de même forme.
    const asBuilding = tile({ interior: [{ x: 1, y: 1 }, { x: 2, y: 1 }] });
    expect(effectiveWalls(t)).toHaveLength(effectiveWalls(asBuilding).length);
  });

  it('salle : on peut ouvrir un mur et poser une porte sur son contour, comme pour un bâtiment', () => {
    const t = tile({ rooms: [{ x: 1, y: 1 }], doors: [[{ x: 1, y: 1 }, { x: 0, y: 1 }]] });
    const board = boardFromLayout({ '1A': t }, layout());
    expect(board.doors).toHaveLength(1);
    expect(board.walls).toHaveLength(3); // 4 arêtes, dont une est devenue une porte
    // Une porte posée ailleurs que sur un mur est écartée par pruneTile.
    const stray = pruneTile(tile({ rooms: [{ x: 1, y: 1 }], doors: [[{ x: 0, y: 0 }, { x: 1, y: 0 }]] }));
    expect(stray.doors).toHaveLength(0);
    // Mur ouvert à la main dans le contour.
    const opened = tile({ rooms: [{ x: 1, y: 1 }], openedWalls: [[{ x: 1, y: 1 }, { x: 1, y: 0 }]] });
    expect(effectiveWalls(opened)).toHaveLength(3);
  });

  it('un bâtiment et une salle côte à côte sont séparés par un mur', () => {
    const t = tile({ interior: [{ x: 0, y: 1 }], rooms: [{ x: 1, y: 1 }] });
    const board = boardFromLayout({ '1A': t }, layout());
    const between = board.walls.filter(([a, b]) => (a.x === 0 && b.x === 1) || (a.x === 1 && b.x === 0));
    expect(between).toHaveLength(1); // une seule arête commune, comptée une fois
    expect(effectiveWalls(t)).toHaveLength(7); // 4 + 4 arêtes de contour, l'arête partagée comptée une fois
    expect(board.walls).toHaveLength(6); // l'arête qui donne hors de la tuile est écartée
  });

  it('case bloquée : impassable, comptée parmi les cases absentes', () => {
    const board = boardFromLayout({ '1A': tile({ blocked: [{ x: 1, y: 0 }] }) }, layout());
    expect(board.blocked).toEqual([{ x: 1, y: 0 }]);
    expect(has(board.holes, 1, 0)).toBe(true);
  });

  it('les cases suivent la rotation de la tuile', () => {
    const t = tile({ rooms: [{ x: 0, y: 2 }], blocked: [{ x: 0, y: 0 }] });
    const board = boardFromLayout({ '1A': t }, layout(90)); // quart de tour horaire : (x,y) → (2−y, x)
    expect(board.rooms).toEqual([{ x: 0, y: 0 }]);
    expect(board.blocked).toEqual([{ x: 2, y: 0 }]);
  });

  it('une case bloquée arrête le déplacement et la ligne de vue', () => {
    const board = boardFromLayout({ '1A': tile({ blocked: [{ x: 1, y: 0 }] }) }, layout());
    const g = startScenario(
      demoGame({
        board,
        heroes: [
          { id: 'h1', name: 'Grom', life: 4, defense: 0, position: { x: 0, y: 0 } },
          { id: 'h2', name: 'Maya', life: 3, defense: 0, position: { x: 0, y: 2 } },
          { id: 'h3', name: 'Zazu', life: 3, defense: 0, position: { x: 2, y: 2 } },
        ],
        monsters: [{ id: 'g1', definitionId: 'goblin', position: { x: 2, y: 0 } }],
        spawnPoints: [{ id: 'S', at: { x: 0, y: 1 }, dice: ['A', 'B'] }],
      }),
    );
    const reach = reachableCells(g, 'h1', 3);
    expect(reach.some((r) => r.pos.x === 1 && r.pos.y === 0)).toBe(false); // impossible de s'y arrêter ni de la traverser
    expect(reach.some((r) => r.pos.x === 1 && r.pos.y === 1)).toBe(true); // le contournement reste possible
    expect(canHeroTarget(g, 'h1', 'g1', 'ranged')).toBe(false); // le bloc coupe le trait entre (0,0) et (2,0)
  });
});

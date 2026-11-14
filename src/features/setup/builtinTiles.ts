import { parse } from '@/engine/domain/validate';
import { TileDefSchema, type TileDef } from '@/engine/tiles';

/** Tuile de rue vierge : toutes les cases sont franchissables. */
export const BLANK_TILE: TileDef = parse(TileDefSchema, { id: '__blank', name: 'Tuile de rue vierge' });

/** Tuile d'exemple : une maison de 2×2 cases au centre, avec une porte sur le côté gauche. */
export const DEMO_HOUSE_TILE: TileDef = parse(TileDefSchema, {
  id: '__house',
  name: 'Tuile démo avec maison',
  interior: [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
  ],
  doors: [[{ x: 0, y: 1 }, { x: 1, y: 1 }]],
});

/** Tuiles toujours disponibles, en plus de la bibliothèque de scans. */
export const BUILTIN_TILES: TileDef[] = [BLANK_TILE, DEMO_HOUSE_TILE];

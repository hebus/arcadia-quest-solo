import { parse } from '@/engine/domain/validate';
import { GAME_TILES } from '@/game-data/original/tiles';
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

/**
 * Toutes les tuiles utilisables : tuiles de test, tuiles du jeu livrées avec l'application, puis celles de la bibliothèque de
 * l'appareil (qui l'emportent à code égal : on peut corriger une face sans toucher aux données livrées).
 */
export const allTiles = (library: readonly TileDef[]): TileDef[] => [...new Map([...BUILTIN_TILES, ...GAME_TILES, ...library].map((t) => [t.id, t] as const)).values()];

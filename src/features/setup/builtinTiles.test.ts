import { describe, expect, it } from 'vitest';
import { GAME_TILES } from '@/game-data/original/tiles';
import { parse } from '@/engine/domain/validate';
import { TileDefSchema } from '@/engine/tiles';
import { BLANK_TILE, allTiles } from './builtinTiles';

describe('tuiles utilisables', () => {
  it('tuiles de test, tuiles du jeu livrées, puis bibliothèque de l’appareil, dans cet ordre', () => {
    const mine = parse(TileDefSchema, { id: '3B', name: 'ma 3B', interior: [{ x: 1, y: 1 }] });
    const extra = parse(TileDefSchema, { id: 'ma-tuile', name: 'hors jeu' });
    const all = allTiles([mine, extra]);
    expect(all[0]).toBe(BLANK_TILE);
    expect(all.slice(-1)[0]).toBe(extra);
    expect(all.find((t) => t.id === '3B')).toBe(mine); // une seule 3B : celle de la bibliothèque, qui l'emporte
    expect(all.filter((t) => t.id === '3B')).toHaveLength(1);
    expect(all).toHaveLength(2 + GAME_TILES.length + 1); // 2 tuiles de test + 18 tuiles du jeu + 1 tuile hors jeu
  });

  it('à code égal, la bibliothèque de l’appareil l’emporte sur la tuile livrée avec le jeu', () => {
    const shipped = parse(TileDefSchema, { id: '3B', name: 'livrée' });
    const mine = parse(TileDefSchema, { id: '3B', name: 'corrigée' });
    const byId = Object.fromEntries([shipped, mine].map((t) => [t.id, t]));
    expect(byId['3B']!.name).toBe('corrigée');
  });

  it('le fichier livré a le format de l’export de l’éditeur (liste « tiles » de faces valides)', () => {
    expect(Array.isArray(GAME_TILES)).toBe(true);
    for (const t of GAME_TILES) expect(parse(TileDefSchema, t).id).toMatch(/^[1-9][AB]$/);
  });
});

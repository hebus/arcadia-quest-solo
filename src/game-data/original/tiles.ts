import type { TileDef } from '@/engine/tiles';
import { TileDefSchema } from '@/engine/tiles';
import { parse } from '@/engine/domain/validate';
import data from './tiles.json';

/**
 * Les tuiles du jeu physique (1A/1B à 9A/9B), livrées avec l'application : murs, bâtiments, salles, cases bloquées, portes,
 * zones de départ des héros et scans. Le fichier `tiles.json` est l'export de l'éditeur de tuiles (bouton « Exporter ») :
 * pour mettre à jour les tuiles du jeu, on remplace son contenu par un nouvel export.
 */
const file = data as { tiles?: unknown[] };
export const GAME_TILES: TileDef[] = (file.tiles ?? []).map((t) => parse(TileDefSchema, t));

import { TILE } from './tiles';

/**
 * Les tuiles du jeu de base : 9 tuiles doubles faces, numérotées de 1 à 9. Chaque face a un code : le numéro puis la face
 * A ou B (1A, 1B … 9A, 9B).
 * Une tuile est une grille de 3×3 cases ; une seule face d'une même tuile peut être sur le plateau, et chaque tuile
 * n'existe qu'en un exemplaire : un plateau compte donc 9 tuiles au plus.
 */
export const TILE_NUMBERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
export const TILE_FACES = ['A', 'B'] as const;
export const CATALOG_TILE_IDS: readonly string[] = TILE_NUMBERS.flatMap((n) => TILE_FACES.map((f) => `${n}${f}`));
export const TILES_IN_GAME = TILE_NUMBERS.length;
export const CELLS_PER_TILE = TILE * TILE;

export const isCatalogTile = (id: string): boolean => CATALOG_TILE_IDS.includes(id);
/** Numéro de la tuile (1 à 9) d'un code de face. */
export const tileNumber = (id: string): string => id.slice(0, 1);
/** Face (A ou B) d'un code. */
export const tileFace = (id: string): string => id.slice(1, 2);
export const otherFace = (id: string): string => `${tileNumber(id)}${id.endsWith('A') ? 'B' : 'A'}`;

/** Lit un code de face dans un nom de fichier ou de tuile (« 1A.png », « tuile-2b », « 3 A »). */
export function parseTileCode(text: string): string | null {
  const m = /(?:^|[^a-z0-9])([1-9])[\s_-]?([ab])(?![a-z0-9])/i.exec(text);
  return m ? `${m[1]}${m[2]!.toUpperCase()}` : null;
}

export interface TilePlacementProblems {
  errors: string[];
  /** Tuiles qui ne sont pas du jeu de base (tuiles de test) : acceptées, mais le plateau n'est pas réalisable en vrai. */
  notInGame: string[];
}

/**
 * Contrôle les tuiles posées : un plateau réel utilise chaque tuile (1 à 9) une seule fois, sur une seule de ses faces.
 */
export function tilePlacementProblems(tileIds: readonly string[]): TilePlacementProblems {
  const errors: string[] = [];
  const count = new Map<string, number>();
  for (const id of tileIds) if (isCatalogTile(id)) count.set(id, (count.get(id) ?? 0) + 1);
  for (const [id, n] of count) if (n > 1) errors.push(`La face ${id} est posée ${n} fois : chaque tuile n'existe qu'en un exemplaire.`);
  for (const number of TILE_NUMBERS) {
    const faces = TILE_FACES.map((f) => `${number}${f}`).filter((id) => count.has(id));
    if (faces.length > 1) errors.push(`La tuile ${number} est posée sur ses deux faces (${faces.join(' et ')}) : elle est double face, une seule face peut être sur le plateau.`);
  }
  return { errors, notInGame: [...new Set(tileIds.filter((id) => !isCatalogTile(id)))] };
}

/** Faces encore posables : celles dont la tuile n'est pas déjà sur le plateau (hors l'emplacement `exceptTileId`, en cours de changement). */
export function freeTileFaces(tileIds: readonly string[], exceptTileId?: string): string[] {
  const used = new Set(tileIds.filter((id) => id !== exceptTileId && isCatalogTile(id)).map(tileNumber));
  return CATALOG_TILE_IDS.filter((id) => !used.has(tileNumber(id)));
}

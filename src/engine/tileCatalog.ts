import { TILE } from './tiles';

/**
 * Les tuiles du jeu de base : 9 tuiles doubles faces, A à I. Chaque face a un code (A1, A2 … I1, I2).
 * Une tuile est une grille de 3×3 cases ; une seule face d'une même tuile peut être sur le plateau, et chaque tuile
 * n'existe qu'en un exemplaire : un plateau compte donc 9 tuiles au plus.
 */
export const TILE_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const;
export const TILE_FACES = ['1', '2'] as const;
export const CATALOG_TILE_IDS: readonly string[] = TILE_LETTERS.flatMap((l) => TILE_FACES.map((f) => `${l}${f}`));
export const TILES_IN_GAME = TILE_LETTERS.length;
export const CELLS_PER_TILE = TILE * TILE;

export const isCatalogTile = (id: string): boolean => CATALOG_TILE_IDS.includes(id);
export const tileLetter = (id: string): string => id.slice(0, 1);
export const otherFace = (id: string): string => `${tileLetter(id)}${id.endsWith('1') ? '2' : '1'}`;

/** Lit un code de face dans un nom de fichier ou de tuile (« A1.png », « tuile-b2 », « C 1 »). */
export function parseTileCode(text: string): string | null {
  const m = /(?:^|[^a-z0-9])([a-i])[\s_-]?([12])(?![0-9])/i.exec(text) ?? /^([a-i])[\s_-]?([12])(?![0-9])/i.exec(text);
  return m ? `${m[1]!.toUpperCase()}${m[2]}` : null;
}

export interface TilePlacementProblems {
  errors: string[];
  /** Tuiles qui ne sont pas du jeu de base (tuiles de test) : acceptées, mais le plateau n'est pas réalisable en vrai. */
  notInGame: string[];
}

/**
 * Contrôle les tuiles posées : un plateau réel utilise chaque tuile (A à I) une seule fois, sur une seule de ses faces.
 */
export function tilePlacementProblems(tileIds: readonly string[]): TilePlacementProblems {
  const errors: string[] = [];
  const count = new Map<string, number>();
  for (const id of tileIds) if (isCatalogTile(id)) count.set(id, (count.get(id) ?? 0) + 1);
  for (const [id, n] of count) if (n > 1) errors.push(`La face ${id} est posée ${n} fois : chaque tuile n'existe qu'en un exemplaire.`);
  for (const letter of TILE_LETTERS) {
    const faces = TILE_FACES.map((f) => `${letter}${f}`).filter((id) => count.has(id));
    if (faces.length > 1) errors.push(`La tuile ${letter} est posée sur ses deux faces (${faces.join(' et ')}) : elle est double face, une seule face peut être sur le plateau.`);
  }
  return { errors, notInGame: [...new Set(tileIds.filter((id) => !isCatalogTile(id)))] };
}

/** Faces encore posables : celles dont la tuile n'est pas déjà sur le plateau (hors l'emplacement `exceptTileId`, en cours de changement). */
export function freeTileFaces(tileIds: readonly string[], exceptTileId?: string): string[] {
  const used = new Set(tileIds.filter((id) => id !== exceptTileId && isCatalogTile(id)).map(tileLetter));
  return CATALOG_TILE_IDS.filter((id) => !used.has(tileLetter(id)));
}

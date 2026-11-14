import type { Board, Position } from './domain/schemas';
import { key, neighbors, samePos } from './movement/board';

const sameEdge = (a: Position, b: Position, p: Position, q: Position): boolean => (samePos(a, p) && samePos(b, q)) || (samePos(a, q) && samePos(b, p));

/**
 * Les héros peuvent-ils quitter leur zone de départ ? On part de leurs cases : un mur arrête le passage, une porte (ouverte ou
 * fermée : un héros peut l'ouvrir) le laisse passer. Si les cases atteignables ne comptent que des cases de bâtiment ou de salle,
 * les héros sont enfermés : il faut au moins une porte sur le contour de leur bâtiment de départ.
 */
export function heroStartsEnclosed(board: Board, starts: readonly Position[]): boolean {
  if (starts.length === 0) return false;
  const inside = (p: Position) => [...(board.interior ?? []), ...(board.rooms ?? [])].some((c) => samePos(c, p));
  const seen = new Set<string>(starts.map(key));
  const queue = [...starts];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]!;
    if (!inside(p)) return false; // une case de rue est atteignable : on peut sortir
    for (const n of neighbors(board, p)) {
      if (seen.has(key(n))) continue;
      if (board.walls.some(([a, b]) => sameEdge(a, b, p, n))) continue; // mur : pas de passage (une porte a retiré le mur de son arête)
      seen.add(key(n));
      queue.push(n);
    }
  }
  return true;
}

export const HERO_START_ENCLOSED = 'Les héros ne peuvent pas sortir de leur bâtiment de départ : posez au moins une porte sur son contour.';

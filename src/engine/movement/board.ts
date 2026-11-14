import type { Board, GameState, Position } from '../domain/schemas';

/** Une Space accueille au maximum deux personnages, héros ou monstres (rulebook p.13). */
export const CELL_CAPACITY = 2;

export const key = (p: Position): string => `${p.x},${p.y}`;
export const samePos = (a: Position, b: Position): boolean => a.x === b.x && a.y === b.y;

const DIRS: Position[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export function inBoard(board: Board, p: Position): boolean {
  if (p.x < 0 || p.y < 0 || p.x >= board.width || p.y >= board.height) return false;
  return !board.holes.some((h) => samePos(h, p));
}

const edgeKey = (a: Position, b: Position): string => {
  const ka = key(a);
  const kb = key(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
};

/** Une arête est bloquée par un mur ou par une porte fermée (porte ouverte dans le plateau ou ouverte pendant le plan). */
export function edgeBlocked(
  board: Board,
  a: Position,
  b: Position,
  openedDoors: ReadonlySet<string> = new Set(),
): boolean {
  const k = edgeKey(a, b);
  if (board.walls.some(([p, q]) => edgeKey(p, q) === k)) return true;
  const door = board.doors.find((d) => edgeKey(d.a, d.b) === k);
  if (door) return !(door.open || openedDoors.has(door.id));
  return false;
}

export function doorBetween(board: Board, a: Position, b: Position) {
  const k = edgeKey(a, b);
  return board.doors.find((d) => edgeKey(d.a, d.b) === k);
}

export function neighbors(board: Board, p: Position): Position[] {
  return DIRS.map((d) => ({ x: p.x + d.x, y: p.y + d.y })).filter((q) => inBoard(board, q));
}

/** « Close » : même Space ou Space orthogonale dont l'arête commune est ouverte (rulebook p.13). */
export function isClose(
  board: Board,
  a: Position,
  b: Position,
  openedDoors: ReadonlySet<string> = new Set(),
): boolean {
  if (samePos(a, b)) return true;
  if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== 1) return false;
  return !edgeBlocked(board, a, b, openedDoors);
}

/** Distance de sélection du monstre (solo v1.3 p.2) : Spaces orthogonales, terrain ignoré. */
export function selectionDistance(spawn: Position, monster: Position): number {
  return Math.abs(spawn.x - monster.x) + Math.abs(spawn.y - monster.y);
}

export interface Occupancy {
  heroes: number;
  monsters: number;
  pets: number;
}

/** Personnages présents sur une Space. L'acteur éventuel est exclu du décompte. */
export function occupancy(state: GameState, p: Position, excludeId?: string): Occupancy {
  return {
    heroes: state.heroes.filter((h) => !h.dead && h.position && samePos(h.position, p) && h.id !== excludeId)
      .length,
    monsters: state.monsters.filter(
      (m) => m.status === 'board' && m.position && samePos(m.position, p) && m.id !== excludeId,
    ).length,
    pets: state.pets.filter((x) => !x.dead && x.position && samePos(x.position, p) && x.id !== excludeId)
      .length,
  };
}

/** Du point de vue d'un monstre : ennemis = héros et familiers, alliés = autres monstres. */
export function monsterView(state: GameState, p: Position, actorId: string) {
  const o = occupancy(state, p, actorId);
  const enemies = o.heroes + o.pets;
  const allies = o.monsters;
  const total = enemies + allies;
  return {
    // Un ennemi remplit la case : on ne la traverse pas ; un allié se traverse mais on ne s'y arrête pas.
    blocked: enemies >= CELL_CAPACITY,
    full: total >= CELL_CAPACITY,
    canTraverse: enemies < CELL_CAPACITY,
    canEnd: total < CELL_CAPACITY,
    allies,
    enemies,
  };
}

/**
 * Une case traversée par la ligne de vue la bloque-t-elle ? Réglage « any-character » : tout personnage présent
 * (héros, monstre, familier) la bloque ; sinon la règle du livret (`officialBlocked` : case bloquée par 2 ennemis).
 * Les cases de l'attaquant et de la cible ne sont jamais testées.
 */
export function sightBlockedAt(state: GameState, actorId: string, p: Position, officialBlocked: boolean): boolean {
  if (state.settings.lineOfSight !== 'any-character') return officialBlocked;
  const o = occupancy(state, p, actorId);
  return o.heroes + o.monsters + o.pets > 0;
}

/**
 * Ligne de vue entre les centres de deux Spaces (rulebook p.16-17).
 * Bloquée par mur, porte fermée, Space Blocked (2 ennemis de l'acteur) ou sortie du plateau.
 * Un coin effleuré en diagonale ne bloque que si les deux côtés sont bloqués.
 */
export function hasLineOfSight(
  state: GameState,
  from: Position,
  to: Position,
  blockedAt: (p: Position) => boolean,
  openedDoors: ReadonlySet<string> = new Set(),
): boolean {
  const board = state.board;
  if (samePos(from, to)) return true;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  const tDeltaX = dx === 0 ? Infinity : 1 / Math.abs(dx);
  const tDeltaY = dy === 0 ? Infinity : 1 / Math.abs(dy);
  let tMaxX = dx === 0 ? Infinity : 0.5 * tDeltaX;
  let tMaxY = dy === 0 ? Infinity : 0.5 * tDeltaY;
  let cur = { ...from };
  const EPS = 1e-9;
  for (let guard = 0; guard < 1000 && !samePos(cur, to); guard++) {
    let next: Position;
    if (Math.abs(tMaxX - tMaxY) < EPS) {
      next = { x: cur.x + stepX, y: cur.y + stepY };
      const viaX = { x: cur.x + stepX, y: cur.y };
      const viaY = { x: cur.x, y: cur.y + stepY };
      const routeClear = (mid: Position) =>
        inBoard(board, mid) &&
        !edgeBlocked(board, cur, mid, openedDoors) &&
        !edgeBlocked(board, mid, next, openedDoors);
      if (!inBoard(board, next) || !(routeClear(viaX) || routeClear(viaY))) return false;
      tMaxX += tDeltaX;
      tMaxY += tDeltaY;
    } else if (tMaxX < tMaxY) {
      next = { x: cur.x + stepX, y: cur.y };
      if (!inBoard(board, next) || edgeBlocked(board, cur, next, openedDoors)) return false;
      tMaxX += tDeltaX;
    } else {
      next = { x: cur.x, y: cur.y + stepY };
      if (!inBoard(board, next) || edgeBlocked(board, cur, next, openedDoors)) return false;
      tMaxY += tDeltaY;
    }
    if (!samePos(next, to) && blockedAt(next)) return false;
    cur = next;
  }
  return true;
}

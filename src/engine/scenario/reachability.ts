import type { Board, Portal, Position } from '../domain/schemas';
import { DOOR_TOKENS } from '../doorTokens';
import { edgeBlocked, inBoard, key, neighbors } from '../movement/board';
import { PORTAL_TOKENS } from '../portals';

/**
 * Cases que les héros peuvent atteindre depuis leurs cases de départ : un mur ou une case bloquée arrête le passage ; une
 * porte, ouverte ou fermée, se passe (un héros ouvre la porte en la traversant) ; un portail téléporte sur les autres portails
 * de la même couleur.
 */
export function reachableCells(board: Board, starts: readonly Position[]): Set<string> {
  const openAll = new Set(board.doors.map((d) => d.id));
  const portalAt = new Map(board.portals.map((p) => [key(p.at), p]));
  const seen = new Set<string>(starts.map(key));
  const queue = [...starts];
  const visit = (p: Position) => {
    if (seen.has(key(p))) return;
    seen.add(key(p));
    queue.push(p);
  };
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i]!;
    for (const n of neighbors(board, at)) if (!edgeBlocked(board, at, n, openAll)) visit(n);
    const here = portalAt.get(key(at));
    if (here) for (const dest of board.portals) if (dest.id !== here.id && dest.color === here.color) visit(dest.at);
  }
  return seen;
}

/** Distance de marche (en cases, portes franchissables, sans portail) depuis les cases de départ. */
export function walkDistances(board: Board, starts: readonly Position[]): Map<string, number> {
  const openAll = new Set(board.doors.map((d) => d.id));
  const dist = new Map<string, number>(starts.map((s) => [key(s), 0]));
  const queue = [...starts];
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i]!;
    for (const n of neighbors(board, at)) {
      if (dist.has(key(n)) || edgeBlocked(board, at, n, openAll)) continue;
      dist.set(key(n), dist.get(key(at))! + 1);
      queue.push(n);
    }
  }
  return dist;
}

/** Cases jouables du plateau (hors trous et cases bloquées). */
export function playableCells(board: Board): Position[] {
  const holes = new Set(board.holes.map(key));
  const out: Position[] = [];
  for (let y = 0; y < board.height; y++) for (let x = 0; x < board.width; x++) if (!holes.has(`${x},${y}`)) out.push({ x, y });
  return out;
}

/** Les cases jouables qu'aucun chemin ne relie aux cases de départ des héros. */
export function unreachableCells(board: Board, starts: readonly Position[]): Position[] {
  const reach = reachableCells(board, starts);
  return playableCells(board).filter((p) => !reach.has(key(p)));
}

/** Pion porte à poser sur un mur pour rejoindre une zone isolée. */
export interface ConnectingDoor {
  a: Position;
  b: Position;
}

export interface Connections {
  doors: ConnectingDoor[];
  portals: Pick<Portal, 'at' | 'color'>[];
}

const PORTAL_COLOR = 'violet';
const dist = (a: Position, b: Position) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/**
 * Ce qu'il faut ajouter pour que toutes les cases jouables soient atteignables depuis le départ des héros.
 * 1. Des portes : on perce, une à une, le mur qui rattache le plus de cases isolées (un pion porte remplace un mur), dans la
 *    limite de `maxDoors` et des 22 pions porte de la boîte.
 * 2. Des portails pour ce que les portes ne rejoignent pas (zone entourée de cases bloquées, ou portes épuisées) : un portail
 *    dans la zone isolée et, s'il n'y en a pas déjà un de la même couleur dans la zone atteignable, un autre côté départ ;
 *    toujours dans la limite des 8 jetons portail.
 * `reserved` : cases à ne pas occuper par un portail (départ des héros, monstres, jetons Spawn, objectifs, renforts).
 */
export function connectBoard(board: Board, starts: readonly Position[], opts: { maxDoors?: number; reserved?: readonly Position[] } = {}): Connections {
  const out: Connections = { doors: [], portals: [] };
  let cur = board;
  const doorRoom = Math.max(0, Math.min(opts.maxDoors ?? 6, DOOR_TOKENS - board.doors.length));
  while (out.doors.length < doorRoom) {
    const reach = reachableCells(cur, starts);
    if (playableCells(cur).every((p) => reach.has(key(p)))) break;
    let best: { wall: Board['walls'][number]; gain: number } | null = null;
    for (const wall of cur.walls) {
      const [p, q] = wall;
      if (reach.has(key(p)) === reach.has(key(q))) continue;
      if (!inBoard(cur, p) || !inBoard(cur, q)) continue;
      const trial: Board = { ...cur, walls: cur.walls.filter((w) => w !== wall), doors: [...cur.doors, { id: '_', a: p, b: q, open: false }] };
      const gain = reachableCells(trial, starts).size - reach.size;
      if (!best || gain > best.gain) best = { wall, gain };
    }
    if (!best || best.gain <= 0) break;
    const [a, b] = best.wall;
    out.doors.push({ a, b });
    cur = { ...cur, walls: cur.walls.filter((w) => w !== best!.wall), doors: [...cur.doors, { id: `_${out.doors.length}`, a, b, open: false }] };
  }

  const hard = new Set([...starts, ...cur.portals.map((p) => p.at)].map(key)); // jamais deux jetons sur une case, ni sous un départ
  const taken = new Set([...(opts.reserved ?? []), ...hard]);
  let guard = 0;
  while (cur.portals.length + out.portals.length < PORTAL_TOKENS && guard++ < PORTAL_TOKENS) {
    const reach = reachableCells(cur, starts);
    const isolated = playableCells(cur).filter((p) => !reach.has(key(p)));
    if (isolated.length === 0) break;
    const zone = reachableCells(cur, [isolated[0]!]);
    const inZoneAll = isolated.filter((p) => zone.has(key(p)) && !hard.has(key(p)));
    // Une case libre de préférence ; à défaut, le jeton se pose sous une figurine ou un objectif (il ne gêne pas).
    const inZone = inZoneAll.filter((p) => !taken.has(key(p)));
    if (inZoneAll.length === 0) break;
    const target = (inZone[0] ?? inZoneAll[0])!;
    const haveViolet = cur.portals.some((p) => p.color === PORTAL_COLOR && reach.has(key(p.at)));
    const needTwo = !haveViolet;
    if (cur.portals.length + out.portals.length + (needTwo ? 2 : 1) > PORTAL_TOKENS) break;
    const add: Pick<Portal, 'at' | 'color'>[] = [{ at: target, color: PORTAL_COLOR }];
    if (needTwo) {
      const near = [...reach]
        .map((k) => ({ x: Number(k.split(',')[0]), y: Number(k.split(',')[1]) }))
        .filter((p) => !hard.has(key(p)))
        .sort((a, b) => Number(taken.has(key(a))) - Number(taken.has(key(b))) || dist(a, target) - dist(b, target))[0];
      if (!near) break;
      add.push({ at: near, color: PORTAL_COLOR });
    }
    for (const p of add) {
      taken.add(key(p.at));
      hard.add(key(p.at));
      out.portals.push(p);
      cur = { ...cur, portals: [...cur.portals, { id: `_p${out.portals.length}`, at: p.at, color: p.color }] };
    }
  }
  return out;
}

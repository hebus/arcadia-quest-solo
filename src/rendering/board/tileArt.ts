import type { Board, Position } from '@/engine/domain/schemas';

/**
 * Art de tuile généré par le code : pavés pour la rue, parquet pour l'intérieur des bâtiments.
 * Fonctions pures et déterministes (même case = même dessin), exprimées en primitives vectorielles
 * dans l'espace d'une case de 1×1 ; le rendu les met à l'échelle.
 */

export type ArtPrimitive =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; rx: number; fill: string; opacity?: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; width: number; opacity?: number }
  | { kind: 'dot'; cx: number; cy: number; r: number; fill: string; opacity?: number };

export type CellKind = 'street' | 'interior' | 'room' | 'blocked';

/** Hachage entier 32 bits → nombre dans [0, 1[. */
export function hash01(x: number, y: number, salt = 0): number {
  let h = Math.imul(x + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(y + 0x7f4a7c15, 0xc2b2ae35) ^ Math.imul(salt + 1, 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const STREET_TONES = ['#3b3631', '#403a34', '#37322d', '#443d36'];
const COBBLE_TONES = ['#57504a', '#625a52', '#4d4640', '#6a6158'];
const WOOD_TONES = ['#6b4a2b', '#745130', '#62432a', '#7a5733'];
const PLANK_LINE = '#2f2012';
const SLAB_TONES = ['#3d4a55', '#43525e', '#384650', '#485865'];
const SLAB_LINE = '#1d252c';
const ROCK_TONES = ['#1c1917', '#211e1c', '#171412'];

const pick = <T>(arr: readonly T[], r: number): T => arr[Math.min(arr.length - 1, Math.floor(r * arr.length))]!;

function streetCell(p: Position): ArtPrimitive[] {
  const out: ArtPrimitive[] = [{ kind: 'rect', x: 0, y: 0, w: 1, h: 1, rx: 0, fill: pick(STREET_TONES, hash01(p.x, p.y, 1)) }];
  // Quatre pavés par case, de taille et de teinte légèrement variables.
  for (let i = 0; i < 4; i++) {
    const cx = (i % 2) * 0.5;
    const cy = Math.floor(i / 2) * 0.5;
    const jx = hash01(p.x, p.y, 10 + i) * 0.05;
    const jy = hash01(p.x, p.y, 20 + i) * 0.05;
    const w = 0.38 + hash01(p.x, p.y, 30 + i) * 0.07;
    const h = 0.38 + hash01(p.x, p.y, 40 + i) * 0.07;
    out.push({
      kind: 'rect',
      x: cx + 0.04 + jx,
      y: cy + 0.04 + jy,
      w,
      h,
      rx: 0.07,
      fill: pick(COBBLE_TONES, hash01(p.x, p.y, 50 + i)),
      opacity: 0.55 + hash01(p.x, p.y, 60 + i) * 0.35,
    });
  }
  return out;
}

function interiorCell(p: Position): ArtPrimitive[] {
  const out: ArtPrimitive[] = [{ kind: 'rect', x: 0, y: 0, w: 1, h: 1, rx: 0, fill: pick(WOOD_TONES, hash01(p.x, p.y, 2)) }];
  // Lames de parquet horizontales, avec joints décalés d'une ligne à l'autre.
  for (let i = 1; i < 4; i++) {
    out.push({ kind: 'line', x1: 0, y1: i / 4, x2: 1, y2: i / 4, stroke: PLANK_LINE, width: 0.025, opacity: 0.7 });
  }
  for (let i = 0; i < 4; i++) {
    const jx = 0.2 + hash01(p.x, p.y, 70 + i) * 0.6;
    out.push({ kind: 'line', x1: jx, y1: i / 4, x2: jx, y2: (i + 1) / 4, stroke: PLANK_LINE, width: 0.02, opacity: 0.55 });
  }
  if (hash01(p.x, p.y, 99) > 0.8) {
    out.push({ kind: 'dot', cx: 0.2 + hash01(p.x, p.y, 100) * 0.6, cy: 0.2 + hash01(p.x, p.y, 101) * 0.6, r: 0.04, fill: PLANK_LINE, opacity: 0.8 });
  }
  return out;
}

/** Salle : grandes dalles de pierre bleutées, distinctes des pavés de la rue et du parquet des bâtiments. */
function roomCell(p: Position): ArtPrimitive[] {
  const out: ArtPrimitive[] = [{ kind: 'rect', x: 0, y: 0, w: 1, h: 1, rx: 0, fill: pick(SLAB_TONES, hash01(p.x, p.y, 3)) }];
  out.push({ kind: 'line', x1: 0.5, y1: 0, x2: 0.5, y2: 1, stroke: SLAB_LINE, width: 0.03, opacity: 0.65 });
  out.push({ kind: 'line', x1: 0, y1: 0.5, x2: 1, y2: 0.5, stroke: SLAB_LINE, width: 0.03, opacity: 0.65 });
  if (hash01(p.x, p.y, 120) > 0.7) out.push({ kind: 'dot', cx: 0.25 + hash01(p.x, p.y, 121) * 0.5, cy: 0.25 + hash01(p.x, p.y, 122) * 0.5, r: 0.05, fill: SLAB_LINE, opacity: 0.5 });
  return out;
}

/** Case bloquée : bloc de roche sombre, barré en croix pour qu'on voie qu'on n'y passe pas. */
function blockedCell(p: Position): ArtPrimitive[] {
  return [
    { kind: 'rect', x: 0, y: 0, w: 1, h: 1, rx: 0, fill: pick(ROCK_TONES, hash01(p.x, p.y, 4)) },
    { kind: 'rect', x: 0.06, y: 0.06, w: 0.88, h: 0.88, rx: 0.1, fill: '#292524' },
    { kind: 'line', x1: 0.15, y1: 0.15, x2: 0.85, y2: 0.85, stroke: '#57534e', width: 0.06, opacity: 0.8 },
    { kind: 'line', x1: 0.85, y1: 0.15, x2: 0.15, y2: 0.85, stroke: '#57534e', width: 0.06, opacity: 0.8 },
  ];
}

export function cellArt(kind: CellKind, p: Position): ArtPrimitive[] {
  if (kind === 'blocked') return blockedCell(p);
  if (kind === 'room') return roomCell(p);
  return kind === 'interior' ? interiorCell(p) : streetCell(p);
}

/** Nature d'une case du plateau : bloquée, intérieur d'un bâtiment, salle ou rue. */
export function cellKind(board: Pick<Board, 'interior' | 'rooms' | 'blocked'>, p: Position): CellKind {
  const has = (list: Position[] | undefined) => (list ?? []).some((c) => c.x === p.x && c.y === p.y);
  if (has(board.blocked)) return 'blocked';
  if (has(board.interior)) return 'interior';
  return has(board.rooms) ? 'room' : 'street';
}

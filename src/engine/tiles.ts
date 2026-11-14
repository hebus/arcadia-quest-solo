import { type } from 'arktype';
import {
  PositionSchema,
  RotationSchema,
  TileLayoutSchema,
  TilePlacementSchema,
  type Board,
  type Door,
  type Portal,
  type Position,
  type Rotation,
  type TileLayout,
  type TilePlacement,
} from './domain/schemas';

export { RotationSchema, TileLayoutSchema, TilePlacementSchema };
export type { Rotation, TileLayout, TilePlacement };

/** Chaque tuile du jeu est découpée en 3×3 Spaces (rulebook p.13). */
export const TILE = 3;

export const EdgeSchema = type([PositionSchema, PositionSchema]);
export type Edge = typeof EdgeSchema.infer;

/**
 * Une face de tuile scannée. Par défaut c'est une tuile de rue : toutes les cases sont franchissables.
 * L'utilisateur marque des cases comme « intérieur » ; des cases d'intérieur contiguës forment un bâtiment,
 * dont le contour est muré automatiquement. Il peut ensuite ajouter ou retirer des portes et des murs.
 * Les arêtes vers l'extérieur de la tuile utilisent une Space hors du carré 0..2 (ex. x = -1 ou 3).
 */
export const TileDefSchema = type({
  id: 'string',
  name: 'string',
  'image?': 'string | undefined',
  /** Marges (en % de l'image) retirées à gauche, en haut, à droite, en bas pour aligner la grille. */
  crop: [{ l: 'number', t: 'number', r: 'number', b: 'number' }, '=', () => ({ l: 0, t: 0, r: 0, b: 0 })],
  /** Rotation appliquée au scan pour le remettre droit. */
  imageRotation: [RotationSchema, '=', 0],
  /** Cases d'intérieur (bâtiments). */
  interior: [PositionSchema.array(), '=', () => []],
  /** Murs ajoutés à la main. */
  walls: [EdgeSchema.array(), '=', () => []],
  /** Murs de bâtiment supprimés à la main (ouverture dans le contour). */
  openedWalls: [EdgeSchema.array(), '=', () => []],
  /** Portes de la tuile (sur le contour d'un bâtiment) : fermées par défaut, état réglé à la mise en place. */
  doors: [EdgeSchema.array(), '=', () => []],
});
export type TileDef = typeof TileDefSchema.infer;

/** Rotation d'une Space locale dans le carré 3×3, par quarts de tour horaires (valable aussi hors du carré). */
export function rotateLocal(p: Position, rotation: Rotation): Position {
  let q = { ...p };
  for (let i = 0; i < rotation / 90; i++) q = { x: TILE - 1 - q.y, y: q.x };
  return q;
}

export const rotateEdge = (e: Edge, r: Rotation): Edge => [rotateLocal(e[0], r), rotateLocal(e[1], r)];

const pk = (p: Position) => `${p.x},${p.y}`;
const edgeKey = (e: Edge) => {
  const a = pk(e[0]);
  const b = pk(e[1]);
  return a < b ? `${a}|${b}` : `${b}|${a}`;
};

export const sameEdge = (a: Edge, b: Edge): boolean => edgeKey(a) === edgeKey(b);

export function toggleEdge(list: Edge[], e: Edge): Edge[] {
  return list.some((x) => sameEdge(x, e)) ? list.filter((x) => !sameEdge(x, e)) : [...list, e];
}

const NEIGHBORS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

/** Les 12 arêtes entre deux Spaces d'une même tuile. */
export function innerEdges(): Edge[] {
  const out: Edge[] = [];
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      if (x + 1 < TILE) out.push([{ x, y }, { x: x + 1, y }]);
      if (y + 1 < TILE) out.push([{ x, y }, { x, y: y + 1 }]);
    }
  }
  return out;
}

export const isInterior = (def: Pick<TileDef, 'interior'>, p: Position): boolean => def.interior.some((c) => c.x === p.x && c.y === p.y);

/** Murs automatiques : toute arête entre une case d'intérieur et une case qui n'en fait pas partie (voisine de rue, ou hors tuile). */
export function autoWalls(def: Pick<TileDef, 'interior'>): Edge[] {
  const out: Edge[] = [];
  for (const c of def.interior) {
    for (const d of NEIGHBORS) {
      const n = { x: c.x + d.x, y: c.y + d.y };
      if (!isInterior(def, n)) out.push([c, n]);
    }
  }
  return out;
}

/** Murs réels de la tuile : contour des bâtiments (sauf ouvertures) et murs ajoutés. Les arêtes de porte restent murées en dessous. */
export function effectiveWalls(def: TileDef): Edge[] {
  const out: Edge[] = [];
  for (const e of [...autoWalls(def).filter((a) => !def.openedWalls.some((o) => sameEdge(o, a))), ...def.walls]) {
    if (!out.some((x) => sameEdge(x, e))) out.push(e);
  }
  return out;
}

/** Bâtiments : groupes de cases d'intérieur contiguës (orthogonalement) sur la tuile. */
export function buildings(def: Pick<TileDef, 'interior'>): Position[][] {
  const left = new Map(def.interior.map((c) => [pk(c), c]));
  const groups: Position[][] = [];
  while (left.size) {
    const [firstKey, first] = left.entries().next().value as [string, Position];
    left.delete(firstKey);
    const group = [first];
    for (let i = 0; i < group.length; i++) {
      for (const d of NEIGHBORS) {
        const k = pk({ x: group[i]!.x + d.x, y: group[i]!.y + d.y });
        const c = left.get(k);
        if (c) {
          left.delete(k);
          group.push(c);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

export const hasTile = (layout: TileLayout, tx: number, ty: number): TilePlacement | undefined =>
  layout.placements.find((p) => p.tx === tx && p.ty === ty);

export type DoorState = 'open' | 'closed' | 'none';

export interface BoardExtras {
  /** Murs ajoutés à la main sur le plateau assemblé. */
  walls?: Edge[];
  /** Portes ajoutées à la main sur le plateau assemblé. */
  doors?: Door[];
  portals?: Portal[];
  /** État choisi pour les portes des tuiles (par identifiant) : fermée par défaut, ouverte, ou retirée (le mur revient). */
  doorStates?: Record<string, DoorState>;
}

const doorId = (a: Position, b: Position): string => `d:${edgeKey([a, b])}`;

export interface LayoutDoor {
  id: string;
  a: Position;
  b: Position;
}

const globalOf = (pl: TilePlacement, e: Edge): Edge => {
  const [a, b] = rotateEdge(e, pl.rotation);
  return [
    { x: pl.tx * TILE + a.x, y: pl.ty * TILE + a.y },
    { x: pl.tx * TILE + b.x, y: pl.ty * TILE + b.y },
  ];
};

/** Toutes les portes définies par les tuiles posées, quel que soit leur état. */
export function layoutDoors(tiles: Record<string, TileDef>, layout: TileLayout): LayoutDoor[] {
  const out: LayoutDoor[] = [];
  for (const pl of layout.placements) {
    for (const e of tiles[pl.tileId]?.doors ?? []) {
      const [a, b] = globalOf(pl, e);
      out.push({ id: doorId(a, b), a, b });
    }
  }
  return out;
}

/**
 * Compose le plateau abstrait du moteur à partir des tuiles posées : murs et portes des tuiles tournés,
 * cases d'intérieur, emplacements vides = cases absentes. Les éléments hors des tuiles posées sont écartés.
 */
export function boardFromLayout(tiles: Record<string, TileDef>, layout: TileLayout, extras: BoardExtras = {}): Board {
  const width = layout.tilesW * TILE;
  const height = layout.tilesH * TILE;
  const holes: Position[] = [];
  const present = (p: Position) => !!hasTile(layout, Math.floor(p.x / TILE), Math.floor(p.y / TILE));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (!present({ x, y })) holes.push({ x, y });
  const bothPresent = (e: Edge) => present(e[0]) && present(e[1]);

  const walls = new Map<string, Edge>();
  const interior: Position[] = [];
  const doors = new Map<string, Door>();
  for (const pl of layout.placements) {
    const def = tiles[pl.tileId];
    if (!def) throw new Error(`Tuile inconnue : ${pl.tileId}`);
    for (const c of def.interior) {
      const [g] = globalOf(pl, [c, c]);
      interior.push(g);
    }
    for (const e of effectiveWalls(def)) {
      const g = globalOf(pl, e);
      if (bothPresent(g)) walls.set(edgeKey(g), g);
    }
    for (const e of def.doors) {
      const [a, b] = globalOf(pl, e);
      if (!bothPresent([a, b])) continue;
      const id = doorId(a, b);
      const state = extras.doorStates?.[id] ?? 'closed';
      if (state !== 'none') doors.set(id, { id, a, b, open: state === 'open' });
    }
  }
  for (const e of extras.walls ?? []) if (bothPresent(e)) walls.set(edgeKey(e), e);
  for (const d of extras.doors ?? []) if (bothPresent([d.a, d.b])) doors.set(d.id, d);
  // Une porte remplace le mur de son arête.
  for (const d of doors.values()) walls.delete(edgeKey([d.a, d.b]));

  return {
    width,
    height,
    holes,
    walls: [...walls.values()],
    doors: [...doors.values()],
    portals: (extras.portals ?? []).filter((p) => present(p.at)),
    interior,
  };
}

/** Retire les portes et ouvertures qui ne correspondent plus à un mur (après avoir modifié l'intérieur). */
export function pruneTile(def: TileDef): TileDef {
  const walls = autoWalls(def);
  return {
    ...def,
    openedWalls: def.openedWalls.filter((o) => walls.some((w) => sameEdge(w, o))),
    doors: def.doors.filter((d) => walls.some((w) => sameEdge(w, d)) || def.walls.some((w) => sameEdge(w, d))),
  };
}

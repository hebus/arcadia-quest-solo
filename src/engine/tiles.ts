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
  /** Salles : cases dont le sol diffère de la rue (sans mur automatique : les murs se tracent à la main). */
  rooms: [PositionSchema.array(), '=', () => []],
  /** Cases bloquées : impassables (ni déplacement, ni ligne de vue, ni pose d'une figurine). */
  blocked: [PositionSchema.array(), '=', () => []],
  /** Cases de la zone de départ des héros imprimée sur cette face (vide si la face n'en a pas). */
  heroStart: [PositionSchema.array(), '=', () => []],
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

/**
 * Murs automatiques : bâtiments et salles se comportent de la même façon. Toute arête entre une case d'un bâtiment (ou d'une
 * salle) et une case qui n'en fait pas partie est un mur : voisine de rue, hors tuile, ou d'un autre type (un bâtiment et une
 * salle côte à côte sont séparés par un mur).
 */
export function autoWalls(def: Pick<TileDef, 'interior'> & Partial<Pick<TileDef, 'rooms'>>): Edge[] {
  const out: Edge[] = [];
  const contour = (cells: Position[]) => {
    const has = (p: Position) => cells.some((c) => c.x === p.x && c.y === p.y);
    for (const c of cells) {
      for (const d of NEIGHBORS) {
        const n = { x: c.x + d.x, y: c.y + d.y };
        if (!has(n) && !out.some((e) => sameEdge(e, [c, n]))) out.push([c, n]);
      }
    }
  };
  contour(def.interior);
  contour(def.rooms ?? []);
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

/** Groupes de cases contiguës (orthogonalement) : un groupe = un bâtiment, ou une salle. */
function contiguousGroups(cells: Position[]): Position[][] {
  const left = new Map(cells.map((c) => [pk(c), c]));
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

/** Bâtiments : groupes de cases d'intérieur contiguës sur la tuile. */
export const buildings = (def: Pick<TileDef, 'interior'>): Position[][] => contiguousGroups(def.interior);

/** Salles : groupes de cases de salle contiguës sur la tuile. */
export const roomGroups = (def: Pick<TileDef, 'rooms'>): Position[][] => contiguousGroups(def.rooms);

export const hasTile = (layout: TileLayout, tx: number, ty: number): TilePlacement | undefined =>
  layout.placements.find((p) => p.tx === tx && p.ty === ty);

export type DoorState = 'open' | 'closed' | 'none';

export interface BoardExtras {
  /** Murs ajoutés à la main sur le plateau assemblé. */
  walls?: Edge[];
  /** Portes ajoutées à la main sur le plateau assemblé. */
  doors?: Door[];
  portals?: Portal[];
  /** Porte spéciale (pion violet, un seul dans la boîte) : identifiant d'une porte de tuile ou ajoutée à la main. */
  specialDoorId?: string | null;
  /** État choisi pour les portes des tuiles (par identifiant) : fermée par défaut, ouverte, ou retirée (le mur revient). */
  doorStates?: Record<string, DoorState>;
}

const doorId = (a: Position, b: Position): string => `d:${edgeKey([a, b])}`;

export interface LayoutDoor {
  id: string;
  a: Position;
  b: Position;
}

/** Case du coin haut-gauche d'une tuile posée, décalage compris. */
export const placementOrigin = (pl: TilePlacement): Position => ({ x: pl.tx * TILE + (pl.dx ?? 0), y: pl.ty * TILE + (pl.dy ?? 0) });

/** Dimensions du plateau : la grille d'emplacements, agrandie si des tuiles décalées en dépassent. */
export function layoutExtent(layout: TileLayout): { width: number; height: number } {
  let width = layout.tilesW * TILE;
  let height = layout.tilesH * TILE;
  for (const pl of layout.placements) {
    const o = placementOrigin(pl);
    width = Math.max(width, o.x + TILE);
    height = Math.max(height, o.y + TILE);
  }
  return { width, height };
}

/** Problèmes d'un assemblage : tuile hors du plateau (coordonnée négative) ou tuiles qui se chevauchent. */
export function layoutProblems(layout: TileLayout): string[] {
  const problems: string[] = [];
  const origins = layout.placements.map((pl) => ({ pl, o: placementOrigin(pl) }));
  for (const { pl, o } of origins) {
    if (o.x < 0 || o.y < 0) problems.push(`La tuile ${pl.tileId} est décalée hors du plateau : décalez plutôt les autres tuiles vers la droite ou vers le bas.`);
  }
  for (let i = 0; i < origins.length; i++) {
    for (let j = i + 1; j < origins.length; j++) {
      const a = origins[i]!;
      const b = origins[j]!;
      if (Math.abs(a.o.x - b.o.x) < TILE && Math.abs(a.o.y - b.o.y) < TILE) problems.push(`Les tuiles ${a.pl.tileId} et ${b.pl.tileId} se chevauchent : écartez-les ou retirez le décalage.`);
    }
  }
  return problems;
}

const globalOf = (pl: TilePlacement, e: Edge): Edge => {
  const [a, b] = rotateEdge(e, pl.rotation);
  const o = placementOrigin(pl);
  return [
    { x: o.x + a.x, y: o.y + a.y },
    { x: o.x + b.x, y: o.y + b.y },
  ];
};

/** Cases de départ des héros définies par les tuiles posées (zones tournées avec la tuile), en coordonnées du plateau. */
export function layoutHeroStarts(tiles: Record<string, TileDef>, layout: TileLayout): Position[] {
  const out: Position[] = [];
  for (const pl of layout.placements) {
    for (const c of tiles[pl.tileId]?.heroStart ?? []) {
      const [g] = globalOf(pl, [c, c]);
      out.push(g);
    }
  }
  return out;
}

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
  const { width, height } = layoutExtent(layout);
  const holes: Position[] = [];
  // Une case est présente si une tuile la couvre ; les cases que aucune tuile ne couvre (emplacement vide, écart créé en
  // décalant une tuile) sont absentes : bloquantes.
  const covers = layout.placements.map(placementOrigin);
  const present = (p: Position) => covers.some((o) => p.x >= o.x && p.x < o.x + TILE && p.y >= o.y && p.y < o.y + TILE);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (!present({ x, y })) holes.push({ x, y });
  const bothPresent = (e: Edge) => present(e[0]) && present(e[1]);

  const walls = new Map<string, Edge>();
  const interior: Position[] = [];
  const rooms: Position[] = [];
  const blocked: Position[] = [];
  const doors = new Map<string, Door>();
  for (const pl of layout.placements) {
    const def = tiles[pl.tileId];
    if (!def) throw new Error(`Tuile inconnue : ${pl.tileId}`);
    for (const c of def.interior) {
      const [g] = globalOf(pl, [c, c]);
      interior.push(g);
    }
    for (const c of def.rooms) rooms.push(globalOf(pl, [c, c])[0]);
    for (const c of def.blocked) {
      const g = globalOf(pl, [c, c])[0];
      blocked.push(g);
      // Une case bloquée est impassable : pour le moteur, c'est une case absente.
      if (!holes.some((h) => h.x === g.x && h.y === g.y)) holes.push(g);
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
  // Une porte retirée ne peut pas rester la porte spéciale.
  const special = extras.specialDoorId ? doors.get(extras.specialDoorId) : undefined;
  if (special) doors.set(special.id, { ...special, special: true });

  return {
    width,
    height,
    holes,
    walls: [...walls.values()],
    doors: [...doors.values()],
    portals: (extras.portals ?? []).filter((p) => present(p.at)),
    interior,
    ...(rooms.length ? { rooms } : {}),
    ...(blocked.length ? { blocked } : {}),
  };
}

/**
 * Pions porte posés sur une arête sans mur. Un pion porte se pose sur un mur et le remplace : fermé, il se franchit en l'ouvrant ;
 * côté « porte ouverte », il supprime le mur (pour agrandir un bâtiment en reliant deux bâtiments, ou pour l'ouvrir sur la rue).
 * Sur une arête sans mur il n'aurait aucun sens.
 */
export function doorsWithoutWall(tiles: Record<string, TileDef>, layout: TileLayout, extras: BoardExtras): Door[] {
  const bare = boardFromLayout(tiles, layout, { ...extras, doors: [] });
  const wall = new Set(bare.walls.map(([a, b]) => edgeKey([a, b])));
  const tileDoor = new Set(bare.doors.map((d) => edgeKey([d.a, d.b])));
  return (extras.doors ?? []).filter((d) => {
    const k = edgeKey([d.a, d.b]);
    return !wall.has(k) && !tileDoor.has(k);
  });
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

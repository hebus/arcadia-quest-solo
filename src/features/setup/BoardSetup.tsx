import { useMemo, useState } from 'react';
import { Button, Panel, inputClass } from '@/components/ui';
import { SPAWN_TOKEN_TYPES, samePair, spawnTokenLabel } from '@/engine/spawn/tokens';
import { DOOR_TOKENS } from '@/engine/doorTokens';
import { freeTileFaces, isCatalogTile, tileNumber } from '@/engine/tileCatalog';
import type { Door, Portal, Position, SpawnPoint } from '@/engine/domain/schemas';
import {
  boardFromLayout,
  layoutDoors,
  layoutHeroStarts,
  placementOrigin,
  sameEdge,
  toggleEdge,
  type BoardExtras,
  type Edge,
  type Rotation,
  type TileDef,
  type TileLayout,
  type TilePlacement,
} from '@/engine/tiles';
import { BoardView, type BoardToken } from '@/rendering/board/BoardView';
import { BLANK_TILE, allTiles } from './builtinTiles';

export interface HeroRow {
  name: string;
  life: number;
  defense: number;
  rerolls: number;
  pos: Position | null;
}
export interface DefRow {
  name: string;
  tier: number;
  life: number;
  overkill: number;
  reward: number;
  type: 'melee' | 'ranged';
  atk: number;
  mv: number;
}
export interface InstRow {
  def: string;
  pos: Position;
  guard: boolean;
}

export { BLANK_TILE };

type Tool = 'tile' | 'wall' | 'door' | 'special' | 'portal' | 'spawn' | 'hero' | 'monster' | 'guard' | 'erase';

const TOOLS: { id: Tool; label: string; help: string }[] = [
  { id: 'tile', label: '1. Tuiles', help: 'Choisissez un emplacement, puis la tuile et son orientation.' },
  { id: 'wall', label: 'Mur', help: 'Touchez une arête entre deux cases pour ajouter ou retirer un mur supplémentaire.' },
  { id: 'door', label: 'Porte', help: 'Touchez une porte de tuile : fermée, puis ouverte, puis retirée (pointillé gris, le mur revient). Sur une arête sans porte de tuile, ajoute une porte du scénario.' },
  { id: 'special', label: 'Porte spéciale', help: 'Touchez une porte pour en faire la porte spéciale (pion violet : il n’y en a qu’un dans la boîte), touchez-la de nouveau pour retirer la marque.' },
  { id: 'portal', label: 'Portail', help: 'Touchez une case : portail violet, puis bleu, puis retiré (8 jetons au plus). Les portails de même couleur sont reliés.' },
  { id: 'spawn', label: 'Jeton Spawn', help: 'Choisissez la paire de dés, puis touchez une case. Retouchez pour retirer.' },
  { id: 'hero', label: 'Héros', help: 'Choisissez un héros, puis touchez sa case de départ. Les cases jaunes sont les zones de départ des héros définies sur les tuiles.' },
  { id: 'monster', label: 'Monstre', help: 'Choisissez un type, puis touchez les cases où poser les figurines.' },
  { id: 'guard', label: 'Garde', help: 'Touchez un monstre pour le marquer ou le démarquer comme garde.' },
  { id: 'erase', label: 'Gomme', help: 'Touchez un pion, un jeton Spawn ou un portail pour le retirer.' },
];

interface Props {
  tilesLib: TileDef[];
  layout: TileLayout;
  setLayout: (l: TileLayout) => void;
  extras: Required<BoardExtras>;
  setExtras: (e: Required<BoardExtras>) => void;
  spawns: SpawnPoint[];
  setSpawns: (s: SpawnPoint[]) => void;
  heroes: HeroRow[];
  setHeroes: (h: HeroRow[]) => void;
  defs: { id: string; name: string }[];
  insts: InstRow[];
  setInsts: (i: InstRow[]) => void;
  onOpenLibrary: () => void;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const same = (a: Position, b: Position) => a.x === b.x && a.y === b.y;
const edgeOf = (d: Door): Edge => [d.a, d.b];

/** Pose des tuiles, des murs, des portes, des jetons, des héros et des monstres directement sur le plateau. */
export function BoardSetup(p: Props) {
  const [tool, setTool] = useState<Tool>('tile');
  const [slot, setSlot] = useState<{ tx: number; ty: number } | null>(null);
  const [heroIdx, setHeroIdx] = useState(0);
  const [defId, setDefId] = useState(p.defs[0]?.id ?? '');
  const [tokenKey, setTokenKey] = useState('');
  // Il n'existe que 5 jetons Spawn, un de chaque : on ne propose que ceux qui ne sont pas déjà sur le plateau.
  const freeTokens = SPAWN_TOKEN_TYPES.filter(([a, b]) => !p.spawns.some((s) => samePair(s.dice, a, b)));
  const token = freeTokens.find((t) => t.join('+') === tokenKey) ?? freeTokens[0];

  const library = useMemo(() => allTiles(p.tilesLib), [p.tilesLib]);
  const byId = useMemo(() => Object.fromEntries(library.map((t) => [t.id, t])), [library]);
  const usable = p.layout.placements.every((pl) => byId[pl.tileId]);
  const board = useMemo(
    () => (usable ? boardFromLayout(byId, p.layout, p.extras) : null),
    [usable, byId, p.layout, p.extras],
  );

  const tileDoors = useMemo(() => layoutDoors(byId, p.layout), [byId, p.layout]);
  /** Zones de départ des héros imprimées sur les tuiles posées (en jaune quand on place les héros). */
  const startCells = useMemo(() => layoutHeroStarts(byId, p.layout), [byId, p.layout]);
  const removedDoors = tileDoors.filter((d) => p.extras.doorStates[d.id] === 'none').map((d): [Position, Position] => [d.a, d.b]);
  const placed = p.layout.placements.flatMap((pl) => (byId[pl.tileId] ? [{ def: byId[pl.tileId]!, placement: pl }] : []));
  const current = slot ? p.layout.placements.find((x) => x.tx === slot.tx && x.ty === slot.ty) : undefined;
  const freeFaces = freeTileFaces(p.layout.placements.map((x) => x.tileId), current?.tileId);

  /** Pose, change ou retire la tuile d'un emplacement. Changer de tuile ou la tourner garde son décalage. */
  const setPlacement = (tx: number, ty: number, tileId: string | null, rotation: Rotation = 0) => {
    const existing = p.layout.placements.find((x) => x.tx === tx && x.ty === ty);
    const others = p.layout.placements.filter((x) => !(x.tx === tx && x.ty === ty));
    const offset = existing ? { ...(existing.dx ? { dx: existing.dx } : {}), ...(existing.dy ? { dy: existing.dy } : {}) } : {};
    p.setLayout({ ...p.layout, placements: tileId ? [...others, { tileId, tx, ty, rotation, ...offset }] : others });
    if (!tileId && existing) pruneOutside(existing);
  };

  /** Décale la tuile d'un emplacement d'une case (vers la droite, la gauche, le bas ou le haut) : cela laisse des cases vides, bloquantes, entre elle et ses voisines. */
  const shiftPlacement = (pl: TilePlacement, ddx: number, ddy: number) => {
    const dx = (pl.dx ?? 0) + ddx;
    const dy = (pl.dy ?? 0) + ddy;
    const moved: TilePlacement = { tileId: pl.tileId, tx: pl.tx, ty: pl.ty, rotation: pl.rotation, ...(dx ? { dx } : {}), ...(dy ? { dy } : {}) };
    p.setLayout({ ...p.layout, placements: p.layout.placements.map((x) => (x === pl ? moved : x)) });
  };

  /** Retire ce qui se trouvait sur les cases d'une tuile retirée. */
  const pruneOutside = (pl: TilePlacement) => {
    const o = placementOrigin(pl);
    const onTile = (q: Position) => q.x >= o.x && q.x < o.x + 3 && q.y >= o.y && q.y < o.y + 3;
    p.setSpawns(p.spawns.filter((s) => !onTile(s.at)));
    p.setHeroes(p.heroes.map((h) => (h.pos && onTile(h.pos) ? { ...h, pos: null } : h)));
    p.setInsts(p.insts.filter((m) => !onTile(m.pos)));
  };

  const resize = (tilesW: number, tilesH: number) =>
    p.setLayout({ tilesW, tilesH, placements: p.layout.placements.filter((x) => x.tx < tilesW && x.ty < tilesH) });

  const onEdge = (a: Position, b: Position) => {
    const e: Edge = [a, b];
    if (tool === 'wall') p.setExtras({ ...p.extras, walls: toggleEdge(p.extras.walls, e) });
    if (tool === 'door') {
      // Porte définie par une tuile : fermée → ouverte → retirée (le mur revient) → fermée.
      const tileDoor = tileDoors.find((x) => sameEdge([x.a, x.b], e));
      if (tileDoor) {
        const cur = p.extras.doorStates[tileDoor.id] ?? 'closed';
        const next = cur === 'closed' ? 'open' : cur === 'open' ? 'none' : 'closed';
        // Une porte retirée rend son pion : elle ne peut plus être la porte spéciale.
        const specialDoorId = next === 'none' && p.extras.specialDoorId === tileDoor.id ? null : p.extras.specialDoorId;
        p.setExtras({ ...p.extras, specialDoorId, doorStates: { ...p.extras.doorStates, [tileDoor.id]: next } });
        return;
      }
      const d = p.extras.doors.find((x) => sameEdge(edgeOf(x), e));
      if (!d) p.setExtras({ ...p.extras, doors: [...p.extras.doors, { id: `d${p.extras.doors.length + 1}-${a.x}${a.y}${b.x}${b.y}`, a, b, open: false }] });
      else if (!d.open) p.setExtras({ ...p.extras, doors: p.extras.doors.map((x) => (x === d ? { ...x, open: true } : x)) });
      else p.setExtras({ ...p.extras, specialDoorId: p.extras.specialDoorId === d.id ? null : p.extras.specialDoorId, doors: p.extras.doors.filter((x) => x !== d) });
    }
    if (tool === 'special') {
      // La porte touchée (de tuile, non retirée, ou ajoutée à la main) devient la porte spéciale, ou perd la marque.
      const tileDoor = tileDoors.find((x) => sameEdge([x.a, x.b], e));
      const id = tileDoor && (p.extras.doorStates[tileDoor.id] ?? 'closed') !== 'none' ? tileDoor.id : p.extras.doors.find((x) => sameEdge(edgeOf(x), e))?.id;
      if (id) p.setExtras({ ...p.extras, specialDoorId: p.extras.specialDoorId === id ? null : id });
    }
  };

  const onCell = (q: Position) => {
    if (tool === 'portal') {
      const cur = p.extras.portals.find((x) => same(x.at, q));
      const next = !cur ? 'violet' : cur.color === 'violet' ? 'blue' : null;
      const rest = p.extras.portals.filter((x) => x !== cur);
      const portals: Portal[] = next ? [...rest, { id: `p-${q.x}-${q.y}`, at: q, color: next }] : rest;
      p.setExtras({ ...p.extras, portals });
    } else if (tool === 'spawn') {
      const cur = p.spawns.find((s) => same(s.at, q));
      if (cur) p.setSpawns(p.spawns.filter((s) => s !== cur));
      else if (token) p.setSpawns([...p.spawns, { id: `S-${token[0]}-${token[1]}`, at: q, dice: [token[0], token[1]] }]);
    } else if (tool === 'hero') {
      p.setHeroes(p.heroes.map((h, i) => (i === heroIdx ? { ...h, pos: q } : h)));
    } else if (tool === 'monster' && defId) {
      p.setInsts([...p.insts, { def: defId, pos: q, guard: false }]);
    } else if (tool === 'erase') {
      p.setSpawns(p.spawns.filter((s) => !same(s.at, q)));
      p.setExtras({ ...p.extras, portals: p.extras.portals.filter((x) => !same(x.at, q)) });
    }
  };

  const onToken = (id: string) => {
    const [kind, idx] = id.split('-');
    const i = Number(idx);
    if (kind === 'hero') {
      if (tool === 'erase') p.setHeroes(p.heroes.map((h, j) => (j === i ? { ...h, pos: null } : h)));
      else {
        setHeroIdx(i);
        setTool('hero');
      }
    } else if (kind === 'mon') {
      if (tool === 'erase') p.setInsts(p.insts.filter((_, j) => j !== i));
      else if (tool === 'guard') p.setInsts(p.insts.map((m, j) => (j === i ? { ...m, guard: !m.guard } : m)));
    }
  };

  const counters: Record<string, number> = {};
  const tokens: BoardToken[] = [
    ...p.heroes.flatMap((h, i) => (h.pos ? [{ id: `hero-${i}`, kind: 'hero' as const, label: h.name.slice(0, 2).toUpperCase(), at: h.pos, selected: tool === 'hero' && heroIdx === i }] : [])),
    ...p.insts.map((m, i) => {
      counters[m.def] = (counters[m.def] ?? 0) + 1;
      return { id: `mon-${i}`, kind: 'monster' as const, label: m.def.slice(0, 2).toUpperCase(), at: m.pos, guard: m.guard };
    }),
  ];

  const help = TOOLS.find((t) => t.id === tool)!.help;
  const unplaced = p.heroes.filter((h) => !h.pos).map((h) => h.name);

  return (
    <div className="space-y-3">
      <nav aria-label="Outils de pose" className="flex flex-wrap gap-2">
        {TOOLS.map((t) => (
          <Button key={t.id} variant={tool === t.id ? 'primary' : 'secondary'} aria-pressed={tool === t.id} onClick={() => setTool(t.id)}>
            {t.label}
          </Button>
        ))}
      </nav>
      <p className="text-amber-200">{help}</p>
      {(tool === 'door' || tool === 'special') && board && (
        <p className={`text-sm ${board.doors.length > DOOR_TOKENS ? 'text-red-300' : 'text-stone-300'}`} role="status">
          Pions porte posés : {board.doors.length} / {DOOR_TOKENS} (recto ouvert, verso fermé) · porte spéciale violette : {board.doors.some((d) => d.special) ? 'posée' : 'non posée'} (1 pion).
        </p>
      )}

      {tool === 'tile' && (
        <Panel title="Assemblage des tuiles" actions={<Button onClick={p.onOpenLibrary}>Bibliothèque de scans</Button>}>
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <label>
              Colonnes
              <input aria-label="Colonnes de tuiles" className={`${inputClass} w-24`} type="number" min={1} max={6} value={p.layout.tilesW} onChange={(e) => resize(Math.max(1, Math.min(6, Number(e.target.value))), p.layout.tilesH)} />
            </label>
            <label>
              Lignes
              <input aria-label="Lignes de tuiles" className={`${inputClass} w-24`} type="number" min={1} max={6} value={p.layout.tilesH} onChange={(e) => resize(p.layout.tilesW, Math.max(1, Math.min(6, Number(e.target.value))))} />
            </label>
          </div>
          <div className="inline-grid gap-2" style={{ gridTemplateColumns: `repeat(${p.layout.tilesW}, minmax(0, 1fr))` }}>
            {Array.from({ length: p.layout.tilesH }, (_, ty) =>
              Array.from({ length: p.layout.tilesW }, (_, tx) => {
                const pl = p.layout.placements.find((x) => x.tx === tx && x.ty === ty);
                const active = slot?.tx === tx && slot.ty === ty;
                return (
                  <Button key={`${tx},${ty}`} variant={active ? 'primary' : 'secondary'} className="h-20 w-28 text-sm" aria-label={`Emplacement ${tx + 1},${ty + 1}`} onClick={() => setSlot({ tx, ty })}>
                    {pl ? `${byId[pl.tileId]?.name ?? '?'} ↻${pl.rotation}°` : '+ vide'}
                  </Button>
                );
              }),
            )}
          </div>
          {slot && (
            <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg bg-stone-800 p-3">
              <label>
                Tuile pour l&apos;emplacement {slot.tx + 1},{slot.ty + 1}
                <select aria-label="Tuile" className={inputClass} value={current?.tileId ?? ''} onChange={(e) => setPlacement(slot.tx, slot.ty, e.target.value || null, current?.rotation ?? 0)}>
                  <option value="">(vide)</option>
                  {/* Les 9 tuiles du jeu, doubles faces : une tuile déjà posée (sur l'une ou l'autre face) n'est plus disponible. */}
                  <optgroup label="Tuiles du jeu (1 à 9, recto/verso A et B)">
                    {library
                      .filter((t) => isCatalogTile(t.id))
                      .map((t) => (
                        <option key={t.id} value={t.id} disabled={!freeFaces.includes(t.id)}>
                          {t.id}{t.name !== t.id ? ` · ${t.name}` : ''}{freeFaces.includes(t.id) ? '' : ` (tuile ${tileNumber(t.id)} déjà posée)`}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Tuiles de test (hors du jeu)">
                    {library
                      .filter((t) => !isCatalogTile(t.id))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </label>
              {current && (
                <>
                  <Button onClick={() => setPlacement(slot.tx, slot.ty, current.tileId, ((current.rotation + 270) % 360) as Rotation)}>↺ Tourner</Button>
                  <Button onClick={() => setPlacement(slot.tx, slot.ty, current.tileId, ((current.rotation + 90) % 360) as Rotation)}>↻ Tourner</Button>
                  <Button variant="danger" onClick={() => setPlacement(slot.tx, slot.ty, null)}>Retirer</Button>
                  <fieldset className="flex flex-wrap items-center gap-1" aria-label="Décalage de la tuile">
                    <legend className="sr-only">Décalage de la tuile</legend>
                    <span className="text-sm text-stone-300">Décaler :</span>
                    <Button aria-label="Décaler vers la gauche" onClick={() => shiftPlacement(current, -1, 0)}>←</Button>
                    <Button aria-label="Décaler vers le haut" onClick={() => shiftPlacement(current, 0, -1)}>↑</Button>
                    <Button aria-label="Décaler vers le bas" onClick={() => shiftPlacement(current, 0, 1)}>↓</Button>
                    <Button aria-label="Décaler vers la droite" onClick={() => shiftPlacement(current, 1, 0)}>→</Button>
                    {(current.dx || current.dy) && (
                      <>
                        <span className="text-sm text-amber-300" data-testid="shift-info">
                          {[current.dx ? `${Math.abs(current.dx)} case${Math.abs(current.dx) > 1 ? 's' : ''} ${current.dx > 0 ? 'à droite' : 'à gauche'}` : '', current.dy ? `${Math.abs(current.dy)} case${Math.abs(current.dy) > 1 ? 's' : ''} ${current.dy > 0 ? 'en bas' : 'en haut'}` : ''].filter(Boolean).join(', ')}
                        </span>
                        <Button variant="ghost" onClick={() => shiftPlacement(current, -(current.dx ?? 0), -(current.dy ?? 0))}>Recaler</Button>
                      </>
                    )}
                  </fieldset>
                </>
              )}
            </div>
          )}
        </Panel>
      )}

      {tool === 'spawn' && (
        <div className="flex flex-wrap items-center gap-2">
          <span>Jeton :</span>
          {token ? (
            <select aria-label="Jeton Spawn" className={`${inputClass} w-48`} value={token.join('+')} onChange={(e) => setTokenKey(e.target.value)}>
              {freeTokens.map((t) => (
                <option key={t.join('+')} value={t.join('+')}>
                  {spawnTokenLabel(t)}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-stone-400">Les 5 jetons sont posés.</span>
          )}
        </div>
      )}
      {tool === 'hero' && (
        <div className="flex flex-wrap gap-2">
          {p.heroes.map((h, i) => (
            <Button key={i} variant={heroIdx === i ? 'primary' : 'secondary'} onClick={() => setHeroIdx(i)}>
              {h.name} {h.pos ? `(${h.pos.x},${h.pos.y})` : '— à placer'}
            </Button>
          ))}
        </div>
      )}
      {tool === 'monster' && (
        <div className="flex flex-wrap gap-2">
          {p.defs.length === 0 && <p className="text-stone-400">Définissez d&apos;abord les types de monstres (étape précédente).</p>}
          {p.defs.map((d) => (
            <Button key={d.id} variant={defId === d.id ? 'primary' : 'secondary'} onClick={() => setDefId(d.id)}>
              {d.name}
            </Button>
          ))}
        </div>
      )}

      {board ? (
        <BoardView
          label="Plateau en préparation"
          board={board}
          tiles={placed}
          tileLabels={p.layout.placements.filter((pl) => isCatalogTile(pl.tileId)).map((pl) => ({ tx: pl.tx, ty: pl.ty, dx: pl.dx, dy: pl.dy, label: pl.tileId }))}
          spawns={p.spawns}
          tokens={tokens}
          onCell={onCell}
          onToken={onToken}
          onEdge={tool === 'wall' || tool === 'door' || tool === 'special' ? onEdge : undefined}
          inactiveEdges={removedDoors}
          highlights={tool === 'hero' ? startCells.map((pos) => ({ pos, kind: 'end' as const })) : []}
        />
      ) : (
        <p role="alert" className="text-red-300">Une tuile posée n&apos;existe plus dans la bibliothèque : retirez-la.</p>
      )}
      {p.layout.placements.length === 0 && <p className="text-stone-400">Posez au moins une tuile pour faire apparaître le plateau.</p>}
      {unplaced.length > 0 && p.layout.placements.length > 0 && <p className="text-sm text-amber-300">Héros à placer : {unplaced.join(', ')}.</p>}
      <p className="text-sm text-stone-400">
        Bleu : héros · rouge : monstres (bordure orange : garde) · brun : jeton Spawn · trait brun : porte fermée · pointillé vert : porte ouverte · trait violet : porte spéciale · anneau : portail.
      </p>
    </div>
  );
}

export { slug };

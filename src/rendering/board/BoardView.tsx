import { useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Board, Position, SpawnPoint } from '@/engine/domain/schemas';
import { TILE, type TileDef, type TilePlacement } from '@/engine/tiles';
import type { InstructionOverlay } from '@/rendering/instructions/overlay';
import { ObjectiveIcon, type ObjectiveIconName } from '@/components/ObjectiveIcon';
import { cellArt, cellKind, type ArtPrimitive } from './tileArt';

export interface BoardToken {
  id: string;
  kind: 'hero' | 'monster';
  label: string;
  at: Position;
  guard?: boolean;
  /** Attaque du monstre (type et dés), affichée en pastille sur son pion. */
  attack?: { type: 'melee' | 'ranged'; dice: number };
  wounded?: boolean;
  selected?: boolean;
  dimmed?: boolean;
}

export type HighlightKind = 'reach' | 'danger' | 'target' | 'close' | 'los' | 'end';

export interface Highlight {
  pos: Position;
  kind: HighlightKind;
  label?: string;
}

export interface BoardPath {
  points: Position[];
  color?: string;
}

export interface PlacedTile {
  def: TileDef;
  placement: TilePlacement;
}

interface Props {
  board: Board;
  tiles?: PlacedTile[];
  spawns?: SpawnPoint[];
  tokens?: BoardToken[];
  highlights?: Highlight[];
  paths?: BoardPath[];
  /** Positions d'origine des figurines déplacées pendant le tour (fantômes). */
  ghosts?: { at: Position; label: string }[];
  /** Objectifs du scénario : icône dans l'angle de leur case, case cerclée ; accompli = vert et coché. */
  objectives?: { id: string; at: Position; icon?: ObjectiveIconName | undefined; title: string; done: boolean }[];
  /** Lignes de visée (centre de la case de l'attaquant → centre de la cible) pour les attaques à distance. */
  lines?: { from: Position; to: Position; tone: 'clear' | 'blocked' }[];
  /** Numéro de chaque tuile (ex. 3B), affiché au centre de la tuile (tx, ty : colonne et ligne de tuiles, à partir de 0). */
  tileLabels?: { tx: number; ty: number; dx?: number | undefined; dy?: number | undefined; label: string }[];
  /** Étape d'instruction à montrer visuellement (fantômes, flèches, croix, portes). */
  overlay?: InstructionOverlay;
  onCell?: (p: Position) => void;
  onToken?: (id: string) => void;
  /** Un pion peut-il être glissé ? Par défaut aucun. */
  canDrag?: (id: string) => boolean;
  /** Pion lâché sur une case (glisser-déposer). Une case atteinte est toujours une Space du plateau. */
  onTokenMove?: (id: string, to: Position) => void;
  /** Rend les portes touchables (ouvrir/fermer pour recaler le miroir). */
  onDoor?: (id: string) => void;
  /** Si fourni, seules ces portes sont touchables (sinon toutes, avec `onDoor`). */
  doorIds?: readonly string[];
  /** Portes à signaler d'un halo : « touchez-moi pour l'ouvrir ». */
  doorHints?: readonly string[];
  /** Rend les arêtes entre Spaces cliquables (éditeur de murs et de portes). */
  onEdge?: (a: Position, b: Position) => void;
  /** Rend aussi cliquables les arêtes du bord du plateau (vers l'extérieur de la tuile). */
  outerEdges?: boolean;
  /** Arêtes à signaler en pointillés gris (ex. porte retirée, qu'on peut rétablir). */
  inactiveEdges?: [Position, Position][];
  showCoords?: boolean;
  label?: string;
}

const C = 56;
const DRAG_THRESHOLD = 8;
const FILL: Record<HighlightKind, { color: string; opacity: number }> = {
  reach: { color: '#22c55e', opacity: 0.28 },
  danger: { color: '#f59e0b', opacity: 0.35 },
  target: { color: '#ef4444', opacity: 0.4 },
  close: { color: '#22c55e', opacity: 0.28 },
  los: { color: '#38bdf8', opacity: 0.2 },
  end: { color: '#facc15', opacity: 0.5 },
};
const KIND_COLOR = { hero: '#2563eb', monster: '#b91c1c', pet: '#16a34a', mount: '#9333ea' } as const;
/** Symboles des faces de dé d'attaque, pour désigner un jeton Spawn sans texte. */
const DIE_GLYPH: Record<string, string> = { sword: '⚔', bow: '➶', crit: '✸', blank: '○' };
const RING_COLOR = { attacker: '#f59e0b', target: '#ef4444', spawn: '#a855f7', active: '#fde047' } as const;

const edgeLine = (a: Position, b: Position) =>
  a.x !== b.x
    ? { x1: Math.max(a.x, b.x) * C, y1: a.y * C, x2: Math.max(a.x, b.x) * C, y2: (a.y + 1) * C }
    : { x1: a.x * C, y1: Math.max(a.y, b.y) * C, x2: (a.x + 1) * C, y2: Math.max(a.y, b.y) * C };

/** Sommets d'une étoile à 5 branches (pointe en haut). */
const starPoints = (cx: number, cy: number, outer: number, inner: number): string =>
  Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

const center = (p: Position) => ({ x: p.x * C + C / 2, y: p.y * C + C / 2 });
const same = (a: Position, b: Position) => a.x === b.x && a.y === b.y;

function Art({ items }: { items: ArtPrimitive[] }) {
  return (
    <>
      {items.map((p, i) =>
        p.kind === 'rect' ? (
          <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx} fill={p.fill} opacity={p.opacity} />
        ) : p.kind === 'line' ? (
          <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.stroke} strokeWidth={p.width} opacity={p.opacity} />
        ) : (
          <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill} opacity={p.opacity} />
        ),
      )}
    </>
  );
}

function Pawn({ at, kind, label, r = 15, opacity = 1, stroke = '#fff', strokeWidth = 1.5, dashed = false, className }: { at: { x: number; y: number }; kind: keyof typeof KIND_COLOR; label: string; r?: number; opacity?: number; stroke?: string; strokeWidth?: number; dashed?: boolean; className?: string }) {
  return (
    <g opacity={opacity} className={className}>
      <circle cx={at.x} cy={at.y} r={r} fill={KIND_COLOR[kind]} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dashed ? '4 3' : undefined} />
      <text x={at.x} y={at.y + 4} fontSize="11" fontWeight="bold" textAnchor="middle" fill="#fff" pointerEvents="none">
        {label}
      </text>
    </g>
  );
}

interface DragState {
  id: string;
  x: number;
  y: number;
  sx: number;
  sy: number;
  moved: boolean;
}

/** Plateau en SVG : art de tuiles généré, murs, portes, pions déplaçables et instructions visuelles. */
export function BoardView({ board, tiles = [], spawns = [], tokens = [], highlights = [], paths = [], ghosts = [], objectives = [], lines = [], tileLabels = [], overlay, onCell, onToken, canDrag, onTokenMove, onDoor, doorIds, doorHints = [], onEdge, outerEdges = false, inactiveEdges = [], showCoords = true, label = 'Plateau' }: Props) {
  const uid = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement>(null);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const W = board.width * C;
  const H = board.height * C;
  const stack = new Map<string, number>();
  const inCell = new Map<string, number>();
  const isHole = (x: number, y: number) => board.holes.some((h) => h.x === x && h.y === y);
  const isBlocked = (x: number, y: number) => (board.blocked ?? []).some((h) => h.x === x && h.y === y);
  const inBoard = (p: Position) => p.x >= 0 && p.y >= 0 && p.x < board.width && p.y < board.height && !isHole(p.x, p.y);

  const edges: [Position, Position][] = [];
  if (onEdge) {
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        if (isHole(x, y)) continue;
        if (x + 1 < board.width && !isHole(x + 1, y)) edges.push([{ x, y }, { x: x + 1, y }]);
        if (y + 1 < board.height && !isHole(x, y + 1)) edges.push([{ x, y }, { x, y: y + 1 }]);
        if (outerEdges) {
          if (x === 0) edges.push([{ x: -1, y }, { x, y }]);
          if (y === 0) edges.push([{ x, y: -1 }, { x, y }]);
          if (x === board.width - 1) edges.push([{ x, y }, { x: x + 1, y }]);
          if (y === board.height - 1) edges.push([{ x, y }, { x, y: y + 1 }]);
        }
      }
    }
  }

  const toSvg = (e: ReactPointerEvent): { x: number; y: number } | null => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM?.();
    if (!svg || !m || !svg.createSVGPoint) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  const cellAt = (p: { x: number; y: number }): Position => ({ x: Math.floor(p.x / C), y: Math.floor(p.y / C) });

  const startDrag = (e: ReactPointerEvent, id: string) => {
    if (!canDrag?.(id)) return;
    const p = toSvg(e);
    if (!p) return;
    svgRef.current?.setPointerCapture?.(e.pointerId);
    setDrag({ id, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false });
  };
  const moveDrag = (e: ReactPointerEvent) => {
    if (!drag) return;
    const p = toSvg(e);
    if (!p) return;
    const moved = drag.moved || Math.hypot(p.x - drag.sx, p.y - drag.sy) > DRAG_THRESHOLD;
    setDrag({ ...drag, x: p.x, y: p.y, moved });
  };
  const endDrag = (e: ReactPointerEvent, cancelled: boolean) => {
    if (!drag) return;
    svgRef.current?.releasePointerCapture?.(e.pointerId);
    const d = drag;
    setDrag(null);
    if (!d.moved) return;
    suppressClick.current = true;
    setTimeout(() => (suppressClick.current = false), 0);
    const to = cellAt({ x: d.x, y: d.y });
    if (!cancelled && inBoard(to)) onTokenMove?.(d.id, to);
  };

  const dragCell = drag?.moved ? cellAt({ x: drag.x, y: drag.y }) : null;
  const hide = new Set(overlay?.hideTokens ?? []);
  const shown = tokens
    .filter((t) => !hide.has(t.id) || overlay?.tokenAt[t.id])
    .map((t) => ({ ...t, at: overlay?.tokenAt[t.id] ?? t.at }));
  for (const t of shown) inCell.set(`${t.at.x},${t.at.y}`, (inCell.get(`${t.at.x},${t.at.y}`) ?? 0) + 1);
  const doorGlow = new Set([...(overlay?.doorIds ?? []), ...doorHints]);

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={label}
      viewBox={`-10 -10 ${W + 20} ${H + 20}`}
      className="h-auto w-full select-none"
      style={{ touchAction: canDrag ? 'none' : 'manipulation' }}
      onPointerMove={moveDrag}
      onPointerUp={(e) => endDrag(e, false)}
      onPointerCancel={(e) => endDrag(e, true)}
    >
      <defs>
        <marker id={`${uid}-arrow`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#facc15" />
        </marker>
        <marker id={`${uid}-arrow-atk`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#ef4444" />
        </marker>
        {tiles.map(({ placement }) => (
          <clipPath key={`${placement.tx},${placement.ty}`} id={`${uid}-clip-${placement.tx}-${placement.ty}`}>
            <rect x={0} y={0} width={TILE * C} height={TILE * C} />
          </clipPath>
        ))}
      </defs>

      {Array.from({ length: board.height }, (_, y) =>
        Array.from({ length: board.width }, (_, x) =>
          isHole(x, y) && !isBlocked(x, y) ? null : (
            <g key={`bg${x},${y}`} data-testid={isBlocked(x, y) ? `blocked-${x}-${y}` : undefined} transform={`translate(${x * C} ${y * C}) scale(${C})`} pointerEvents="none">
              <Art items={cellArt(cellKind(board, { x, y }), { x, y })} />
            </g>
          ),
        ),
      )}

      {tiles.map(({ def, placement }) => {
        if (!def.image) return null;
        const { l, t, r, b } = def.crop;
        const dw = (TILE * C * 100) / (100 - l - r);
        const dh = (TILE * C * 100) / (100 - t - b);
        const ix = -(dw * l) / 100;
        const iy = -(dh * t) / 100;
        return (
          <g key={`img${placement.tx},${placement.ty}`} transform={`translate(${(placement.tx * TILE + (placement.dx ?? 0)) * C} ${(placement.ty * TILE + (placement.dy ?? 0)) * C}) rotate(${placement.rotation} ${(TILE * C) / 2} ${(TILE * C) / 2})`}>
            <g clipPath={`url(#${uid}-clip-${placement.tx}-${placement.ty})`}>
              <image href={def.image} x={ix} y={iy} width={dw} height={dh} preserveAspectRatio="none" transform={`rotate(${def.imageRotation} ${ix + dw / 2} ${iy + dh / 2})`} />
            </g>
          </g>
        );
      })}

      {/* Numéro de la tuile au centre de la tuile : sous les pions, il n'indique pas l'orientation (le dessin suffit pour poser la tuile). */}
      {tileLabels.map((t) => {
        // Centre de la case du milieu de la tuile (la 2e des 3 cases, soit 1,5 case depuis le coin de la tuile).
        const cx = (t.tx * TILE + (t.dx ?? 0) + TILE / 2) * C;
        const cy = (t.ty * TILE + (t.dy ?? 0) + TILE / 2) * C;
        const FS = 46;
        const style = { fill: '#fff', fillOpacity: 0.3, stroke: '#000', strokeOpacity: 0.35, strokeWidth: 2, paintOrder: 'stroke', fontWeight: 'bold' } as const;
        return (
          <g key={`tl${t.tx},${t.ty}`} data-testid={`tile-label-${t.tx}-${t.ty}`} pointerEvents="none">
            {/* Le chiffre est centré exactement sur la case du milieu : la ligne de base est abaissée de la demi-hauteur des chiffres (≈ 0,36 em), sans dépendre du rendu de dominant-baseline. */}
            <text data-testid={`tile-number-${t.tx}-${t.ty}`} x={cx} y={cy + FS * 0.36} textAnchor="middle" fontSize={FS} {...style}>
              {t.label.slice(0, -1)}
            </text>
            {/* La face (A ou B) se pose à côté, sans décaler le chiffre. */}
            <text data-testid={`tile-face-${t.tx}-${t.ty}`} x={cx + FS * 0.42} y={cy + FS * 0.36} textAnchor="start" fontSize={FS * 0.5} {...style}>
              {t.label.slice(-1)}
            </text>
          </g>
        );
      })}

      {(board.interior ?? []).map((c) => (
        <rect key={`in${c.x},${c.y}`} data-testid={`interior-${c.x}-${c.y}`} x={c.x * C} y={c.y * C} width={C} height={C} fill="none" pointerEvents="none" />
      ))}

      {Array.from({ length: board.height }, (_, y) =>
        Array.from({ length: board.width }, (_, x) =>
          isHole(x, y) ? null : (
            <g key={`c${x},${y}`}>
              <rect
                data-testid={`cell-${x}-${y}`}
                x={x * C}
                y={y * C}
                width={C}
                height={C}
                fill="transparent"
                stroke="#0c0a09"
                strokeOpacity={0.35}
                onClick={() => onCell?.({ x, y })}
                style={{ cursor: onCell ? 'pointer' : 'default' }}
              />
              {showCoords && (
                <text x={x * C + 3} y={y * C + 10} fontSize="8" fill="#e7e5e4" fillOpacity={0.55} pointerEvents="none">
                  {x},{y}
                </text>
              )}
            </g>
          ),
        ),
      )}

      {highlights.map((h) => (
        <g key={`${h.kind}-${h.pos.x}-${h.pos.y}`} pointerEvents="none">
          <rect x={h.pos.x * C + 2} y={h.pos.y * C + 2} width={C - 4} height={C - 4} rx="6" fill={FILL[h.kind].color} fillOpacity={FILL[h.kind].opacity} stroke={FILL[h.kind].color} strokeOpacity={0.9} />
          {h.label && (
            <text x={h.pos.x * C + C - 8} y={h.pos.y * C + C - 6} fontSize="11" textAnchor="end" fontWeight="bold" fill="#fff">
              {h.label}
            </text>
          )}
        </g>
      ))}

      {inactiveEdges.map(([a, b], i) => (
        <line key={`ia${i}`} {...edgeLine(a, b)} stroke="#a8a29e" strokeWidth="4" strokeDasharray="3 5" pointerEvents="none" />
      ))}
      {board.walls.map(([a, b], i) => (
        <g key={`w${i}`} pointerEvents="none">
          <line {...edgeLine(a, b)} stroke="#0c0a09" strokeWidth="9" strokeLinecap="round" />
          <line {...edgeLine(a, b)} stroke="#a8a29e" strokeWidth="4" strokeLinecap="round" />
        </g>
      ))}
      {board.doors.map((d) => (
        <g key={d.id}>
          {doorGlow.has(d.id) && <line {...edgeLine(d.a, d.b)} stroke="#facc15" strokeWidth="14" strokeLinecap="round" className="aq-pulse" pointerEvents="none" />}
          <line {...edgeLine(d.a, d.b)} stroke="#1c1006" strokeWidth="10" strokeLinecap="round" strokeDasharray={d.open ? '5 6' : undefined} />
          <line data-testid={`door-${d.id}`} data-special={d.special ? 'true' : undefined} {...edgeLine(d.a, d.b)} stroke={d.special ? '#a855f7' : d.open ? '#22c55e' : '#b45309'} strokeWidth="6" strokeLinecap="round" strokeDasharray={d.open ? '5 6' : undefined} pointerEvents="none" />
          {onDoor && (!doorIds || doorIds.includes(d.id)) && <line data-testid={`door-hit-${d.id}`} {...edgeLine(d.a, d.b)} stroke="transparent" strokeWidth="22" strokeLinecap="round" style={{ cursor: 'pointer' }} onClick={() => onDoor(d.id)} />}
        </g>
      ))}
      {board.portals.map((p) => (
        <g key={p.id} pointerEvents="none">
          <circle cx={center(p.at).x} cy={center(p.at).y} r="18" fill="none" stroke={p.color === 'red' ? '#ef4444' : p.color === 'blue' ? '#3b82f6' : '#a855f7'} strokeWidth="3" />
          <circle cx={center(p.at).x} cy={center(p.at).y} r="10" fill="none" stroke="#a855f7" strokeWidth="1.5" />
        </g>
      ))}
      {spawns.map((s) => {
        const c = center(s.at);
        return (
          <g key={s.id} data-testid={`spawn-${s.id}`} pointerEvents="none">
            <title>{`Jeton Spawn ${s.id}`}</title>
            {/* Jeton Spawn : étoile violette, sous les pions. */}
            <polygon points={starPoints(c.x, c.y, 22, 10)} fill="#7c3aed" fillOpacity={0.6} stroke="#d8b4fe" strokeWidth="2" strokeLinejoin="round" />
            {/* Paire de faces de dé qui désigne ce jeton, dans les coins pour ne pas gêner le pion. */}
            {s.dice.map((face, i) => {
              const x = s.at.x * C + (i === 0 ? 2 : C - 16);
              const y = s.at.y * C + 2;
              return (
                <g key={i}>
                  <rect x={x} y={y} width="14" height="14" rx="3" fill="#1c1917" stroke="#d8b4fe" strokeWidth="1" />
                  <text x={x + 7} y={y + 11} fontSize="10" fontWeight="bold" textAnchor="middle" fill="#f5f3ff">
                    {DIE_GLYPH[face] ?? face.slice(0, 1).toUpperCase()}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}

      {ghosts.map((g, i) => (
        <g key={`gh${i}`} pointerEvents="none" opacity={0.45}>
          <circle cx={center(g.at).x} cy={center(g.at).y} r="14" fill="none" stroke="#fff" strokeDasharray="4 3" strokeWidth="2" />
          <text x={center(g.at).x} y={center(g.at).y + 4} fontSize="10" textAnchor="middle" fill="#fff">
            {g.label}
          </text>
        </g>
      ))}

      {paths.map((p, i) => (
        <polyline
          key={`p${i}`}
          pointerEvents="none"
          fill="none"
          stroke={p.color ?? '#facc15'}
          strokeWidth="4"
          strokeLinejoin="round"
          strokeDasharray="2 6"
          strokeLinecap="round"
          markerEnd={`url(#${uid}-arrow)`}
          points={p.points.map((q) => `${center(q).x},${center(q).y}`).join(' ')}
        />
      ))}

      {lines.map((l, i) => (
        <line
          key={`los${i}`}
          data-testid="sight-line"
          data-tone={l.tone}
          x1={center(l.from).x}
          y1={center(l.from).y}
          x2={center(l.to).x}
          y2={center(l.to).y}
          stroke={l.tone === 'clear' ? '#f87171' : '#78716c'}
          strokeWidth="2.5"
          strokeDasharray={l.tone === 'clear' ? '2 5' : '1 6'}
          strokeLinecap="round"
          opacity={l.tone === 'clear' ? 0.95 : 0.6}
          pointerEvents="none"
        />
      ))}

      {overlay && (
        <g data-testid="instruction-overlay" pointerEvents="none">
          {overlay.rings.map((r, i) => {
            const c = center(r.at);
            return (
              <g key={`ring${i}`}>
                <circle cx={c.x} cy={c.y} r={C / 2 - 3} fill={RING_COLOR[r.tone]} fillOpacity={0.18} stroke={RING_COLOR[r.tone]} strokeWidth="3" className="aq-pulse" />
                {r.badge && (
                  <g>
                    <rect x={c.x + 4} y={c.y - C / 2 + 2} width="26" height="16" rx="8" fill="#7f1d1d" stroke="#fff" strokeWidth="1" />
                    <text x={c.x + 17} y={c.y - C / 2 + 14} fontSize="11" fontWeight="bold" textAnchor="middle" fill="#fff">
                      {r.badge}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
          {overlay.arrows.map((a, i) => (
            <polyline
              key={`arrow${i}`}
              data-testid="instruction-arrow"
              fill="none"
              stroke={a.tone === 'attack' ? '#ef4444' : '#facc15'}
              strokeWidth="5"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray="10 6"
              className="aq-march"
              markerEnd={`url(#${uid}-arrow${a.tone === 'attack' ? '-atk' : ''})`}
              points={a.points.map((q) => `${center(q).x},${center(q).y}`).join(' ')}
            />
          ))}
          {overlay.ghosts.map((g) => (
            <g key={`ghost${g.id}`} data-testid={`ghost-${g.id}`}>
              <circle cx={center(g.at).x} cy={center(g.at).y} r={C / 2 - 2} fill="none" stroke="#facc15" strokeWidth="3" strokeDasharray="5 4" className="aq-pulse" />
              <Pawn at={center(g.at)} kind={g.kind} label={g.label} opacity={0.7} stroke="#facc15" strokeWidth={2.5} dashed className="aq-pulse" />
            </g>
          ))}
          {overlay.removals.map((r) => {
            const c = center(r.at);
            return (
              <g key={`rm${r.id}`} data-testid={`remove-${r.id}`}>
                <Pawn at={c} kind={r.kind} label={r.label} opacity={0.45} />
                <line x1={c.x - 14} y1={c.y - 14} x2={c.x + 14} y2={c.y + 14} stroke="#ef4444" strokeWidth="5" strokeLinecap="round" />
                <line x1={c.x + 14} y1={c.y - 14} x2={c.x - 14} y2={c.y + 14} stroke="#ef4444" strokeWidth="5" strokeLinecap="round" />
              </g>
            );
          })}
        </g>
      )}

      {drag?.moved &&
        (() => {
          const dragged = shown.find((t) => t.id === drag.id);
          if (!dragged) return null;
          const from = center(dragged.at);
          // Rouge quand le pion survole une figurine adverse : c'est une attaque.
          const hostile = !!dragCell && shown.some((t) => t.id !== dragged.id && t.kind !== dragged.kind && same(t.at, dragCell));
          return (
            <line
              data-testid="drag-line"
              data-hostile={hostile}
              x1={from.x}
              y1={from.y}
              x2={drag.x}
              y2={drag.y}
              stroke={hostile ? '#ef4444' : '#facc15'}
              strokeWidth="4"
              strokeDasharray="8 6"
              strokeLinecap="round"
              pointerEvents="none"
            />
          );
        })()}

      {dragCell && inBoard(dragCell) && (
        <rect
          data-testid="drop-cell"
          x={dragCell.x * C + 2}
          y={dragCell.y * C + 2}
          width={C - 4}
          height={C - 4}
          rx="6"
          fill="none"
          stroke={overlay?.dropTarget && drag?.id === overlay.dropTarget.actorId ? (same(dragCell, overlay.dropTarget.at) ? '#22c55e' : '#ef4444') : '#fff'}
          strokeWidth="3"
          strokeDasharray="6 4"
          pointerEvents="none"
        />
      )}

      {(overlay?.extraTokens ?? []).map((t) => (
        <Pawn key={`extra${t.id}`} at={center(t.at)} kind={t.kind} label={t.label} />
      ))}

      {shown.map((t) => {
        if (drag?.moved && drag.id === t.id) return null;
        const k = `${t.at.x},${t.at.y}`;
        const n = stack.get(k) ?? 0;
        stack.set(k, n + 1);
        // Une figurine seule est centrée ; à deux (maximum par case), l'une en haut à gauche et l'autre en bas à droite (chevauchement toléré).
        const shared = (inCell.get(k) ?? 1) > 1;
        const cx = t.at.x * C + C * (shared ? (n === 0 ? 0.3 : 0.7) : 0.5);
        const cy = t.at.y * C + C * (shared ? (n === 0 ? 0.3 : 0.7) : 0.5);
        const draggable = !!canDrag?.(t.id);
        return (
          <g
            key={t.id}
            data-testid={`token-${t.id}`}
            role={onToken ? 'button' : undefined}
            aria-label={`${t.kind === 'hero' ? 'Héros' : 'Monstre'} ${t.id}`}
            onPointerDown={(e) => startDrag(e, t.id)}
            onClick={(e) => {
              if (!onToken) return;
              e.stopPropagation();
              if (suppressClick.current) return;
              onToken(t.id);
            }}
            style={{ cursor: draggable ? 'grab' : onToken ? 'pointer' : 'default' }}
            opacity={t.dimmed ? 0.55 : 1}
          >
            <circle cx={cx} cy={cy} r="15" fill={KIND_COLOR[t.kind]} stroke={t.selected ? '#facc15' : t.guard ? '#f59e0b' : '#fff'} strokeWidth={t.selected ? 4 : t.guard ? 3 : 1.5} />
            <text x={cx} y={cy + 4} fontSize="11" fontWeight="bold" textAnchor="middle" fill="#fff" pointerEvents="none">
              {t.label}
            </text>
            {t.wounded && <circle cx={cx + 11} cy={cy - 11} r="4.5" fill="#facc15" stroke="#000" strokeWidth="0.5" pointerEvents="none" />}
            {t.attack && (
              <g data-testid={`attack-badge-${t.id}`} role="img" aria-label={`${t.attack.type === 'melee' ? 'Mêlée' : 'Distance'}, ${t.attack.dice} dé${t.attack.dice > 1 ? 's' : ''}`} pointerEvents="none">
                <rect x={cx - 13} y={cy + 9} width="26" height="13" rx="6.5" fill="#1c1917" stroke={t.attack.type === 'melee' ? '#f87171' : '#38bdf8'} strokeWidth="1.2" />
                <text x={cx} y={cy + 19} fontSize="9" fontWeight="bold" textAnchor="middle" fill="#fff">
                  {t.attack.type === 'melee' ? '⚔' : '🏹'}
                  {t.attack.dice}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {drag?.moved &&
        (() => {
          const t = tokens.find((x) => x.id === drag.id);
          if (!t) return null;
          return (
            <g data-testid="dragged-token" pointerEvents="none">
              <circle cx={drag.x} cy={drag.y + 4} r="17" fill="#000" opacity={0.3} />
              <Pawn at={{ x: drag.x, y: drag.y }} kind={t.kind} label={t.label} r={17} stroke="#facc15" strokeWidth={3} />
            </g>
          );
        })()}

      {/* Objectifs : toujours au-dessus de tout (pions, fantômes, flèches, lignes de visée) pour rester visibles. */}
      {objectives.map((o) => {
        const x = o.at.x * C;
        const y = o.at.y * C;
        const tone = o.done ? '#34d399' : '#fbbf24';
        return (
          <g key={`obj${o.id}`} data-testid={`objective-${o.id}`} data-done={o.done} pointerEvents="none" opacity={o.done ? 0.75 : 1}>
            <title>{o.done ? `${o.title} (accompli)` : o.title}</title>
            <rect x={x + 2.5} y={y + 2.5} width={C - 5} height={C - 5} rx="7" fill="none" stroke={tone} strokeWidth="2" strokeDasharray="5 4" opacity={0.85} />
            <circle cx={x + 13} cy={y + 13} r="11.5" fill="#1c1917" stroke={tone} strokeWidth="1.8" />
            <g transform={`translate(${x + 5.5} ${y + 5.5})`}>
              <ObjectiveIcon icon={o.icon} size={15} color={tone} background="#1c1917" title={o.title} />
            </g>
            {o.done && (
              <path d={`M ${x + C - 17} ${y + 12} l 4.5 5 l 9 -10`} fill="none" stroke="#34d399" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </g>
        );
      })}

      {edges.map(([a, b]) => (
        <line
          key={`e${a.x},${a.y}-${b.x},${b.y}`}
          data-testid={`edge-${a.x},${a.y}-${b.x},${b.y}`}
          {...edgeLine(a, b)}
          stroke="transparent"
          strokeWidth="16"
          strokeLinecap="round"
          onClick={() => onEdge?.(a, b)}
          style={{ cursor: 'pointer' }}
        />
      ))}
    </svg>
  );
}

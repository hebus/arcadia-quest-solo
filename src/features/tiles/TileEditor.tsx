import { parse } from '@/engine/domain/validate';
import { useEffect, useRef, useState } from 'react';
import { Button, Panel, inputClass } from '@/components/ui';
import type { Door, Position } from '@/engine/domain/schemas';
import {
  TILE,
  TileDefSchema,
  autoWalls,
  buildings,
  effectiveWalls,
  isInterior,
  pruneTile,
  sameEdge,
  toggleEdge,
  type Edge,
  type Rotation,
  type TileDef,
} from '@/engine/tiles';
import { BoardView } from '@/rendering/board/BoardView';
import { useTileStore } from '@/stores/tileStore';
import { readScan } from './imageImport';

type Tool = 'interior' | 'wall' | 'door';

const TOOLS: { id: Tool; label: string; help: string }[] = [
  { id: 'interior', label: 'Intérieur (bâtiment)', help: 'Touchez une case pour la passer en intérieur (ou la remettre en rue). Des cases d’intérieur contiguës forment un seul bâtiment, muré automatiquement.' },
  { id: 'wall', label: 'Murs', help: 'Touchez une arête pour ajouter un mur, ou pour supprimer un mur de bâtiment (réapparaît en pointillés gris : touchez-le pour le remettre). Les arêtes du bord de la tuile sont cliquables.' },
  { id: 'door', label: 'Portes', help: 'Touchez une arête de mur pour poser ou retirer une porte (état fermée ou ouverte réglé à la mise en place du scénario).' },
];

/**
 * Éditeur de tuile. Par défaut, tuile de rue : toutes les cases sont franchissables en orthogonal.
 * On marque les cases d'intérieur (bâtiments), on ajoute ou retire des murs et des portes sur le scan.
 */
export function TileEditor() {
  const { tiles, loaded, load, save, remove } = useTileStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('interior');
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const selected = tiles.find((t) => t.id === selectedId) ?? null;

  const importFiles = async (files: FileList | null) => {
    if (!files) return;
    try {
      for (const f of Array.from(files)) {
        const image = await readScan(f);
        const def = parse(TileDefSchema, {
          id: `tile-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: f.name.replace(/\.[^.]+$/, ''),
          image,
        });
        save(def);
        setSelectedId(def.id);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const update = (patch: Partial<TileDef>) => selected && save(pruneTile({ ...selected, ...patch }));
  const setCrop = (k: 'l' | 't' | 'r' | 'b', v: number) => selected && update({ crop: { ...selected.crop, [k]: v } });
  const rotateScan = (delta: number) => update({ imageRotation: ((((selected?.imageRotation ?? 0) + delta) % 360) as Rotation) });

  const view = (() => {
    if (!selected) return null;
    const doorKeys = selected.doors;
    const doors: Door[] = doorKeys.map(([a, b], i) => ({ id: `t${i}`, a, b, open: false }));
    const walls = effectiveWalls(selected).filter((w) => !doorKeys.some((d) => sameEdge(d, w)));
    return {
      board: { width: TILE, height: TILE, holes: [], portals: [], interior: selected.interior, walls, doors },
      inactive: selected.openedWalls as [Position, Position][],
      groups: buildings(selected),
    };
  })();

  const onCell = (p: Position) => {
    if (!selected || tool !== 'interior') return;
    const has = isInterior(selected, p);
    update({ interior: has ? selected.interior.filter((c) => !(c.x === p.x && c.y === p.y)) : [...selected.interior, p] });
  };

  const onEdge = (a: Position, b: Position) => {
    if (!selected) return;
    const e: Edge = [a, b];
    if (tool === 'wall') {
      if (autoWalls(selected).some((w) => sameEdge(w, e))) update({ openedWalls: toggleEdge(selected.openedWalls, e) });
      else update({ walls: toggleEdge(selected.walls, e) });
    } else if (tool === 'door') {
      const isWall = effectiveWalls(selected).some((w) => sameEdge(w, e)) || selected.doors.some((d) => sameEdge(d, e));
      if (isWall) update({ doors: toggleEdge(selected.doors, e) });
      else setError('Une porte se pose sur un mur : tracez d’abord le mur (ou un bâtiment).');
    }
  };

  const help = TOOLS.find((t) => t.id === tool)!.help;

  return (
    <div className="space-y-3">
      <Panel
        title="Bibliothèque de tuiles"
        actions={
          <>
            <Button variant="primary" onClick={() => file.current?.click()}>
              Importer des scans
            </Button>
            <input
              ref={file}
              type="file"
              accept="image/*"
              multiple
              hidden
              aria-label="Scans de tuiles"
              onChange={(e) => {
                void importFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </>
        }
      >
        {error && (
          <p role="alert" className="mb-2 text-red-300">
            {error}
          </p>
        )}
        {tiles.length === 0 ? (
          <p className="text-stone-400">Aucune tuile. Importez le scan de chaque face de tuile (une image par face, vue de dessus). Une tuile est une tuile de rue par défaut.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {tiles.map((t) => (
              <li key={t.id}>
                <Button variant={t.id === selectedId ? 'primary' : 'secondary'} onClick={() => setSelectedId(t.id)}>
                  {t.name} · {buildings(t).length} bâtiment(s) · {effectiveWalls(t).length} mur(s) · {t.doors.length} porte(s)
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {selected && view && (
        <Panel
          title={`Tuile : ${selected.name}`}
          actions={
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm(`Supprimer « ${selected.name} » ?`)) {
                  remove(selected.id);
                  setSelectedId(null);
                }
              }}
            >
              Supprimer
            </Button>
          }
        >
          <nav aria-label="Outils de la tuile" className="mb-2 flex flex-wrap gap-2">
            {TOOLS.map((t) => (
              <Button key={t.id} variant={tool === t.id ? 'primary' : 'secondary'} aria-pressed={tool === t.id} onClick={() => { setTool(t.id); setError(null); }}>
                {t.label}
              </Button>
            ))}
          </nav>
          <p className="mb-3 text-amber-200">{help}</p>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,460px)_1fr]">
            <div>
              <BoardView
                label={`Éditeur de la tuile ${selected.name}`}
                board={view.board}
                tiles={[{ def: selected, placement: { tileId: selected.id, tx: 0, ty: 0, rotation: 0 } }]}
                onCell={tool === 'interior' ? onCell : undefined}
                onEdge={tool === 'interior' ? undefined : onEdge}
                outerEdges={tool !== 'interior'}
                inactiveEdges={view.inactive}
                showCoords={false}
              />
              <p className="mt-2 text-sm text-stone-400">Rue : cases normales · orangé : intérieur · trait blanc : mur · trait brun : porte · pointillé gris : mur retiré.</p>
            </div>
            <div className="space-y-3">
              <label className="block">
                Nom (code de la tuile et face)
                <input className={inputClass} value={selected.name} onChange={(e) => update({ name: e.target.value })} />
              </label>
              <div>
                <h3 className="mb-1 font-medium">Bâtiments</h3>
                {view.groups.length === 0 ? (
                  <p className="text-sm text-stone-400">Aucun : toutes les cases sont des cases de rue.</p>
                ) : (
                  <ul className="list-disc pl-5 text-sm">
                    {view.groups.map((g, i) => (
                      <li key={i}>
                        Bâtiment {i + 1} : {g.length} case(s)
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <fieldset className="grid grid-cols-2 gap-3">
                <legend className="mb-1 font-medium">Cadrage du scan (marges retirées, en %)</legend>
                {(
                  [
                    ['l', 'Gauche'],
                    ['t', 'Haut'],
                    ['r', 'Droite'],
                    ['b', 'Bas'],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k} className="block">
                    {label} : {selected.crop[k]} %
                    <input aria-label={`Marge ${label}`} className="w-full" type="range" min={0} max={40} value={selected.crop[k]} onChange={(e) => setCrop(k, Number(e.target.value))} />
                  </label>
                ))}
              </fieldset>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => rotateScan(270)}>↺ Tourner le scan</Button>
                <Button onClick={() => rotateScan(90)}>↻ Tourner le scan</Button>
                <Button onClick={() => update({ interior: [], walls: [], openedWalls: [], doors: [] })} disabled={selected.interior.length + selected.walls.length + selected.doors.length === 0}>
                  Tout effacer (retour à une tuile de rue)
                </Button>
              </div>
              <p className="text-sm text-stone-400">
                Alignez la grille 3×3 sur les cases imprimées avec le cadrage. Un bâtiment est toujours entièrement sur une tuile ; ses murs vers la tuile voisine se règlent avec les arêtes du bord.
              </p>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}

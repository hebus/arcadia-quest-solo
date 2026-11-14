import { parse } from '@/engine/domain/validate';
import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Panel, inputClass } from '@/components/ui';
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
import { CATALOG_TILE_IDS, TILE_FACES, TILE_NUMBERS, isCatalogTile, parseTileCode } from '@/engine/tileCatalog';
import { BoardView, type Highlight } from '@/rendering/board/BoardView';
import { useTileStore } from '@/stores/tileStore';
import { readScan } from './imageImport';

type Tool = 'interior' | 'start' | 'wall' | 'door';

const TOOLS: { id: Tool; label: string; help: string }[] = [
  { id: 'interior', label: 'Bâtiments', help: 'Touchez une case pour la passer en intérieur de bâtiment (ou la remettre en rue). Des cases d’intérieur contiguës forment un seul bâtiment, muré automatiquement.' },
  { id: 'start', label: 'Départ des héros', help: 'Touchez les cases qui forment la zone de départ des héros imprimée sur cette face (en jaune). Touchez de nouveau pour la retirer. Une face sans zone de départ n’en a aucune.' },
  { id: 'wall', label: 'Murs', help: 'Touchez une arête pour ajouter un mur, ou pour supprimer un mur de bâtiment (réapparaît en pointillés gris : touchez-le pour le remettre). Les arêtes du bord de la tuile sont cliquables.' },
  { id: 'door', label: 'Portes', help: 'Touchez une arête de mur pour poser ou retirer une porte (état fermée ou ouverte réglé à la mise en place du scénario).' },
];

const faceLabel = (id: string): string => `${id} (${id.endsWith('A') ? 'recto' : 'verso'})`;

/**
 * Éditeur des tuiles du jeu : 9 tuiles doubles faces numérotées de 1 à 9 (faces A et B), soit 18 faces à définir une fois pour toutes.
 * Pour chaque face : scan, zones de bâtiments (cases d'intérieur, murées automatiquement), murs, portes et zone de départ des héros.
 * Par défaut une face est une tuile de rue : toutes les cases sont franchissables en orthogonal.
 */
export function TileEditor() {
  const { tiles, loaded, load, save, remove } = useTileStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('interior');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const faceScan = useRef<HTMLInputElement>(null);
  const jsonFile = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const byId = new Map(tiles.map((t) => [t.id, t]));
  const selected = (selectedId && byId.get(selectedId)) || null;
  const others = tiles.filter((t) => !isCatalogTile(t.id));
  const defined = CATALOG_TILE_IDS.filter((id) => byId.has(id)).length;

  /** Sélectionne une face du jeu ; si elle n'existe pas encore, elle est créée vierge (tuile de rue, sans scan). */
  const openFace = (id: string) => {
    if (!byId.has(id)) save(parse(TileDefSchema, { id, name: id }));
    setSelectedId(id);
    setError(null);
  };

  const importFiles = async (files: FileList | null) => {
    if (!files) return;
    try {
      // Le code de la face se lit dans le nom du fichier (« 3B.png ») ; à défaut, première face libre.
      const known = new Map(tiles.map((t) => [t.id, t]));
      for (const f of Array.from(files)) {
        const image = await readScan(f);
        const code = parseTileCode(f.name);
        const existing = code ? known.get(code) : undefined;
        if (existing) {
          const updated = { ...existing, image };
          known.set(existing.id, updated);
          save(updated);
          setSelectedId(existing.id);
          continue;
        }
        const id = code ?? CATALOG_TILE_IDS.find((x) => !known.has(x));
        if (!id) throw new Error('Les 18 faces de tuile (1A à 9B) sont déjà définies.');
        const def = parse(TileDefSchema, { id, name: id, image });
        known.set(id, def);
        save(def);
        setSelectedId(def.id);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  /** Scan de la face sélectionnée. */
  const attachScan = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f || !selected) return;
    try {
      save({ ...selected, image: await readScan(f) });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  /** Sauvegarde de toutes les définitions de tuiles dans un fichier : à garder, ou à partager pour générer des scénarios. */
  const exportTiles = () => {
    const blob = new Blob([JSON.stringify({ format: 'arcadia-quest-tiles', version: 1, tiles }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tuiles-arcadia-quest.json';
    a.click();
    URL.revokeObjectURL(url);
    setNotice(`${tiles.length} tuile(s) exportée(s).`);
  };

  const importTiles = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    try {
      const data: unknown = JSON.parse(await f.text());
      const list = Array.isArray(data) ? data : (data as { tiles?: unknown }).tiles;
      if (!Array.isArray(list)) throw new Error('Fichier de tuiles invalide : liste « tiles » absente.');
      const defs = list.map((t) => parse(TileDefSchema, t));
      for (const d of defs) save(d);
      setNotice(`${defs.length} tuile(s) importée(s).`);
      setError(null);
    } catch (e) {
      setNotice(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const update = (patch: Partial<TileDef>) => selected && save(pruneTile({ ...selected, ...patch }));
  const setCrop = (k: 'l' | 't' | 'r' | 'b', v: number) => selected && update({ crop: { ...selected.crop, [k]: v } });
  const rotateScan = (delta: number) => update({ imageRotation: ((((selected?.imageRotation ?? 0) + delta) % 360) as Rotation) });

  /** Change la face représentée (1A à 9B) ; une face déjà définie par une autre tuile n'est pas proposée. */
  const changeFace = (id: string) => {
    if (!selected || id === selected.id || byId.has(id)) return;
    remove(selected.id);
    save({ ...selected, id, name: selected.name === selected.id ? id : selected.name });
    setSelectedId(id);
  };

  const view = (() => {
    if (!selected) return null;
    const doorKeys = selected.doors;
    const doors: Door[] = doorKeys.map(([a, b], i) => ({ id: `t${i}`, a, b, open: false }));
    const walls = effectiveWalls(selected).filter((w) => !doorKeys.some((d) => sameEdge(d, w)));
    return {
      board: { width: TILE, height: TILE, holes: [], portals: [], interior: selected.interior, walls, doors },
      inactive: selected.openedWalls as [Position, Position][],
      groups: buildings(selected),
      start: selected.heroStart.map((pos): Highlight => ({ pos, kind: 'end', label: 'D' })),
    };
  })();

  const onCell = (p: Position) => {
    if (!selected) return;
    if (tool === 'interior') {
      const has = isInterior(selected, p);
      update({ interior: has ? selected.interior.filter((c) => !(c.x === p.x && c.y === p.y)) : [...selected.interior, p] });
    } else if (tool === 'start') {
      const has = selected.heroStart.some((c) => c.x === p.x && c.y === p.y);
      update({ heroStart: has ? selected.heroStart.filter((c) => !(c.x === p.x && c.y === p.y)) : [...selected.heroStart, p] });
    }
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
  const cellTool = tool === 'interior' || tool === 'start';

  return (
    <div className="space-y-3">
      <Panel
        title="Les 9 tuiles du jeu"
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
            <Button onClick={exportTiles} disabled={tiles.length === 0}>
              Exporter
            </Button>
            <Button onClick={() => jsonFile.current?.click()}>Importer un fichier</Button>
            <input
              ref={jsonFile}
              type="file"
              accept="application/json,.json"
              hidden
              aria-label="Fichier de tuiles"
              onChange={(e) => {
                void importTiles(e.target.files);
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
        {notice && (
          <p role="status" className="mb-2 text-emerald-300">
            {notice}
          </p>
        )}
        <p className="mb-2 text-sm text-stone-400">
          Le jeu compte 9 tuiles doubles faces, numérotées de 1 à 9 : un recto (A) et un verso (B), soit 18 faces. Touchez une face pour la définir : zones de bâtiments, murs, portes et zone de départ des héros. {defined} / {CATALOG_TILE_IDS.length} faces définies.
        </p>
        <table className="w-full max-w-xl text-left" aria-label="Catalogue des tuiles">
          <thead>
            <tr className="text-sm text-stone-400">
              <th className="w-16 py-1 font-normal">Tuile</th>
              {TILE_FACES.map((f) => (
                <th key={f} className="py-1 font-normal">
                  {f === 'A' ? 'Recto (A)' : 'Verso (B)'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TILE_NUMBERS.map((n) => (
              <tr key={n}>
                <th scope="row" className="py-1 text-lg">
                  {n}
                </th>
                {TILE_FACES.map((f) => {
                  const id = `${n}${f}`;
                  const t = byId.get(id);
                  return (
                    <td key={id} className="py-1 pr-2">
                      <Button className="w-full text-left" variant={id === selectedId ? 'primary' : 'secondary'} aria-pressed={id === selectedId} aria-label={`Face ${id}`} onClick={() => openFace(id)}>
                        <span className="font-semibold">{id}</span>
                        <span className="ml-2 text-sm opacity-80">
                          {t ? `${t.image ? '🖼 ' : ''}${buildings(t).length} bât. · ${t.heroStart.length} dép.` : 'à définir'}
                        </span>
                      </Button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {others.length > 0 && (
          <div className="mt-3">
            <h3 className="mb-1 text-sm font-medium text-amber-300">Autres tuiles (hors du jeu de base)</h3>
            <ul className="flex flex-wrap gap-2">
              {others.map((t) => (
                <li key={t.id}>
                  <Button variant={t.id === selectedId ? 'primary' : 'secondary'} onClick={() => setSelectedId(t.id)}>
                    {t.name}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      {selected && view && (
        <Panel
          title={isCatalogTile(selected.id) ? `Face ${faceLabel(selected.id)}` : `Tuile : ${selected.name}`}
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
                highlights={view.start}
                onCell={cellTool ? onCell : undefined}
                onEdge={cellTool ? undefined : onEdge}
                outerEdges={!cellTool}
                inactiveEdges={view.inactive}
                showCoords={false}
              />
              <p className="mt-2 text-sm text-stone-400">Rue : cases normales · orangé : intérieur · jaune D : départ des héros · trait blanc : mur · trait brun : porte · pointillé gris : mur retiré.</p>
            </div>
            <div className="space-y-3">
              <label className="block">
                Face de la tuile (1A à 9B)
                <select aria-label="Face de la tuile" className={inputClass} value={selected.id} onChange={(e) => changeFace(e.target.value)}>
                  {!isCatalogTile(selected.id) && <option value={selected.id}>{selected.name} (hors du jeu)</option>}
                  {CATALOG_TILE_IDS.filter((id) => id === selected.id || !byId.has(id)).map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <h3 className="mb-1 font-medium">Zones</h3>
                <ul className="list-disc pl-5 text-sm">
                  <li>
                    Bâtiments : {view.groups.length === 0 ? 'aucun (toutes les cases sont de la rue)' : view.groups.map((g, i) => `bâtiment ${i + 1} (${g.length} case${g.length > 1 ? 's' : ''})`).join(', ')}
                  </li>
                  <li>
                    Départ des héros : {selected.heroStart.length === 0 ? 'aucune zone' : <Badge tone="good">{selected.heroStart.length} case(s)</Badge>}
                  </li>
                </ul>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => faceScan.current?.click()}>{selected.image ? 'Remplacer le scan' : 'Ajouter le scan de cette face'}</Button>
                <input
                  ref={faceScan}
                  type="file"
                  accept="image/*"
                  hidden
                  aria-label="Scan de la face"
                  onChange={(e) => {
                    void attachScan(e.target.files);
                    e.target.value = '';
                  }}
                />
                {selected.image && (
                  <Button variant="ghost" onClick={() => update({ image: undefined })}>
                    Retirer le scan
                  </Button>
                )}
              </div>
              {selected.image && (
                <>
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
                  </div>
                </>
              )}
              <Button onClick={() => update({ interior: [], walls: [], openedWalls: [], doors: [], heroStart: [] })} disabled={selected.interior.length + selected.walls.length + selected.doors.length + selected.heroStart.length === 0}>
                Tout effacer (retour à une tuile de rue)
              </Button>
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

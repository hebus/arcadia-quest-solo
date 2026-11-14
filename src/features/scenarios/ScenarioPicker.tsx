import { TilesButton } from '@/features/scenario/TilesButton';
import { useMemo, useState } from 'react';
import { MiniPawn } from '@/components/MiniPawn';
import { ObjectiveIcon } from '@/components/ObjectiveIcon';
import { Button, ErrorBanner, Panel } from '@/components/ui';
import { parseBoardDsl } from '@/engine/boardDsl';
import type { Difficulty } from '@/engine/domain/schemas';
import { scenarioBoard, scenarioToSetup, type HeroTemplate, type ScenarioDefinition } from '@/engine/scenario/definition';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES, ORIGINAL_SCENARIOS } from '@/game-data/original';
import { BoardView, type BoardToken } from '@/rendering/board/BoardView';
import { useGameStore } from '@/stores/gameStore';

const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Facile', medium: 'Moyenne', hard: 'Difficile', legendary: 'Légendaire' };
const HEROES_PER_GAME = 3;

/** Plateau d'un scénario : depuis ses tuiles ; si l'une n'est pas définie, la description textuelle sert d'aperçu. */
function boardOf(def: ScenarioDefinition) {
  try {
    return scenarioBoard(def, ORIGINAL_CONTENT);
  } catch {
    return parseBoardDsl(def.board);
  }
}

/** Aperçu visuel du scénario : plateau, départ des héros, monstres et objectifs, sans une coordonnée écrite. */
function ScenarioPreview({ def, heroes }: { def: ScenarioDefinition; heroes: HeroTemplate[] }) {
  const { board, spawnPoints } = useMemo(() => boardOf(def), [def]);
  const tokens: BoardToken[] = [
    ...heroes.map((h, i) => ({ id: `h${i + 1}`, kind: 'hero' as const, label: h.name.slice(0, 2).toUpperCase(), at: def.heroStarts[i]! })),
    ...def.monsters.map((m) => ({ id: m.id, kind: 'monster' as const, label: m.definitionId.slice(0, 2).toUpperCase(), at: m.at, guard: m.guard })),
  ];
  const objectives = def.quests.flatMap((q) => (q.at ? [{ id: q.id, at: q.at, icon: q.icon, title: q.title, done: false }] : []));
  const tileLabels = (def.tiles?.placements ?? []).map((pl) => ({ tx: pl.tx, ty: pl.ty, dx: pl.dx, dy: pl.dy, label: pl.tileId }));
  return <BoardView label="Aperçu du scénario" board={board} spawns={spawnPoints} tokens={tokens} objectives={objectives} tileLabels={tileLabels} showCoords={false} />;
}

/** Choix d'un scénario de l'univers original, de ses héros, puis briefing narratif avant de jouer : aucune mise en place manuelle. */
export function ScenarioPicker({ onStart }: { onStart: () => void }) {
  const setDefs = useGameStore((s) => s.setMonsterDefinitions);
  const newGame = useGameStore((s) => s.newGame);
  const [def, setDef] = useState<ScenarioDefinition | null>(null);
  const [picked, setPicked] = useState<string[]>(ORIGINAL_HEROES.slice(0, HEROES_PER_GAME).map((h) => h.id));
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!def) {
    return (
      <Panel title="Choisir un scénario">
        <ul className="grid gap-3 md:grid-cols-2">
          {ORIGINAL_SCENARIOS.map((s) => (
            <li key={s.id} className="rounded-xl border border-stone-700 bg-stone-800 p-4">
              <h3 className="text-xl font-semibold text-amber-300">
                {s.sandbox && <span aria-hidden="true">🧪 </span>}
                {s.title}
              </h3>
              <p className="mt-1 text-stone-300">{s.tagline}</p>
              <p className="mt-2 text-sm text-stone-400">Difficulté conseillée : {DIFFICULTY_LABEL[s.recommended]}</p>
              <Button className="mt-3" variant="primary" aria-label={`Voir le briefing : ${s.title}`} onClick={() => { setDef(s); setDifficulty(s.recommended); }}>
                Voir le briefing
              </Button>
            </li>
          ))}
        </ul>
      </Panel>
    );
  }

  const heroes = picked.map((id) => ORIGINAL_HEROES.find((h) => h.id === id)!).filter(Boolean);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < HEROES_PER_GAME ? [...p, id] : p));

  const start = () => {
    try {
      const config = scenarioToSetup(def, { sessionId: `s-${Date.now()}`, difficulty: difficulty ?? def.recommended, seed: Date.now() % 2147483647, heroes }, ORIGINAL_CONTENT);
      setDefs(Object.values(ORIGINAL_CONTENT.monsters));
      newGame(config, def.script ?? []);
      if (useGameStore.getState().game) {
        // Terrain d'essai : on commence en placement libre, pour poser les pions comme on veut.
        if (def.sandbox) {
          useGameStore.getState().setCorrectionMode(true);
          useGameStore.getState().begin();
        }
        onStart();
      }
      else setError(useGameStore.getState().error ?? 'La partie n’a pas pu être créée.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Tout le briefing tient sur une page, sans défilement : récit, objectifs, guilde et lancement à gauche, plateau à droite.
  return (
    <div data-testid="briefing-page" className="flex flex-col gap-2 lg:h-[calc(100dvh-8rem)]">
      <ErrorBanner message={error} onClose={() => setError(null)} />
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-amber-300">{def.title}</h2>
          <p className="text-sm text-stone-300">{def.tagline}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {def.tiles && <TilesButton board={boardOf(def).board} layout={def.tiles} />}
          <Button variant="ghost" onClick={() => setDef(null)}>
            ← Autres scénarios
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_min(calc(100dvh_-_11rem),46vw)]">
        <div className="flex min-h-0 flex-col gap-3">
          <section aria-label="Récit" className="space-y-2 text-[15px] leading-snug">
            {def.story.intro.map((p, i) => (
              <p key={i} className={i === 0 ? 'italic text-amber-100' : 'text-stone-200'}>
                {p}
              </p>
            ))}
          </section>

          <section aria-label="Objectifs">
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {def.quests.map((q) => (
                <li key={q.id} className="flex items-center gap-1.5 text-sm">
                  <ObjectiveIcon icon={q.icon} size={20} />
                  <span>{q.title}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label={`Votre guilde (${picked.length}/${HEROES_PER_GAME})`}>
            <h3 className="mb-1 text-sm font-semibold text-amber-300">
              Votre guilde ({picked.length}/{HEROES_PER_GAME})
            </h3>
            <ul className="flex flex-wrap gap-2">
              {ORIGINAL_HEROES.map((h) => {
                const on = picked.includes(h.id);
                return (
                  <li key={h.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      title={h.epithet}
                      onClick={() => toggle(h.id)}
                      className={`flex items-center gap-2 rounded-xl border-2 py-1.5 pl-2 pr-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${on ? 'border-amber-400 bg-stone-800' : 'border-stone-700 bg-stone-900 opacity-70'}`}
                    >
                      <MiniPawn kind="hero" label={h.name.slice(0, 2).toUpperCase()} size={34} />
                      <span className="min-w-0 leading-tight">
                        <strong className="block">{h.name}</strong>
                        <span className="block truncate text-xs text-stone-400">
                          {'❤'.repeat(h.life)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <footer className="mt-auto flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              Difficulté
              <select className="min-h-11 rounded-lg border border-stone-600 bg-stone-800 px-3" value={difficulty ?? def.recommended} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
                {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_LABEL[d]}
                  </option>
                ))}
              </select>
            </label>
            <Button variant="primary" className="flex-1" disabled={picked.length !== HEROES_PER_GAME} onClick={start}>
              Commencer l’aventure
            </Button>
          </footer>
        </div>

        <div className="min-h-0 self-start">
          <ScenarioPreview def={def} heroes={heroes} />
        </div>
      </div>
    </div>
  );
}

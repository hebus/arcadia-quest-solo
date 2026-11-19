import { TilesButton } from '@/features/scenario/TilesButton';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Drawer } from '@/components/Drawer';
import { TabDock } from '@/components/TabDock';
import { usePortrait } from '@/hooks/usePortrait';
import { MiniPawn } from '@/components/MiniPawn';
import { ObjectiveIcon } from '@/components/ObjectiveIcon';
import { Button, ErrorBanner, Panel } from '@/components/ui';
import { parseBoardDsl } from '@/engine/boardDsl';
import type { Difficulty } from '@/engine/domain/schemas';
import { DIFFICULTY_LEVEL, resolveDifficulty } from '@/engine/scenario/difficulty';
import { scenarioBoard, scenarioToSetup, type HeroTemplate, type ScenarioDefinition } from '@/engine/scenario/definition';
import { GENERATED_LEVELS, MAX_GENERATED_TILES, MIN_GENERATED_TILES, generateScenario, type GeneratedLevel } from '@/engine/scenario/generate';
import { ORIGINAL_CONTENT, ORIGINAL_SCENARIOS } from '@/game-data/original';
import { BoardView, type BoardToken } from '@/rendering/board/BoardView';
import { GUILD_SIZE, MAX_HERO_LIFE, MIN_HERO_LIFE, guildProblems, guildToTemplates } from '@/engine/guild';
import { Stepper } from '@/components/Tally';
import { CampaignCard } from './CampaignCard';
import { RandomCampaignCard } from './RandomCampaignCard';
import { MediumCampaignCard } from './MediumCampaignCard';
import { isCampaignChapter } from '@/engine/scenario/generateCampaign';
import { CHAPTER_IDS, MEDIUM_IDS } from '@/stores/campaignRunStore';
import { useGameStore } from '@/stores/gameStore';
import { useGuildStore } from '@/stores/guildStore';

const DIFFICULTY_ICON: Record<Difficulty, string> = { easy: '🌱', medium: '⚔️', hard: '🔥', legendary: '🐉' };
const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Facile', medium: 'Moyenne', hard: 'Difficile', legendary: 'Légendaire' };

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

type BriefingTab = 'story' | 'objectives' | 'guild' | 'more';
const BRIEFING_TABS: { id: BriefingTab; label: string; icon: string; title: string }[] = [
  { id: 'story', label: 'Récit', icon: '📜', title: 'Récit' },
  { id: 'objectives', label: 'Objectifs', icon: '⚑', title: 'Objectifs' },
  { id: 'guild', label: 'Guilde', icon: '🛡', title: 'Votre guilde' },
  { id: 'more', label: 'Plus', icon: '⋯', title: 'Plus' },
];

type PickerTab = 'campaigns' | 'single' | 'sandbox';
const PICKER_TABS: { id: PickerTab; label: string }[] = [
  { id: 'campaigns', label: 'Campagnes' },
  { id: 'single', label: 'Scénarios uniques' },
  { id: 'sandbox', label: 'Terrain d’essai' },
];

/** Choix d'un scénario de l'univers original, de ses héros, puis briefing narratif avant de jouer : aucune mise en place manuelle. */
export function ScenarioPicker({ onStart }: { onStart: () => void }) {
  const setDefs = useGameStore((s) => s.setMonsterDefinitions);
  const newGame = useGameStore((s) => s.newGame);
  const [def, setDef] = useState<ScenarioDefinition | null>(null);
  // Emplacement sous le bouton Accueil, dans l'en-tête de l'application (absent hors de l'application : le bouton reste alors en place).
  const [headerSlot] = useState<HTMLElement | null>(() => (typeof document === 'undefined' ? null : document.getElementById('aq-header-slot')));
  const [tab, setTab] = useState<PickerTab>('campaigns');
  const portrait = usePortrait();
  const [drawer, setDrawer] = useState<BriefingTab | null>(null);
  // La guilde : 3 héros, nom et points de vie, gardés d'une partie à l'autre.
  const guild = useGuildStore((s) => s.heroes);
  const setHeroName = useGuildStore((s) => s.setName);
  const setHeroLife = useGuildStore((s) => s.setLife);
  const setHeroStealth = useGuildStore((s) => s.setStealth);
  const loadGuild = useGuildStore((s) => s.load);
  const guildLoaded = useGuildStore((s) => s.loaded);
  useEffect(() => {
    if (!guildLoaded) void loadGuild();
  }, [guildLoaded, loadGuild]);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tileCount, setTileCount] = useState(4);
  const [level, setLevel] = useState<GeneratedLevel>('1');

  /** Mode aléatoire : on donne le nombre de tuiles du terrain, un scénario est généré au hasard. */
  const generate = (count: number, monsterLevel: GeneratedLevel) => {
    try {
      const next = generateScenario({ tileCount: count, seed: Math.floor(Math.random() * 2 ** 31), level: monsterLevel }, ORIGINAL_CONTENT);
      setError(null);
      setDef(next);
      setDifficulty(next.recommended);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (!def) {
    const play = (s: ScenarioDefinition) => {
      setDef(s);
      setDifficulty(s.recommended);
    };
    const card = (s: ScenarioDefinition) => (
      <li key={s.id} className="rounded-xl border border-stone-700 bg-stone-800/90 p-4">
        <h3 className="text-xl font-semibold text-amber-300">
          {s.sandbox && <span aria-hidden="true">🧪 </span>}
          {s.title}
        </h3>
        <p className="mt-1 text-stone-300">{s.tagline}</p>
        <p className="mt-2 text-sm text-stone-400">
          {s.difficulties ? `One shot · difficulté au choix (conseillée : ${DIFFICULTY_LABEL[s.recommended]})` : `Difficulté conseillée : ${DIFFICULTY_LABEL[s.recommended]}`}
        </p>
        <Button className="mt-3" variant="primary" aria-label={`Voir le briefing : ${s.title}`} onClick={() => play(s)}>
          Voir le briefing
        </Button>
      </li>
    );
    return (
      <Panel title="Choisir un scénario">
        <ErrorBanner message={error} onClose={() => setError(null)} />
        <div role="tablist" aria-label="Type de scénario" className="mb-3 flex flex-wrap gap-2">
          {PICKER_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`picker-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="picker-panel"
              onClick={() => setTab(t.id)}
              className={`min-h-11 rounded-xl border-2 px-4 text-base font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${tab === t.id ? 'border-amber-400 bg-amber-700 text-white' : 'border-stone-600 bg-stone-900 text-stone-100 hover:bg-stone-800'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id="picker-panel" aria-labelledby={`picker-tab-${tab}`} className="space-y-3">
          {tab === 'campaigns' && (
            <>
              <CampaignCard onPlay={play} />
              <MediumCampaignCard onPlay={play} />
              <RandomCampaignCard onPlay={play} />
            </>
          )}
          {tab === 'single' && (
            <ul className="grid gap-3 md:grid-cols-2">
              {ORIGINAL_SCENARIOS.filter((s) => !s.sandbox && !CHAPTER_IDS.slice(1).includes(s.id) && !MEDIUM_IDS.slice(1).includes(s.id)).map(card)}
          <li className="rounded-xl border border-amber-700 bg-stone-800 p-4" data-testid="random-mode">
            <h3 className="text-xl font-semibold text-amber-300">
              <span aria-hidden="true">🎲 </span>Scénario aléatoire
            </h3>
            <p className="mt-1 text-stone-300">Choisissez le nombre de tuiles du terrain et le niveau des monstres : un scénario est généré au hasard (tuiles, portes, monstres, quêtes).</p>
            <label className="mt-3 flex items-center gap-3">
              Nombre de tuiles
              <input
                type="number"
                aria-label="Nombre de tuiles"
                min={MIN_GENERATED_TILES}
                max={MAX_GENERATED_TILES}
                value={tileCount}
                onChange={(e) => setTileCount(Math.max(MIN_GENERATED_TILES, Math.min(MAX_GENERATED_TILES, Math.round(Number(e.target.value)) || MIN_GENERATED_TILES)))}
                className="min-h-11 w-20 rounded-lg border border-stone-600 bg-stone-900 px-3 text-center text-lg"
              />
              <span className="text-sm text-stone-400">de {MIN_GENERATED_TILES} à {MAX_GENERATED_TILES}</span>
            </label>
            <div role="group" aria-label="Niveau des monstres" className="mt-3 flex flex-wrap items-center gap-2">
              <span>Niveau des monstres</span>
              {GENERATED_LEVELS.map((l) => (
                <Button key={l} variant={level === l ? 'primary' : 'secondary'} aria-pressed={level === l} aria-label={`Niveau ${l}`} onClick={() => setLevel(l)}>
                  {l}
                </Button>
              ))}
            </div>
            <Button className="mt-3" variant="primary" onClick={() => generate(tileCount, level)}>
              Générer un scénario
            </Button>
          </li>
            </ul>
          )}
          {tab === 'sandbox' && <ul className="grid gap-3 md:grid-cols-2">{ORIGINAL_SCENARIOS.filter((s) => s.sandbox).map(card)}</ul>}
        </div>
      </Panel>
    );
  }

  const heroes = guildToTemplates(guild);
  const guildIssues = guildProblems(guild);

  // La difficulté choisie : pour un one shot, elle décide du niveau des monstres et de leurs renforts (aperçu, départ et récit suivent).
  const chosen = difficulty ?? def.recommended;
  const played = resolveDifficulty(def, chosen);

  const start = () => {
    try {
      const config = scenarioToSetup(def, { sessionId: `s-${Date.now()}`, difficulty: chosen, seed: Date.now() % 2147483647, heroes }, ORIGINAL_CONTENT);
      setDefs(Object.values(ORIGINAL_CONTENT.monsters));
      newGame(config, played.script ?? []);
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

  const backButton = (
    <Button variant="ghost" onClick={() => setDef(null)}>
      ← Autres scénarios
    </Button>
  );

  const storySection = (
    <section aria-label="Récit" className="space-y-2 text-[15px] leading-snug">
      {def.story.intro.map((p, i) => (
        <p key={i} className={i === 0 ? 'italic text-amber-100' : 'text-stone-200'}>
          {p}
        </p>
      ))}
    </section>
  );
  const objectivesSection = (
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
  );
  const guildSection = (
    <section aria-label="Votre guilde">
      <h3 className="mb-1 text-sm font-semibold text-amber-300">Votre guilde ({GUILD_SIZE} héros)</h3>
      <ul className={portrait ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-3 gap-2'}>
        {guild.map((h, i) => (
          <li key={i} className="space-y-2 rounded-xl border-2 border-stone-700 bg-stone-800 p-2" data-testid={`guild-hero-${i + 1}`}>
            <label className="flex items-center gap-2">
              <MiniPawn kind="hero" label={(h.name.trim() || '?').slice(0, 2).toUpperCase()} size={34} />
              <input
                aria-label={`Nom du héros ${i + 1}`}
                value={h.name}
                maxLength={24}
                onChange={(e) => setHeroName(i, e.target.value)}
                className="min-h-11 w-full min-w-0 rounded-lg border border-stone-600 bg-stone-900 px-2 text-base font-semibold"
              />
            </label>
            <Stepper label={`Points de vie du héros ${i + 1}`} value={h.life} min={MIN_HERO_LIFE} max={MAX_HERO_LIFE} onChange={(n) => setHeroLife(i, n)} />
            <p className="text-sm" aria-hidden="true">{'❤'.repeat(Math.max(0, h.life))}</p>
            <label className="flex items-center gap-2 text-sm text-stone-200" title="Pouvoir passif : ce héros se déplace sans déclencher les attaques de réaction (Guard) des monstres">
              <input type="checkbox" aria-label={`Furtivité du héros ${i + 1}`} checked={!!h.stealth} onChange={(e) => setHeroStealth(i, e.target.checked)} />
              🥷 Furtivité
            </label>
          </li>
        ))}
      </ul>
      {guildIssues.length > 0 ? (
        <p role="alert" className="mt-1 text-sm text-red-300">{guildIssues[0]}</p>
      ) : (
        <p className="mt-1 text-xs text-stone-400">Nom et points de vie seulement : cartes, dés de défense et armes se gèrent en physique avec vos figurines.</p>
      )}
    </section>
  );
  const titleBlock = (
    <div>
      <h2 className="text-2xl font-semibold text-amber-300">{def.title}</h2>
      <p className="text-sm text-stone-300">{def.tagline}</p>
    </div>
  );
  const moreSection = (
    <div className="flex flex-wrap items-center gap-2">
      {def.tiles && <TilesButton board={boardOf(def).board} layout={def.tiles} />}
      {def.generated && !isCampaignChapter(def.id) && (
        <Button variant="secondary" onClick={() => { setDrawer(null); generate(def.tiles?.placements.length ?? tileCount, (GENERATED_LEVELS.find((l) => l === def.monsterCardSet) ?? '1')); }}>
          ↻ Autre tirage
        </Button>
      )}
      <Button variant="ghost" onClick={() => setDef(null)}>
        ← Autres scénarios
      </Button>
    </div>
  );

  // Deux colonnes : à gauche récit, objectifs, difficulté et lancement ; la guilde ; à droite le plan. La page défile sous la bannière.
  return (
    <div data-testid="briefing-page" className={portrait ? 'flex w-full flex-col gap-2 pb-20' : 'relative left-1/2 flex w-[96vw] -translate-x-1/2 flex-col gap-2'}>
      <ErrorBanner message={error} onClose={() => setError(null)} />
      {/* « Autres scénarios » se range sous le bouton Accueil. */}
      {!portrait && (headerSlot ? createPortal(backButton, headerSlot) : backButton)}
      {!portrait && (def.tiles || (def.generated && !isCampaignChapter(def.id))) && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {def.tiles && <TilesButton board={boardOf(def).board} layout={def.tiles} />}
          {def.generated && !isCampaignChapter(def.id) && (
            <Button variant="secondary" onClick={() => generate(def.tiles?.placements.length ?? tileCount, (GENERATED_LEVELS.find((l) => l === def.monsterCardSet) ?? '1'))}>
              ↻ Autre tirage
            </Button>
          )}
        </div>
      )}

      {portrait && titleBlock}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(18rem,2fr)_3fr]">
        <div className={`flex w-full max-w-xl flex-col gap-3 lg:justify-self-end ${portrait ? 'order-2' : ''}`}>
          {!portrait && titleBlock}

          {!portrait && storySection}
          {!portrait && objectivesSection}

          {def.difficulties && (
            <p data-testid="difficulty-summary" className="text-sm text-amber-200">
              Niveau des monstres : {DIFFICULTY_LEVEL[chosen]} · {played.monsters.length} monstre{played.monsters.length > 1 ? 's' : ''} au départ
            </p>
          )}

          <footer className="flex flex-wrap items-center gap-3">
            <div role="radiogroup" aria-label="Difficulté" className="flex items-center gap-1.5">
              {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={chosen === d}
                  aria-label={DIFFICULTY_LABEL[d]}
                  title={DIFFICULTY_LABEL[d]}
                  onClick={() => setDifficulty(d)}
                  className={`flex min-h-11 min-w-11 flex-col items-center justify-center rounded-lg border-2 px-1 text-xl leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${chosen === d ? 'border-amber-400 bg-amber-900/60' : 'border-stone-600 bg-stone-800 opacity-70'}`}
                >
                  <span aria-hidden="true">{DIFFICULTY_ICON[d]}</span>
                </button>
              ))}
            </div>
            <Button variant="primary" className="flex-1" disabled={guildIssues.length > 0} onClick={start}>
              Commencer l’aventure
            </Button>
          </footer>

          {!portrait && guildSection}
        </div>

        <div className={`flex flex-col gap-3 ${portrait ? 'order-1' : ''}`}>
          {/* Plan entier visible : le SVG garde son ratio et se réduit pour tenir dans la hauteur disponible sous la bannière. */}
          <div className="w-full [&_svg]:max-h-[calc(100dvh-var(--aq-banner,0px)-2rem)]">
            <ScenarioPreview def={played} heroes={heroes} />
          </div>
        </div>
      </div>
      {portrait && (
        <>
          <TabDock label="Navigation du briefing" tabs={BRIEFING_TABS} open={drawer} onOpen={setDrawer} />
          {drawer && (
            <Drawer title={BRIEFING_TABS.find((t) => t.id === drawer)!.title} onClose={() => setDrawer(null)}>
              {drawer === 'story' && storySection}
              {drawer === 'objectives' && objectivesSection}
              {drawer === 'guild' && guildSection}
              {drawer === 'more' && moreSection}
            </Drawer>
          )}
        </>
      )}
    </div>
  );
}

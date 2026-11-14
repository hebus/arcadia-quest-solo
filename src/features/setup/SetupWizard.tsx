import { useEffect, useState } from 'react';
import { Badge, Button, ErrorBanner, Panel, inputClass } from '@/components/ui';
import type { Difficulty, MonsterDefinition, MonsterStats, SpawnPoint } from '@/engine/domain/schemas';
import type { DeckRules, SetupConfig } from '@/engine/setup';
import { boardFromLayout, type BoardExtras, type TileLayout } from '@/engine/tiles';
import { allScenarios } from '@/game-data/scenarios/catalog';
import { useGameStore } from '@/stores/gameStore';
import { useTileStore } from '@/stores/tileStore';
import { BoardSetup, slug, type DefRow, type HeroRow, type InstRow } from './BoardSetup';
import { tilePlacementProblems } from '@/engine/tileCatalog';
import { BLANK_TILE, BUILTIN_TILES, DEMO_HOUSE_TILE } from './builtinTiles';

const STEPS = ['Scénario', 'Héros et monstres', 'Plateau', 'Quêtes et deck', 'Vérification'];

/** Un plateau complet utilise en général 3×3 tuiles de 3×3 cases. */
const DEFAULT_LAYOUT: TileLayout = { tilesW: 3, tilesH: 3, placements: [] };
const NO_EXTRAS: Required<BoardExtras> = { walls: [], doors: [], portals: [], doorStates: {} };

const DEMO = {
  heroes: [
    { name: 'Grom', life: 4, defense: 0, rerolls: 0, pos: { x: 1, y: 8 } },
    { name: 'Maya', life: 3, defense: 0, rerolls: 0, pos: { x: 2, y: 8 } },
    { name: 'Zazu', life: 3, defense: 0, rerolls: 0, pos: { x: 1, y: 7 } },
  ] as HeroRow[],
  defs: [
    { name: 'Goblin', tier: 1, life: 2, overkill: 4, reward: 1, type: 'melee', atk: 2, mv: 2 },
    { name: 'Orc', tier: 2, life: 3, overkill: 6, reward: 2, type: 'melee', atk: 3, mv: 2 },
  ] as DefRow[],
  insts: [
    { def: 'goblin', pos: { x: 6, y: 5 }, guard: false },
    { def: 'orc', pos: { x: 7, y: 3 }, guard: false },
    { def: 'orc', pos: { x: 8, y: 0 }, guard: true },
  ] as InstRow[],
  layout: {
    tilesW: 3,
    tilesH: 3,
    placements: Array.from({ length: 9 }, (_, i) => ({ tileId: i === 4 ? DEMO_HOUSE_TILE.id : BLANK_TILE.id, tx: i % 3, ty: Math.floor(i / 3), rotation: 0 as const })),
  } as TileLayout,
  extras: {
    walls: [],
    doors: [],
    portals: [],
    doorStates: {},
  } as Required<BoardExtras>,
  spawns: [
    { id: 'S1', at: { x: 0, y: 0 }, dice: ['sword', 'bow'] },
    { id: 'S2', at: { x: 8, y: 8 }, dice: ['bow', 'bow'] },
  ] as SpawnPoint[],
  quests: "Tuer l'Orc garde\nAtteindre la porte",
};

export function SetupWizard({ onDone, openLibrary }: { onDone: () => void; openLibrary?: () => void }) {
  const store = useGameStore();
  const { tiles, loaded, load } = useTileStore();
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const [step, setStep] = useState(0);
  const [scenarioId, setScenarioId] = useState('custom');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [cardSet, setCardSet] = useState('1');
  const [heroes, setHeroes] = useState<HeroRow[]>([0, 1, 2].map((i) => ({ name: `Héros ${i + 1}`, life: 3, defense: 0, rerolls: 0, pos: null })));
  const [defs, setDefs] = useState<DefRow[]>([]);
  const [insts, setInsts] = useState<InstRow[]>([]);
  const [layout, setLayout] = useState<TileLayout>(DEFAULT_LAYOUT);
  const [extras, setExtras] = useState<Required<BoardExtras>>(NO_EXTRAS);
  const [spawns, setSpawns] = useState<SpawnPoint[]>([]);
  const [quests, setQuests] = useState('Quête 1');
  const [required, setRequired] = useState(1);
  const [excluded, setExcluded] = useState('');
  const [limited, setLimited] = useState('');
  const [delayed, setDelayed] = useState('');
  const [wild, setWild] = useState(0);
  const [dice, setDice] = useState<'digital' | 'physical'>('digital');
  const [cards, setCards] = useState<'digital' | 'physical'>('digital');
  const [defenseRoll, setDefenseRoll] = useState<'digital' | 'physical'>('physical');
  const [error, setError] = useState<string | null>(null);

  const scenario = allScenarios.find((s) => s.id === scenarioId);
  const defRefs = defs.map((d) => ({ id: slug(d.name), name: d.name }));

  const pickScenario = (id: string) => {
    setScenarioId(id);
    const s = allScenarios.find((x) => x.id === id);
    if (!s) return;
    setExcluded(s.excludedCards.map(slug).join(', '));
    setLimited(Object.entries(s.limitedCards).map(([k, v]) => `${slug(k)}=${v}`).join(', '));
    setDelayed(s.delayedCards.map(slug).join(', '));
    setWild(s.wildPets);
  };

  const loadDemo = () => {
    setScenarioId('custom');
    setHeroes(DEMO.heroes);
    setDefs(DEMO.defs);
    setInsts(DEMO.insts);
    setLayout(DEMO.layout);
    setExtras(DEMO.extras);
    setSpawns(DEMO.spawns);
    setQuests(DEMO.quests);
    setRequired(2);
    setExcluded('');
    setLimited('');
    setDelayed('');
    setWild(0);
  };

  const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
  const num = (v: string) => Number(v);

  const build = () => {
    const tileMap = Object.fromEntries([...BUILTIN_TILES, ...tiles].map((t) => [t.id, t]));
    if (layout.placements.length === 0) throw new Error('Posez au moins une tuile (étape Plateau).');
    // Seules 9 tuiles doubles faces existent (A à I) : chacune une seule fois, sur une seule face.
    const tileCheck = tilePlacementProblems(layout.placements.map((p) => p.tileId));
    if (tileCheck.errors.length) throw new Error(tileCheck.errors.join(' '));
    const board = boardFromLayout(tileMap, layout, extras);
    const notPlaced = heroes.filter((h) => !h.pos).map((h) => h.name);
    if (notPlaced.length) throw new Error(`Placez les héros sur le plateau : ${notPlaced.join(', ')}.`);
    if (spawns.length === 0) throw new Error('Ajoutez au moins un jeton Spawn (outil « Jeton Spawn »).');
    const warnings: string[] = [];
    if (tileCheck.notInGame.length) {
      warnings.push(`Tuiles de test hors du jeu de base (${tileCheck.notInGame.map((id) => tileMap[id]?.name ?? id).join(', ')}) : ce plateau n'est pas réalisable avec le matériel, seules les 9 tuiles A à I (double face) existent.`);
    }
    const monsterDefs: MonsterDefinition[] = defs.map((d) => {
      const s: MonsterStats = { life: d.life, overkill: d.overkill, reward: d.reward, attackType: d.type, attackDice: d.atk, movement: d.mv };
      // Seules les stats du niveau courant servent à l'activation ; 3 autres niveaux alimentent le deck (solo v1.3 p.1).
      return { id: slug(d.name), name: d.name, tier: d.tier, levels: { [cardSet]: s, 'autre-1': s, 'autre-2': s, 'autre-3': s } };
    });
    const ids = new Set(monsterDefs.map((d) => d.id));
    const limitedMap = Object.fromEntries(list(limited).map((e) => e.split('=')).map(([k, v]) => [k!.trim(), Number(v)]));
    for (const id of [...list(excluded), ...list(delayed), ...Object.keys(limitedMap)]) {
      if (!ids.has(id)) warnings.push(`Règle de deck ignorée : « ${id} » n'est pas un monstre défini.`);
    }
    const rules: DeckRules = {
      wildPetCards: wild,
      excluded: list(excluded).filter((x) => ids.has(x)),
      delayed: list(delayed).filter((x) => ids.has(x)),
      limited: Object.fromEntries(Object.entries(limitedMap).filter(([k]) => ids.has(k))),
    };
    const counters: Record<string, number> = {};
    const config: SetupConfig = {
      sessionId: `s-${Date.now()}`,
      scenarioId,
      difficulty,
      monsterCardSet: cardSet,
      board,
      tileLayout: layout,
      spawnPoints: spawns,
      heroes: heroes.map((h, i) => ({ id: `h${i + 1}`, name: h.name, life: h.life, defense: h.defense, rerolls: h.rerolls, position: h.pos! })),
      monsters: insts.map((m) => {
        counters[m.def] = (counters[m.def] ?? 0) + 1;
        return { id: `${m.def}${counters[m.def]}`, definitionId: m.def, position: m.pos, isGuard: m.guard };
      }),
      deck: rules,
      quests: list(quests.replace(/\n/g, ',')).map((t, i) => ({ id: `q${i + 1}`, title: t })),
      questsRequired: required,
      settings: { diceMode: dice, cardMode: cards, defenseRoll },
      seed: Math.floor(Math.random() * 2 ** 31),
    };
    if (scenario?.status === 'to-verify') warnings.push("Ce scénario n'est pas vérifié : comparez chaque élément au Campaign Book.");
    return { config, defs: monsterDefs, warnings };
  };

  const [preview, setPreview] = useState<ReturnType<typeof build> | null>(null);
  const verify = () => {
    try {
      setPreview(build());
      setError(null);
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const launch = () => {
    if (!preview) return;
    store.setMonsterDefinitions(preview.defs);
    store.newGame(preview.config);
    if (useGameStore.getState().game) onDone();
  };

  const setHero = (i: number, patch: Partial<HeroRow>) => setHeroes(heroes.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  const setDef = (i: number, patch: Partial<DefRow>) => setDefs(defs.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  return (
    <div className="space-y-3">
      <ErrorBanner message={error ?? store.error} onClose={() => { setError(null); store.clearError(); }} />
      <nav aria-label="Étapes" className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <Button key={s} variant={i === step ? 'primary' : 'ghost'} onClick={() => setStep(i)}>
            {i + 1}. {s}
          </Button>
        ))}
        <Button onClick={loadDemo}>Charger la démo</Button>
      </nav>

      {step === 0 && (
        <Panel title="Scénario et difficulté">
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              Scénario du livret solo
              <select className={inputClass} value={scenarioId} onChange={(e) => pickScenario(e.target.value)}>
                <option value="custom">Scénario libre</option>
                {allScenarios.map((s) => (<option key={s.id} value={s.id}>[{s.family}] {s.name}</option>))}
              </select>
            </label>
            <label>
              Difficulté
              <select className={inputClass} value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
                <option value="legendary">Legendary (1 mort)</option>
                <option value="hard">Hard (2 morts)</option>
                <option value="medium">Medium (3 morts)</option>
                <option value="easy">Easy (4 morts)</option>
              </select>
            </label>
            <label>Jeu de cartes Monster (« 1 », « 2-3 »…)<input className={inputClass} value={cardSet} onChange={(e) => setCardSet(e.target.value)} /></label>
            <label>
              Dés d&apos;attaque et de spawn
              <select className={inputClass} value={dice} onChange={(e) => setDice(e.target.value as typeof dice)}>
                <option value="digital">numériques (l&apos;application tire)</option>
                <option value="physical">matériels (je saisis tous les résultats)</option>
              </select>
            </label>
            <label>
              Jet de défense de mes héros
              <select className={inputClass} value={defenseRoll} onChange={(e) => setDefenseRoll(e.target.value as typeof defenseRoll)}>
                <option value="physical">je lance les dés et je saisis les coups parés</option>
                <option value="digital">l&apos;application lance aussi la défense</option>
              </select>
            </label>
            <label>
              Cartes d&apos;activation
              <select className={inputClass} value={cards} onChange={(e) => setCards(e.target.value as typeof cards)}>
                <option value="digital">numériques (recommandé)</option>
                <option value="physical">matérielles (j&apos;annonce la carte)</option>
              </select>
            </label>
          </div>
          {scenario && (
            <div className="mt-3 space-y-1 text-sm">
              <Badge tone="warn">{scenario.status === 'verified' ? 'vérifié' : 'à vérifier'}</Badge>{' '}
              <span>{scenario.guards ? 'Des gardes sont à marquer (positions dans le Campaign Book). ' : ''}{scenario.wildPets ? `Pets : ${scenario.wildPets} carte(s) Wild Pet. ` : ''}</span>
              <ul className="list-disc pl-5">{scenario.notes.map((n) => (<li key={n}>{n}</li>))}</ul>
            </div>
          )}
        </Panel>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <Panel title="Les trois héros">
            {heroes.map((h, i) => (
              <div key={i} className="mb-2 grid grid-cols-4 gap-2 md:grid-cols-5">
                <input aria-label={`Nom du héros ${i + 1}`} className={`${inputClass} col-span-4 md:col-span-2`} value={h.name} onChange={(e) => setHero(i, { name: e.target.value })} />
                {(['life', 'defense', 'rerolls'] as const).map((k) => (
                  <input key={k} aria-label={`${k} du héros ${i + 1}`} title={k} className={inputClass} type="number" min={0} value={h[k]} onChange={(e) => setHero(i, { [k]: num(e.target.value) })} />
                ))}
              </div>
            ))}
            <p className="text-sm text-stone-400">Colonnes : nom, vie, défense (cartes comprises), relances. Leur position se choisit sur le plateau.</p>
          </Panel>
          <Panel title="Types de monstres" actions={<Button onClick={() => setDefs([...defs, { name: 'Nouveau', tier: 1, life: 2, overkill: 4, reward: 1, type: 'melee', atk: 2, mv: 2 }])}>+ Type</Button>}>
            <p className="mb-2 text-sm text-stone-400">Stats lues sur la carte Monster du niveau courant : nom, tier, vie, blessures pour le tuer sur le coup, pièces, type et dés d&apos;attaque, mouvement.</p>
            {defs.map((d, i) => (
              <div key={i} className="mb-2 grid grid-cols-5 gap-2 md:grid-cols-9">
                <input aria-label="Nom du monstre" className={`${inputClass} col-span-2`} value={d.name} onChange={(e) => setDef(i, { name: e.target.value })} />
                {(['tier', 'life', 'overkill', 'reward'] as const).map((k) => (
                  <input key={k} aria-label={k} title={k} className={inputClass} type="number" min={0} value={d[k]} onChange={(e) => setDef(i, { [k]: num(e.target.value) })} />
                ))}
                <select aria-label="Type d'attaque" className={inputClass} value={d.type} onChange={(e) => setDef(i, { type: e.target.value as 'melee' | 'ranged' })}>
                  <option value="melee">mêlée</option>
                  <option value="ranged">distance</option>
                </select>
                {(['atk', 'mv'] as const).map((k) => (
                  <input key={k} aria-label={k} title={k} className={inputClass} type="number" min={0} value={d[k]} onChange={(e) => setDef(i, { [k]: num(e.target.value) })} />
                ))}
              </div>
            ))}
            {defs.length === 0 && <p className="text-stone-400">Ajoutez un type par monstre du scénario (Goblin, Orc…). Les figurines se posent ensuite sur le plateau.</p>}
          </Panel>
        </div>
      )}

      {step === 2 && (
        <BoardSetup
          tilesLib={tiles}
          layout={layout}
          setLayout={setLayout}
          extras={extras}
          setExtras={setExtras}
          spawns={spawns}
          setSpawns={setSpawns}
          heroes={heroes}
          setHeroes={setHeroes}
          defs={defRefs}
          insts={insts}
          setInsts={setInsts}
          onOpenLibrary={openLibrary ?? (() => undefined)}
        />
      )}

      {step === 3 && (
        <Panel title="Quêtes PvE et deck d'activation">
          <div className="grid gap-3 md:grid-cols-2">
            <label>Quêtes (une par ligne)<textarea className={inputClass} rows={4} value={quests} onChange={(e) => setQuests(e.target.value)} /></label>
            <label>Quêtes à accomplir (toutes, ou 2 sur 3…)<input className={inputClass} type="number" min={1} value={required} onChange={(e) => setRequired(num(e.target.value))} /></label>
            <label>Cartes exclues (ids de monstres)<input className={inputClass} value={excluded} onChange={(e) => setExcluded(e.target.value)} /></label>
            <label>Cartes limitées (id=nombre)<input className={inputClass} value={limited} onChange={(e) => setLimited(e.target.value)} /></label>
            <label>Cartes retardées (ajoutées quand le monstre est placé)<input className={inputClass} value={delayed} onChange={(e) => setDelayed(e.target.value)} /></label>
            <label>Cartes Wild Pet (Pets)<input className={inputClass} type="number" min={0} value={wild} onChange={(e) => setWild(num(e.target.value))} /></label>
          </div>
        </Panel>
      )}

      {step === 4 && preview && (
        <Panel title="Vérification finale" actions={<Button variant="primary" onClick={launch}>Créer la partie</Button>}>
          <ul className="list-disc space-y-1 pl-5">
            <li>{preview.config.heroes.length} héros, {preview.config.monsters.length} figurine(s) ({preview.config.monsters.filter((m) => m.isGuard).length} garde(s))</li>
            <li>Plateau {preview.config.board.width}×{preview.config.board.height} cases ({layout.placements.length} tuile(s)), {preview.config.spawnPoints.length} jeton(s) Spawn, {preview.config.board.doors.length} porte(s), {preview.config.board.portals.length} portail(s), {preview.config.board.walls.length} mur(s)</li>
            <li>{preview.config.quests.length} quête(s), {preview.config.questsRequired} à accomplir</li>
            <li>À sortir de la boîte : cartes Monster niveau « {cardSet} » + deck d&apos;activation des autres niveaux (3 cartes par monstre), jetons Guild pour les gardes, jetons Spawn.</li>
          </ul>
          {preview.warnings.map((w) => (<p key={w} className="mt-2 text-amber-300">⚠ {w}</p>))}
        </Panel>
      )}

      <div className="flex justify-between">
        <Button disabled={step === 0} onClick={() => setStep(step - 1)}>Précédent</Button>
        {step < 3 ? (
          <Button variant="primary" onClick={() => setStep(step + 1)}>Suivant</Button>
        ) : step === 3 ? (
          <Button variant="primary" onClick={verify}>Vérifier</Button>
        ) : null}
      </div>
    </div>
  );
}

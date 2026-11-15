import { create } from 'zustand';
import { runMonsterTurnSafe, type PhysicalInstruction } from '@/engine/activation/monsterTurn';
import { resolveHeroAttack, type TargetOutcome } from '@/engine/combat/heroActions';
import { closeDoorAsHero, moveHeroTo, openDoorAsHero } from '@/engine/combat/heroMove';
import { applyCorrection, type Correction } from '@/engine/corrections';
import type { Content, DecisionTrace, DieFaceDef, GameState, Position, Settings } from '@/engine/domain/schemas';
import { NeedInput, type InputAnswer, type InputRequest } from '@/engine/oracle';
import { addMonster } from '@/engine/sandbox';
import { createGame, type SetupConfig } from '@/engine/setup';
import { completeQuest } from '@/engine/state';
import { activateHero, finishHeroActivations, restGuild, skipGuildTurn, startScenario } from '@/engine/turn/machine';
import { DEFAULT_ATTACK_DIE, DEFAULT_DEFENSE_DIE } from '@/game-data/dice';
import type { MonsterDefinition } from '@/engine/domain/schemas';
import { ORIGINAL_REWARDS, scenarioForGame } from '@/game-data/original';
import { runScript, type Rule, type StoryBeat } from '@/engine/scenario/script';
import { Repository } from '@/infrastructure/persistence/repository';

export type AgentStatus = 'ready' | 'awaiting-input' | 'blocked' | 'done';

export interface TrackedInstruction extends PhysicalInstruction {
  confirmed: boolean;
}

interface HistoryEntry {
  label: string;
  state: GameState;
}

/** Demande de pose d'une figurine sur le plateau : le joueur touche la case, sans saisir de coordonnées. */
export interface PlacingRequest {
  actorId: string;
  onPlace(to: Position): void;
}

/** Résumé compact de l'état, pour lire le journal d'actions sans rouvrir l'état complet. */
export interface StateBrief {
  phase: string;
  round: number;
  rngCounter: number;
  deaths: number;
  coins: number;
  questsDone: string[];
  activated: string[];
  heroTurn: GameState['heroTurn'];
  heroes: { id: string; at: Position | null; wounds: number; dead: boolean; stunned: boolean }[];
  monsters: { id: string; def: string; at: Position | null; wounds: number; status: string; guard: boolean }[];
  doors: { id: string; open: boolean }[];
}

/** Une action du joueur (ou de l'application), avec ses arguments et son effet : de quoi la rejouer et comprendre l'écart. */
export interface ActionLogEntry {
  n: number;
  /** Profondeur d'appel : une action peut en déclencher d'autres (fin de tour → lancement du tour des monstres). */
  depth: number;
  at: string;
  action: string;
  args: unknown[];
  error?: string;
  /** Saisie physique attendue après l'action (jet de dés, choix…). */
  awaiting?: InputRequest;
  /** Étapes physiques encore à valider après l'action. */
  pendingSteps: number;
  after: StateBrief | null;
}

/** Argument d'une action, sous forme JSON ; un événement du navigateur (clic sur un bouton relié directement) n'est pas un argument. */
const plainArg = (a: unknown): unknown => {
  if (typeof Event !== 'undefined' && a instanceof Event) return null;
  try {
    return JSON.parse(JSON.stringify(a ?? null)) as unknown;
  } catch {
    return null;
  }
};

export const briefOf = (g: GameState): StateBrief => ({
  phase: g.phase,
  round: g.round,
  rngCounter: g.rngCounter,
  deaths: g.deaths,
  coins: g.coins,
  questsDone: g.quests.filter((q) => q.done).map((q) => q.id),
  activated: [...g.activatedHeroIds],
  heroTurn: structuredClone(g.heroTurn),
  heroes: g.heroes.map((h) => ({ id: h.id, at: h.position ? { ...h.position } : null, wounds: h.wounds, dead: h.dead, stunned: !!h.stunned })),
  monsters: g.monsters.map((m) => ({ id: m.id, def: m.definitionId, at: m.position ? { ...m.position } : null, wounds: m.wounds, status: m.status, guard: !!m.isGuard })),
  doors: g.board.doors.map((d) => ({ id: d.id, open: d.open })),
});

export interface GameStore {
  game: GameState | null;
  /** Journal détaillé des actions depuis le début de la partie (exportable depuis le terrain d'essai). */
  actionLog: ActionLogEntry[];
  /** État au début du journal : point de départ pour rejouer les actions. */
  logStart: GameState | null;
  content: Content;
  history: HistoryEntry[];
  agent: { status: AgentStatus; request?: InputRequest; error?: string };
  /** Saisies physiques accumulées pour la transaction en cours. */
  answers: InputAnswer[];
  instructions: TrackedInstruction[];
  traces: DecisionTrace[];
  error: string | null;

  setMonsterDefinitions(defs: MonsterDefinition[]): void;
  /** Script du scénario en cours (maître de jeu) et moments de récit en attente d'être lus. */
  script: Rule[];
  beats: StoryBeat[];
  dismissBeat(): void;
  /** Annonce d'attaque déjà vue (clé de la saisie) : le dialogue de dés peut alors s'ouvrir. */
  ackedRequestKey: string | null;
  ackRequest(key: string): void;
  /** Oublie la partie en mémoire (après l'effacement des sauvegardes). */
  reset(): void;
  /** Configuration de départ de la partie en cours : permet de revenir à la disposition initiale (terrain d'essai). */
  startConfig: SetupConfig | null;
  newGame(config: SetupConfig, script?: Rule[]): void;
  /** Terrain d'essai. */
  restart(): void;
  sandboxAddMonster(definitionId: string): void;
  skipToMonsters(): void;
  loadGame(state: GameState): void;
  begin(): void;
  activateHero(heroId: string): void;
  finishActivations(): void;
  rest(resurrectAt?: Record<string, Position>): void;
  startMonsterTurn(): void;
  /** Fin de tour des héros : passe la main aux monstres et lance leur tour. */
  endTurn(): void;
  provideAnswer(a: InputAnswer): void;
  abortMonsterTurn(): void;
  confirmInstruction(id: string): void;
  confirmAll(): void;
  /** Figurine à poser : le plateau attend un tap sur la case. */
  placing: PlacingRequest | null;
  startPlacing(req: PlacingRequest): void;
  cancelPlacing(): void;
  /** Mode correction : tous les pions se glissent pour recaler le miroir sur la table. */
  correctionMode: boolean;
  setCorrectionMode(on: boolean): void;
  /** Héros ou monstre sélectionné sur le plateau. */
  selectedId: string | null;
  select(id: string | null): void;
  moveHero(heroId: string, to: Position): void;
  /** Ouvre une porte au bord de la case du héros : 1 point de mouvement, pas une action. */
  openDoor(heroId: string, doorId: string): void;
  /** Ferme une porte ouverte au bord de la case du héros : 1 point de mouvement, pas une action. */
  closeDoor(heroId: string, doorId: string): void;
  attackHero(heroId: string, targets: TargetOutcome[], attackType: 'melee' | 'ranged', weaponId?: string): void;
  /** Repos : retire les jetons des cartes ; chaque héros mort est reposé en touchant sa case sur le plateau. */
  restWithPlacement(): void;
  completeQuest(questId: string): void;
  correct(c: Correction): void;
  undo(): void;
  clearError(): void;
  setSettings(patch: Partial<Settings>): void;
  setDice(attackDie: DieFaceDef[], defenseDie: DieFaceDef[]): void;
}

export const defaultContent = (monsters: Record<string, MonsterDefinition> = {}): Content => ({
  version: 'user-1',
  monsters,
  attackDie: DEFAULT_ATTACK_DIE,
  defenseDie: DEFAULT_DEFENSE_DIE,
  rewards: ORIGINAL_REWARDS,
});

let repository: Repository | null = null;
export const setRepository = (r: Repository | null): void => {
  repository = r;
};

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const HISTORY_LIMIT = 100;

export const useGameStore = create<GameStore>()((set, get) => {
  const track = (ins: PhysicalInstruction[]): TrackedInstruction[] => ins.map((i) => ({ ...i, confirmed: false }));
  /** Applique une transaction : snapshot avant, nouvel état après, sauvegarde automatique. */
  const commit = (label: string, next: GameState, extra: Partial<GameStore> = {}) => {
    const prev = get().game;
    // Le maître de jeu réagit à chaque transaction : récit, quêtes validées, renforts, portes.
    const scripted = runScript(next, get().script, get().content.rewards, get().content.monsters);
    const final = scripted.state;
    set((s) => ({
      game: final,
      history: prev ? [...s.history, { label, state: prev }].slice(-HISTORY_LIMIT) : s.history,
      error: null,
      ackedRequestKey: null,
      ...extra,
      ...(scripted.beats.length || scripted.instructions.length
        ? { beats: [...s.beats, ...scripted.beats], instructions: [...(extra.instructions ?? s.instructions), ...track(scripted.instructions)] }
        : {}),
    }));
    void repository?.saveSession(final).catch(() => undefined);
  };
  const attempt = <T>(fn: () => T): T | undefined => {
    try {
      return fn();
    } catch (e) {
      set({ error: errMsg(e) });
      return undefined;
    }
  };
  /** Fusionne la liste d'étapes recalculée avec celle déjà affichée : ce qui a été confirmé le reste (calcul rejoué à chaque saisie). */
  const merge = (prev: TrackedInstruction[], next: PhysicalInstruction[]): TrackedInstruction[] => {
    const done = new Set(prev.filter((i) => i.confirmed).map((i) => i.id));
    return next.map((i) => ({ ...i, confirmed: done.has(i.id) }));
  };
  const pending = () => get().instructions.some((i) => !i.confirmed);
  /** Une saisie est en attente (attaque d'un monstre, dés…) : aucune autre action ne peut démarrer avant qu'elle soit terminée. */
  const busy = (): boolean => {
    if (get().agent.status !== 'awaiting-input') return false;
    set({ error: 'Une saisie est en cours : terminez-la avant d’agir.' });
    return true;
  };
  let resume: ((answers: InputAnswer[]) => void) | null = null;

  const runTurn = (answers: InputAnswer[]) => {
    const g = get().game!;
    const out = runMonsterTurnSafe(g, get().content, answers);
    if (out.status === 'awaiting-input') {
      // Les étapes déjà décidées (apparitions, déplacements…) s'affichent d'abord ; la saisie ne viendra qu'ensuite.
      set({ answers, agent: { status: 'awaiting-input', request: out.request }, instructions: merge(get().instructions, out.partial), traces: out.partialTraces, error: null });
    } else if (out.status === 'blocked') {
      set({ answers, agent: { status: 'blocked', error: out.error }, error: out.error });
    } else {
      commit('Monster Turn', out.state, {
        answers: [],
        agent: { status: 'done' },
        instructions: merge(get().instructions, out.instructions),
        traces: out.traces,
      });
    }
  };

  /** Action de héros avec réactions : reprise automatique après chaque saisie physique demandée. */
  const physical = (
    label: string,
    fn: (g: GameState, c: Content, a: InputAnswer[]) => { state: GameState; instructions: PhysicalInstruction[] },
    answers: InputAnswer[] = [],
  ) => {
    const g = get().game;
    if (!g) return;
    try {
      const r = fn(g, get().content, answers);
      resume = null;
      commit(label, r.state, {
        answers: [],
        agent: { status: 'ready' },
        instructions: [...get().instructions, ...track(r.instructions)],
      });
    } catch (e) {
      if (e instanceof NeedInput) {
        resume = (a) => physical(label, fn, a);
        set({ answers, agent: { status: 'awaiting-input', request: e.request }, error: null });
      } else {
        resume = null;
        set({ error: errMsg(e) });
      }
    }
  };

  let logSeq = 0;
  let depth = 0;
  /** Enveloppe une action du store : l'enregistre (arguments, erreur, résumé de l'état après) dans le journal. */
  const logged = <A extends unknown[]>(name: string, fn: (...a: A) => void) => (...args: A): void => {
    const entry: ActionLogEntry = { n: ++logSeq, depth, at: new Date().toISOString(), action: name, args: args.filter((a) => typeof a !== 'function').map(plainArg), pendingSteps: 0, after: null };
    set((st) => ({ actionLog: [...st.actionLog, entry] }));
    const errBefore = get().error;
    depth += 1;
    try {
      fn(...args);
    } catch (e) {
      entry.error = errMsg(e);
      throw e;
    } finally {
      depth -= 1;
      const st = get();
      if (st.error && st.error !== errBefore) entry.error = st.error;
      if (st.agent.status === 'awaiting-input' && st.agent.request) entry.awaiting = st.agent.request;
      entry.pendingSteps = st.instructions.filter((i) => !i.confirmed).length;
      entry.after = st.game ? briefOf(st.game) : null;
      set((cur) => ({ actionLog: [...cur.actionLog] }));
    }
  };

  const actions: Omit<GameStore, 'actionLog' | 'logStart'> & Partial<Pick<GameStore, 'actionLog' | 'logStart'>> = {
    game: null,
    content: defaultContent(),
    history: [],
    agent: { status: 'ready' },
    answers: [],
    instructions: [],
    traces: [],
    error: null,

    setMonsterDefinitions(defs) {
      set({ content: defaultContent(Object.fromEntries(defs.map((d) => [d.id, d]))) });
    },
    script: [],
    beats: [],
    startConfig: null,
    restart() {
      const c = get().startConfig;
      if (!c) return;
      get().newGame(c, get().script);
      get().begin(); // on repart directement au tour de guilde
    },
    sandboxAddMonster(definitionId) {
      if (!get().game || busy()) return;
      // Le joueur touche la case où poser le nouveau monstre ; la figurine n'existe pas encore : son type sert d'identité au pion.
      set({
        placing: {
          actorId: definitionId,
          onPlace: (to) => {
            const g = get().game;
            if (g) attempt(() => commit('Ajout de monstre', addMonster(g, get().content, definitionId, to)));
          },
        },
      });
    },
    skipToMonsters() {
      const g = get().game;
      if (!g) return;
      if (pending()) return set({ error: 'Terminez les étapes en cours avant de passer au tour des monstres.' });
      attempt(() => commit('Tour des monstres', skipGuildTurn(g), { agent: { status: 'ready' }, instructions: [], traces: [] }));
    },
    dismissBeat() {
      set((s) => ({ beats: s.beats.slice(1) }));
    },
    ackedRequestKey: null,
    ackRequest(key) {
      set({ ackedRequestKey: key });
    },
    reset() {
      resume = null;
      set({ game: null, script: [], beats: [], history: [], instructions: [], traces: [], answers: [], agent: { status: 'ready' }, selectedId: null, placing: null, correctionMode: false, error: null, actionLog: [], logStart: null });
    },
    newGame(config, script = []) {
      const g = attempt(() => createGame(config, get().content));
      if (!g) return;
      logSeq = 0;
      set({ game: g, startConfig: config, script, beats: [], history: [], instructions: [], traces: [], answers: [], agent: { status: 'ready' }, error: null, actionLog: [], logStart: structuredClone(g) });
      void repository?.saveSession(g).catch(() => undefined);
    },
    loadGame(state) {
      logSeq = 0;
      set({ game: state, script: scenarioForGame(state)?.script ?? [], beats: [], history: [], instructions: [], traces: [], answers: [], agent: { status: 'ready' }, error: null, actionLog: [], logStart: structuredClone(state) });
    },
    begin() {
      const g = get().game;
      if (g) attempt(() => commit('Début du scénario', startScenario(g)));
    },
    activateHero(heroId) {
      const g = get().game;
      if (g) attempt(() => commit('Activation de héros', activateHero(g, heroId)));
    },
    finishActivations() {
      const g = get().game;
      if (!g) return;
      if (pending()) return set({ error: 'Confirmez ou corrigez les actions physiques en attente avant de continuer.' });
      attempt(() => commit('Fin du tour de guilde', finishHeroActivations(g), { agent: { status: 'ready' }, instructions: [], traces: [] }));
    },
    rest(resurrectAt = {}) {
      const g = get().game;
      if (!g) return;
      if (pending()) return set({ error: 'Confirmez ou corrigez les actions physiques en attente avant de continuer.' });
      attempt(() => commit('Repos', restGuild(g, resurrectAt), { agent: { status: 'ready' }, instructions: [], traces: [] }));
    },
    startMonsterTurn() {
      if (!get().game) return;
      if (pending()) return set({ error: 'Confirmez ou corrigez les actions physiques en attente avant de continuer.' });
      runTurn([]);
    },
    endTurn() {
      get().finishActivations();
      const g = get().game;
      if (g?.phase === 'MONSTER_TURN_SPAWN' && !get().error) get().startMonsterTurn();
    },
    provideAnswer(a) {
      if (!get().game) return;
      if (resume) resume([...get().answers, a]);
      else runTurn([...get().answers, a]);
    },
    abortMonsterTurn() {
      resume = null;
      // Les étapes affichées pendant l'interruption n'ont jamais été validées par l'état : on les oublie.
      set({ answers: [], agent: { status: 'ready' }, instructions: [], error: null, ackedRequestKey: null });
    },
    confirmInstruction(id) {
      set((s) => ({ instructions: s.instructions.map((i) => (i.id === id ? { ...i, confirmed: true } : i)) }));
    },
    confirmAll() {
      set((s) => ({ instructions: s.instructions.map((i) => ({ ...i, confirmed: true })) }));
    },
    placing: null,
    startPlacing(req) {
      set({ placing: req });
    },
    cancelPlacing() {
      set({ placing: null });
    },
    correctionMode: false,
    setCorrectionMode(on) {
      set({ correctionMode: on });
    },
    selectedId: null,
    select(id) {
      set({ selectedId: id });
    },
    moveHero(heroId, to) {
      if (busy()) return;
      physical('Déplacement de héros', (g, c, a) => moveHeroTo(g, c, heroId, to, a));
    },
    openDoor(heroId, doorId) {
      if (busy()) return;
      physical('Ouverture de porte', (g, c) => openDoorAsHero(g, c, heroId, doorId));
    },
    closeDoor(heroId, doorId) {
      if (busy()) return;
      physical('Fermeture de porte', (g, c) => closeDoorAsHero(g, c, heroId, doorId));
    },
    attackHero(heroId, targets, attackType, weaponId) {
      if (busy()) return;
      physical('Attaque de héros', (g, c, a) => resolveHeroAttack(g, c, heroId, targets, a, { attackType, ...(weaponId ? { weaponId } : {}) }));
    },
    restWithPlacement() {
      const g = get().game;
      if (!g) return;
      const next = (queue: string[], placed: Record<string, Position>): void => {
        const [id, ...rest] = queue;
        if (!id) return get().rest(placed);
        get().startPlacing({ actorId: id, onPlace: (to) => next(rest, { ...placed, [id]: to }) });
      };
      next(g.heroes.filter((h) => h.dead).map((h) => h.id), {});
    },
    completeQuest(questId) {
      const g = get().game;
      if (!g) return;
      attempt(() => {
        const next = structuredClone(g);
        completeQuest(next, questId);
        commit('Quête accomplie', next);
      });
    },
    correct(c) {
      const g = get().game;
      if (g) attempt(() => commit('Correction', applyCorrection(g, c)));
    },
    undo() {
      const h = get().history;
      const last = h[h.length - 1];
      if (!last) return;
      set({ game: last.state, ackedRequestKey: null, beats: [], history: h.slice(0, -1), instructions: [], traces: [], answers: [], agent: { status: 'ready' }, error: null });
      void repository?.saveSession(last.state).catch(() => undefined);
    },
    clearError() {
      set({ error: null });
    },
    setSettings(patch) {
      const g = get().game;
      if (!g) return;
      const next = { ...g, settings: { ...g.settings, ...patch } };
      set({ game: next });
      void repository?.saveSession(next).catch(() => undefined);
    },
    setDice(attackDie, defenseDie) {
      set((s) => ({ content: { ...s.content, attackDie, defenseDie } }));
    },
  };

  // Chaque geste est journalisé (arguments, effet, erreur) : le terrain d'essai exporte ce journal pour analyser un défaut.
  const LOGGED = ['begin', 'activateHero', 'finishActivations', 'rest', 'startMonsterTurn', 'endTurn', 'provideAnswer', 'abortMonsterTurn', 'confirmInstruction', 'confirmAll', 'moveHero', 'openDoor', 'closeDoor', 'attackHero', 'skipToMonsters', 'completeQuest', 'correct', 'undo', 'setSettings', 'setDice', 'setCorrectionMode', 'restart'] as const;
  const out = actions as unknown as Record<string, (...a: unknown[]) => void>;
  for (const name of LOGGED) out[name] = logged(name, out[name] as (...a: unknown[]) => void);
  return { ...(actions as GameStore), actionLog: [], logStart: null };
});

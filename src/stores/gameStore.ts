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
import { scenarioById } from '@/game-data/original';
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

export interface GameStore {
  game: GameState | null;
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
    const scripted = runScript(next, get().script);
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

  return {
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
      set({ game: null, script: [], beats: [], history: [], instructions: [], traces: [], answers: [], agent: { status: 'ready' }, selectedId: null, placing: null, correctionMode: false, error: null });
    },
    newGame(config, script = []) {
      const g = attempt(() => createGame(config, get().content));
      if (!g) return;
      set({ game: g, startConfig: config, script, beats: [], history: [], instructions: [], traces: [], answers: [], agent: { status: 'ready' }, error: null });
      void repository?.saveSession(g).catch(() => undefined);
    },
    loadGame(state) {
      set({ game: state, script: scenarioById(state.scenarioId)?.script ?? [], beats: [], history: [], instructions: [], traces: [], answers: [], agent: { status: 'ready' }, error: null });
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
});

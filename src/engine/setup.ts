import { boxProblems } from './figurines';
import { MONSTER_LEVELS, monsterStats } from './monsters';
import { safeParse } from './domain/validate';
import {
  GameStateSchema,
  SCHEMA_VERSION,
  type ActivationCard,
  type Board,
  type Content,
  type Difficulty,
  type Expansion,
  type GameState,
  type Hero,
  type Position,
  type TileLayout,
  type Settings,
  type SpawnPoint,
} from './domain/schemas';
import { CELL_CAPACITY } from './movement/board';
import { CountingRandom, shuffle } from './random';

export interface HeroInit {
  id: string;
  name: string;
  life: number;
  defense: number;
  rerolls?: number;
  /** Furtivité : pas de réaction Guard quand le héros se déplace. */
  stealth?: boolean;
  /** Cartes arme (optionnel) : dés et type d'attaque par carte. */
  weapons?: { id: string; name: string; attackDice: number; attackType: 'melee' | 'ranged' }[];
  position: Position;
}

export interface MonsterInit {
  id: string;
  definitionId: string;
  position: Position;
  isGuard?: boolean;
  rank?: 'minor' | 'major';
}

export interface DeckRules {
  /** Types de monstres du scénario listés pour le deck (par défaut : ceux présents au plateau). */
  listedMonsterIds?: string[];
  /** Cartes jamais ajoutées (ex. Hammer Beastman dans The Moon Gate). */
  excluded?: string[];
  /** Nombre maximal de cartes d'un type (ex. 3 Minotaur dans Brightsun Arena). */
  limited?: Record<string, number>;
  /** Cartes ajoutées plus tard (ex. Lord Fang une fois placé ; Ghost une fois réapparu). */
  delayed?: string[];
  wildPetCards?: number;
}

export interface SetupConfig {
  sessionId: string;
  scenarioId: string;
  generatedScenario?: string;
  difficulty: Difficulty;
  expansions?: Expansion[];
  monsterCardSet: string;
  board: Board;
  tileLayout?: TileLayout | null;
  spawnPoints: SpawnPoint[];
  heroes: HeroInit[];
  monsters: MonsterInit[];
  deck?: DeckRules;
  quests: { id: string; title: string; at?: Position; icon?: 'key' | 'flame' | 'skull' | 'flag' | 'chest' | 'gem' }[];
  questsRequired?: number;
  settings?: Partial<Settings>;
  seed: number;
  spawnTileCapacity?: number;
  dragonPart2?: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  diceMode: 'digital',
  cardMode: 'digital',
  tiePolicy: 'stable-id',
  // Les héros sont joués par un humain : il lance ses dés de défense et indique les boucliers.
  defenseRoll: 'physical',
  removeCardsOfEliminatedTypes: false,
  heroActivation: 'one',
  // Règle du livret : seule une case contenant 2 ennemis bloque la ligne de vue (1 héros + 1 monstre ne la bloque pas).
  lineOfSight: 'rulebook',
};

/**
 * Deck d'activation (solo v1.3 p.1) : cartes des AUTRES niveaux de chaque monstre listé, mélangées.
 * Les règles de scénario (exclusions, limites, cartes retardées, Wild Pet) sont explicites et auditables.
 */
export function buildActivationDeck(
  content: Content,
  monsterCardSet: string,
  rules: DeckRules,
  listed: string[],
  rng: CountingRandom,
) {
  const excluded: ActivationCard[] = [];
  const delayed: ActivationCard[] = [];
  const cards: ActivationCard[] = [];
  for (const defId of listed) {
    const def = content.monsters[defId];
    if (!def) throw new Error(`Monstre inconnu dans le deck : ${defId}`);
    // Un monstre a une carte par niveau autre que celui du scénario, même quand ses stats d'autres niveaux ne sont pas encore saisies.
    const legacy = Object.keys(def.levels).some((l) => !(MONSTER_LEVELS as readonly string[]).includes(l));
    const levels = (legacy ? Object.keys(def.levels) : [...MONSTER_LEVELS]).filter((l) => l !== monsterCardSet);
    const mk = (l: string): ActivationCard => ({ id: `${defId}:${l}`, kind: 'monster', monsterDefId: defId });
    let list = levels.map(mk);
    const cap = rules.limited?.[defId];
    if (cap !== undefined) {
      excluded.push(...list.slice(cap));
      list = list.slice(0, cap);
    }
    if (rules.excluded?.includes(defId)) excluded.push(...list);
    else if (rules.delayed?.includes(defId)) delayed.push(...list);
    else cards.push(...list);
  }
  for (let i = 0; i < (rules.wildPetCards ?? 0); i++) {
    cards.push({ id: `wild-pet:${i + 1}`, kind: 'wild-pet' });
  }
  return { draw: shuffle(cards, rng), discard: [], excluded, delayed };
}

export function createGame(config: SetupConfig, content: Content): GameState {
  const rng = new CountingRandom(config.seed);
  const listed = config.deck?.listedMonsterIds ?? [...new Set(config.monsters.map((m) => m.definitionId))];
  const heroes: Hero[] = config.heroes.map((h) => ({
    id: h.id,
    name: h.name,
    life: h.life,
    defense: h.defense,
    rerolls: h.rerolls ?? 0,
    ...(h.stealth ? { stealth: true } : {}),
    ...(h.weapons?.length ? { weapons: h.weapons.map((w) => ({ ...w, exhausted: false })) } : {}),
    position: h.position,
    wounds: 0,
    dead: false,
    deaths: 0,
  }));
  const state: GameState = {
    schemaVersion: SCHEMA_VERSION,
    sessionId: config.sessionId,
    contentVersion: content.version,
    scenarioId: config.scenarioId,
    ...(config.generatedScenario ? { generatedScenario: config.generatedScenario } : {}),
    difficulty: config.difficulty,
    expansions: config.expansions ?? [],
    monsterCardSet: config.monsterCardSet,
    round: 0,
    phase: 'SCENARIO_SETUP',
    dragonPart2: config.dragonPart2 ?? false,
    heroes,
    monsters: config.monsters.map((m) => ({
      id: m.id,
      definitionId: m.definitionId,
      position: m.position,
      status: 'board',
      isGuard: m.isGuard ?? false,
      wounds: 0,
      ...(m.rank ? { rank: m.rank } : {}),
    })),
    pets: [],
    mounts: [],
    board: config.board,
    tileLayout: config.tileLayout ?? null,
    spawnPoints: config.spawnPoints,
    spawnTile: [],
    spawnTileCapacity: config.spawnTileCapacity ?? 5,
    deck: buildActivationDeck(content, config.monsterCardSet, config.deck ?? {}, listed, rng),
    quests: config.quests.map((q) => ({ ...q, done: false })),
    questsRequired: config.questsRequired ?? Math.max(1, config.quests.length),
    coins: 0,
    deaths: 0,
    settings: { ...DEFAULT_SETTINGS, ...config.settings },
    rngSeed: config.seed,
    rngCounter: rng.counter,
    nextActivationTargetsPet: false,
    activatedHeroIds: [],
    heroTurn: {},
    eventSeq: 0,
    events: [],
  };
  const problems = validateGameState(state, content);
  if (problems.length) throw new Error(`Mise en place invalide :\n- ${problems.join('\n- ')}`);
  return state;
}

/** Invariants du domaine (plan Phase 2) ; renvoie la liste des problèmes détectés. */
export function validateGameState(s: GameState, content?: Content): string[] {
  const problems: string[] = [];
  const parsed = safeParse(GameStateSchema, s);
  if (!parsed.success) problems.push(...parsed.issues.map((i) => `${i.path}: ${i.message}`));
  const ids = [...s.heroes, ...s.monsters, ...s.pets, ...s.mounts].map((x) => x.id);
  if (new Set(ids).size !== ids.length) problems.push('Identifiants de personnages en double');
  const inBounds = (p: Position) => p.x >= 0 && p.y >= 0 && p.x < s.board.width && p.y < s.board.height;
  const counts = new Map<string, number>();
  const place = (id: string, p: Position | null) => {
    if (!p) return;
    if (!inBounds(p)) problems.push(`${id} hors du plateau en (${p.x},${p.y})`);
    if (s.board.holes.some((h) => h.x === p.x && h.y === p.y)) problems.push(`${id} sur une case absente (${p.x},${p.y})`);
    const k = `${p.x},${p.y}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  };
  s.heroes.filter((h) => !h.dead).forEach((h) => place(h.id, h.position));
  s.monsters.filter((m) => m.status === 'board').forEach((m) => place(m.id, m.position));
  for (const [k, n] of counts) if (n > CELL_CAPACITY) problems.push(`Plus de ${CELL_CAPACITY} personnages sur la Space ${k}`);
  for (const m of s.monsters) {
    if (m.status === 'board' && !m.position) problems.push(`${m.id} sur le plateau sans position`);
    if (m.status !== 'board' && m.position) problems.push(`${m.id} a une position hors plateau`);
    if (content && !content.monsters[m.definitionId]) problems.push(`Monstre inconnu : ${m.definitionId}`);
    if (content && !monsterStats(content.monsters[m.definitionId], s.monsterCardSet, m.rank)) {
      problems.push(`Stats manquantes : ${m.definitionId} (${m.rank ?? 'minor'}) pour le niveau ${s.monsterCardSet}`);
    }
  }
  if (content) {
    // On ne pose pas plus de figurines que la boîte n'en contient (celles retirées du jeu ne comptent plus).
    const used = new Map<string, number>();
    for (const m of s.monsters) if (m.status !== 'box' && m.status !== 'removed') used.set(m.definitionId, (used.get(m.definitionId) ?? 0) + 1);
    problems.push(...boxProblems(used, content.monsters));
  }
  for (const id of s.spawnTile) {
    if (s.monsters.find((m) => m.id === id)?.status !== 'spawn-tile') problems.push(`${id} sur la Spawn Tile avec un statut incohérent`);
  }
  if (s.spawnTile.length > s.spawnTileCapacity) problems.push('Spawn Tile débordante');
  if (s.questsRequired > s.quests.length) problems.push('Plus de quêtes requises que de quêtes');
  return problems;
}

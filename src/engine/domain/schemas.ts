import { type } from 'arktype';

export const SCHEMA_VERSION = 1;

export const PositionSchema = type({ x: 'number.integer', y: 'number.integer' });
export type Position = typeof PositionSchema.infer;

export const RotationSchema = type('0 | 90 | 180 | 270');
export type Rotation = typeof RotationSchema.infer;

export const TilePlacementSchema = type({
  tileId: 'string',
  tx: 'number.integer >= 0',
  ty: 'number.integer >= 0',
  rotation: RotationSchema,
  /**
   * Décalage de la tuile, en cases, par rapport à son emplacement (tx, ty) : vers la droite (dx > 0) ou la gauche, vers le bas
   * (dy > 0) ou le haut. Décaler une tuile laisse des cases vides, donc bloquantes, entre elle et ses voisines.
   */
  'dx?': 'number.integer | undefined',
  'dy?': 'number.integer | undefined',
});
export type TilePlacement = typeof TilePlacementSchema.infer;

export const TileLayoutSchema = type({
  tilesW: 'number.integer > 0',
  tilesH: 'number.integer > 0',
  placements: TilePlacementSchema.array(),
});
export type TileLayout = typeof TileLayoutSchema.infer;

export const DoorSchema = type({
  id: 'string',
  a: PositionSchema,
  b: PositionSchema,
  open: 'boolean',
  /** Porte spéciale : l'unique pion porte violet de la boîte. */
  'special?': 'boolean | undefined',
});
export type Door = typeof DoorSchema.infer;

export const PortalSchema = type({ id: 'string', at: PositionSchema, color: 'string' });
export type Portal = typeof PortalSchema.infer;

/** Plateau abstrait : grille de Spaces, murs et portes sur les arêtes, portails, cases absentes. */
export const BoardSchema = type({
  width: 'number.integer > 0',
  height: 'number.integer > 0',
  holes: PositionSchema.array(),
  /** Cases d'intérieur (bâtiments), pour l'affichage : le déplacement ne dépend que des murs et des portes. */
  'interior?': PositionSchema.array().or('undefined'),
  /** Salles : cases dont le sol diffère de la rue (affichage seulement). */
  'rooms?': PositionSchema.array().or('undefined'),
  /** Cases bloquées (impassables) : elles figurent aussi dans `holes`, qui porte les règles ; ici, pour les dessiner. */
  'blocked?': PositionSchema.array().or('undefined'),
  walls: type([PositionSchema, PositionSchema]).array(),
  doors: DoorSchema.array(),
  portals: PortalSchema.array(),
});
export type Board = typeof BoardSchema.infer;

/** Symbole d'une face de dé : défini par les données de dés (voir game-data/dice). */
export const DieFaceSchema = type('string');
export type DieFace = typeof DieFaceSchema.infer;

export const SpawnPointSchema = type({
  id: 'string',
  at: PositionSchema,
  /** Paire de symboles, sans ordre. */
  dice: type([DieFaceSchema, DieFaceSchema]),
});
export type SpawnPoint = typeof SpawnPointSchema.infer;

export const AttackTypeSchema = type("'melee' | 'ranged'");
export type AttackType = typeof AttackTypeSchema.infer;

/** Compétences des monstres appliquées par le moteur (voir `MONSTER_SKILLS`). */
export const MonsterSkillSchema = type("'crit-extra-wound' | 'attack-all-adjacent' | 'extra-die-next-to-monster' | 'stun'");
export type MonsterSkill = typeof MonsterSkillSchema.infer;

export const MonsterStatsSchema = type({
  life: 'number.integer > 0',
  overkill: 'number.integer > 0',
  reward: 'number.integer >= 0',
  attackType: AttackTypeSchema,
  attackDice: 'number.integer >= 0',
  movement: 'number.integer >= 0',
  /**
   * Dés de défense (blancs) du monstre quand un héros l'attaque : le joueur les lance et indique les blessures qui passent
   * (un bouclier ou un critique annule une touche). 0 ou absent : pas de défense.
   */
  'defense?': 'number.integer >= 0 | undefined',
  /** Relances de l'attaque du monstre (ex. Orc Captain : 1). */
  'rerolls?': 'number.integer >= 0 | undefined',
  /** Compétences : critique = blessure en plus, attaque de tous les héros adjacents, dé en plus près d'un monstre, étourdissement. */
  'skills?': MonsterSkillSchema.array().or('undefined'),
});
export type MonsterStats = typeof MonsterStatsSchema.infer;

/**
 * Définition statique d'un monstre. Deux catégories : minions et vilains. Les stats sont indexées par niveau
 * (« 1 », « 2-3 », « 4-5 », « 6 ») ; `levels` porte celles des minor (ou de la version unique), `majorLevels` celles des major.
 */
export const MonsterDefinitionSchema = type({
  id: 'string',
  name: 'string',
  /** Abréviation affichée sur le pion (ex. GA). */
  'abbr?': 'string | undefined',
  tier: 'number.integer > 0',
  'kind?': "'minion' | 'villain' | undefined",
  /** Nombre de figurines dans la boîte : on n'en pose pas davantage. */
  'copies?': 'number.integer > 0 | undefined',
  /** Boîte partagée : des types qui utilisent les mêmes figurines (Orc Marauder et Orc Captain : 8 Orcs en tout) ont le même groupe. */
  'group?': 'string | undefined',
  levels: { '[string]': MonsterStatsSchema },
  'majorLevels?': { '[string]': MonsterStatsSchema },
});
export type MonsterDefinition = typeof MonsterDefinitionSchema.infer;

export const MonsterInstanceSchema = type({
  id: 'string',
  definitionId: 'string',
  position: PositionSchema.or('null'),
  status: "'board' | 'spawn-tile' | 'box' | 'removed'",
  isGuard: 'boolean',
  wounds: 'number.integer >= 0',
  /** Version de la figurine ; minor par défaut. */
  'rank?': "'minor' | 'major' | undefined",
});
export type MonsterInstance = typeof MonsterInstanceSchema.infer;

/** Carte arme : nombre de dés lancés et type d'attaque (mêlée ou distance). Épuisée à l'usage, jusqu'au prochain repos. */
export const WeaponCardSchema = type({
  id: 'string',
  name: 'string',
  attackDice: 'number.integer > 0',
  attackType: AttackTypeSchema,
  exhausted: 'boolean',
});
export type WeaponCard = typeof WeaponCardSchema.infer;

export const HeroSchema = type({
  id: 'string',
  name: 'string',
  life: 'number.integer > 0',
  defense: 'number.integer >= 0',
  rerolls: 'number.integer >= 0',
  position: PositionSchema.or('null'),
  wounds: 'number.integer >= 0',
  dead: 'boolean',
  /** Jetons Death du scénario en cours. */
  deaths: 'number.integer >= 0',
  /** Étourdi (par un Hammer Beastman) : jeton Étourdi posé sur la figurine, à retirer à la main. */
  'stunned?': 'boolean | undefined',
  'mountId?': 'string | null | undefined',
  /** Cartes arme du héros. Absentes = saisie libre (mise en place sans cartes). */
  'weapons?': WeaponCardSchema.array().or('undefined'),
});
export type Hero = typeof HeroSchema.infer;

export const PetSchema = type({
  id: 'string',
  name: 'string',
  life: 'number.integer > 0',
  defense: 'number.integer >= 0',
  position: PositionSchema.or('null'),
  wounds: 'number.integer >= 0',
  dead: 'boolean',
});
export type Pet = typeof PetSchema.infer;

export const MountSchema = type({
  id: 'string',
  name: 'string',
  position: PositionSchema.or('null'),
  dead: 'boolean',
});
export type Mount = typeof MountSchema.infer;

export const ActivationCardSchema = type({
  id: 'string',
  kind: "'monster' | 'wild-pet'",
  'monsterDefId?': 'string | undefined',
});
export type ActivationCard = typeof ActivationCardSchema.infer;

export const DeckSchema = type({
  draw: ActivationCardSchema.array(),
  discard: ActivationCardSchema.array(),
  /** Cartes écartées par une règle de scénario. */
  excluded: ActivationCardSchema.array(),
  /** Cartes à ajouter quand une condition de scénario est remplie (ex. Lord Fang placé). */
  delayed: ActivationCardSchema.array(),
});
export type Deck = typeof DeckSchema.infer;

export const QuestSchema = type({
  id: 'string',
  title: 'string',
  done: 'boolean',
  'at?': PositionSchema.or('undefined'),
  /** Icône de l'objectif (clé, flamme, crâne, drapeau, coffre, gemme). */
  'icon?': "'key' | 'flame' | 'skull' | 'flag' | 'chest' | 'gem' | undefined",
});
export type Quest = typeof QuestSchema.infer;

export const DifficultySchema = type("'legendary' | 'hard' | 'medium' | 'easy'");
export type Difficulty = typeof DifficultySchema.infer;

export const PhaseSchema = type(
  "'SCENARIO_SETUP' | 'GUILD_TURN' | 'MONSTER_TURN_SPAWN' | 'MONSTER_TURN_ACTIVATION_1' | 'MONSTER_TURN_ACTIVATION_2' | 'DRAGON_TURN' | 'SCENARIO_WON' | 'SCENARIO_LOST'",
);
export type Phase = typeof PhaseSchema.infer;

export const TiePolicySchema = type("'ask' | 'stable-id'");
export type TiePolicy = typeof TiePolicySchema.infer;

export const SettingsSchema = type({
  diceMode: "'digital' | 'physical'",
  cardMode: "'digital' | 'physical'",
  tiePolicy: TiePolicySchema,
  /** Jet de défense des héros : tiré par l'application ou lancé sur la table (le joueur saisit les coups parés). */
  defenseRoll: "'digital' | 'physical'",
  /** Option B13 : retirer les cartes d'un type totalement éliminé (notes p.6) au lieu de les conserver (FAQ p.20). */
  removeCardsOfEliminatedTypes: 'boolean',
  /** Activation de la guilde : « one » = un seul héros par tour (livret de base) ; « all » = tous les héros (mode solo v1.3). Absent = « all » (anciennes sauvegardes). */
  /** Ligne de vue : « any-character » = tout personnage traversé la bloque ; « rulebook » = seulement une case bloquée (2 ennemis). Absent = « rulebook » (anciennes sauvegardes). */
  'lineOfSight?': "'rulebook' | 'any-character' | undefined",
  'heroActivation?': "'one' | 'all' | undefined",
});
export type Settings = typeof SettingsSchema.infer;

export const DecisionTraceSchema = type({
  decisionId: 'string',
  ruleIds: 'string[]',
  summary: 'string',
  explanation: 'string[]',
  'candidates?': 'string[] | undefined',
  'selectedEntityId?': 'string | undefined',
  'rejectedCandidates?': type({ entityId: 'string', reason: 'string' }).array().or('undefined'),
});
export type DecisionTrace = typeof DecisionTraceSchema.infer;

export const GameEventSchema = type({
  seq: 'number.integer',
  round: 'number.integer',
  phase: PhaseSchema,
  type: 'string',
  message: 'string',
  'data?': type({ '[string]': 'unknown' }).or('undefined'),
  'trace?': DecisionTraceSchema.or('undefined'),
});
export type GameEvent = typeof GameEventSchema.infer;

export const ExpansionSchema = type("'inferno' | 'beyond-the-grave' | 'pets' | 'riders' | 'dragons' | 'whole-lotta-lava'");
export type Expansion = typeof ExpansionSchema.infer;

export const GameStateSchema = type({
  schemaVersion: type.unit(SCHEMA_VERSION),
  sessionId: 'string',
  contentVersion: 'string',
  scenarioId: 'string',
  /** Scénario généré aléatoirement (JSON de sa définition) : il n'existe pas dans les données livrées, la partie le garde. */
  'generatedScenario?': 'string | undefined',
  difficulty: DifficultySchema,
  expansions: ExpansionSchema.array(),
  /** Jeu de cartes Monster du niveau courant (ex. « 1 », « 2-3 »). */
  monsterCardSet: 'string',
  round: 'number.integer >= 0',
  phase: PhaseSchema,
  /** Dragon Partie 2 : la manche est Dragon Turn puis Guild Turn, sans Monster Turn. */
  dragonPart2: 'boolean',
  heroes: HeroSchema.array(),
  monsters: MonsterInstanceSchema.array(),
  pets: PetSchema.array(),
  mounts: MountSchema.array(),
  board: BoardSchema,
  /** Tuiles posées (les scans restent dans la bibliothèque locale) ; null pour un plateau saisi sans tuiles. */
  tileLayout: TileLayoutSchema.or('null'),
  spawnPoints: SpawnPointSchema.array(),
  spawnTile: 'string[]',
  spawnTileCapacity: 'number.integer > 0',
  deck: DeckSchema,
  quests: QuestSchema.array(),
  /** Nombre de quêtes PvE à accomplir (toutes par défaut ; 2 sur 3 pour certains scénarios). */
  questsRequired: 'number.integer > 0',
  coins: 'number.integer >= 0',
  deaths: 'number.integer >= 0',
  settings: SettingsSchema,
  rngSeed: 'number.integer',
  rngCounter: 'number.integer >= 0',
  /** Pets : la prochaine activation vise le familier le plus proche. */
  nextActivationTargetsPet: 'boolean',
  /** Héros activés pendant le Guild Turn courant. */
  activatedHeroIds: 'string[]',
  /** Suivi de l'activation de chaque héros : points de mouvement restants, déplacé, a attaqué. */
  heroTurn: { '[string]': { mpLeft: 'number.integer', moved: 'boolean', attacked: 'boolean' } },
  eventSeq: 'number.integer >= 0',
  events: GameEventSchema.array(),
  /** Règles du script de scénario déjà déclenchées (une seule fois chacune). */
  'scriptFired?': 'string[] | undefined',
  /** Cartes Récompense gagnées pendant la partie (vilain abattu, coffre ouvert) : identifiant de carte et règle qui l'a donnée. */
  'rewards?': type({ cardId: 'string', ruleId: 'string' }).array().or('undefined'),
});
export type GameState = typeof GameStateSchema.infer;

export const DEFEAT_THRESHOLD: Record<Difficulty, number> = {
  legendary: 1,
  hard: 2,
  medium: 3,
  easy: 4,
};

/** Données statiques injectées dans le moteur (jamais dans le GameState). */
export interface DieFaceDef {
  symbol: string;
  /** Réussite en attaque de mêlée / à distance ; crit = réussite + dé supplémentaire. */
  melee: boolean;
  ranged: boolean;
  crit: boolean;
  /** Sauvegarde en défense. */
  save: boolean;
}

export interface Content {
  version: string;
  monsters: Record<string, MonsterDefinition>;
  /** Faces du dé de combat (noir) et du dé de défense (blanc). */
  attackDie: DieFaceDef[];
  defenseDie: DieFaceDef[];
  /** Les tuiles du jeu physique (1A à 9B), par code de face : les plateaux des scénarios se construisent depuis elles. */
  tiles?: Record<string, import('../tiles').TileDef>;
  /** Cartes Récompense du jeu (équipement gagné sur un vilain ou dans un coffre). */
  rewards?: import('../rewards').RewardCard[];
}

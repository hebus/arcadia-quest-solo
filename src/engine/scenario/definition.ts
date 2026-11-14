import { doorTokenProblems } from '../doorTokens';
import { HERO_START_ENCLOSED, heroStartsEnclosed } from '../startArea';
import { tilePlacementProblems } from '../tileCatalog';
import { boardFromLayout, doorsWithoutWall, layoutExtent, layoutProblems } from '../tiles';
import { type } from 'arktype';
import { parseBoardDsl, type ParsedBoard } from '../boardDsl';
import { DifficultySchema, PositionSchema, TileLayoutSchema, type Content, type Difficulty, type Position } from '../domain/schemas';
import { parse } from '../domain/validate';
import { CELL_CAPACITY } from '../movement/board';
import { createGame, type DeckRules, type SetupConfig } from '../setup';
import { RuleSchema, validateScript } from './script';

/** Modèle de héros jouable : l'univers du jeu fournit les gabarits, le scénario place les trois choisis. */
export const HeroTemplateSchema = type({
  id: 'string',
  name: 'string',
  /** Une phrase d'accroche affichée au choix des héros. */
  epithet: 'string',
  life: 'number.integer > 0',
  defense: 'number.integer >= 0',
  rerolls: 'number.integer >= 0',
  'weapons?': type({
    id: 'string',
    name: 'string',
    attackDice: 'number.integer > 0',
    attackType: "'melee' | 'ranged'",
  })
    .array()
    .or('undefined'),
});
export type HeroTemplate = typeof HeroTemplateSchema.infer;

export const ScenarioQuestSchema = type({
  id: 'string',
  title: 'string',
  /** Court texte d'ambiance affiché quand la quête est accomplie. */
  completion: 'string',
  /** Case de l'objectif : affichée sur le plateau (jamais en coordonnées). */
  'at?': PositionSchema.or('undefined'),
  /** Icône affichée sur la case de l'objectif, dans le briefing et dans la liste. */
  'icon?': "'key' | 'flame' | 'skull' | 'flag' | 'chest' | 'gem' | undefined",
});
export type ScenarioQuest = typeof ScenarioQuestSchema.infer;

export const ScenarioDefinitionSchema = type({
  id: 'string',
  title: 'string',
  tagline: 'string',
  /** Difficulté conseillée. */
  recommended: DifficultySchema,
  story: {
    intro: 'string[]',
    win: 'string[]',
    lose: 'string[]',
  },
  /** Plateau décrit avec le DSL de `boardDsl.ts` (taille, pièces, murs, portes, portails, jetons Spawn). */
  board: 'string',
  /**
   * Tuiles à assembler pour le plateau (numéro et face de chaque tuile, rotation par quarts de tour) : affichées dans le
   * briefing et au début de la partie. Une tuile ne se pose que sur une seule face dans un scénario.
   */
  'tiles?': TileLayoutSchema.or('undefined'),
  /** Cases de départ des héros, dans l'ordre : le 1er héros choisi prend la 1re case. */
  heroStarts: PositionSchema.array(),
  monsters: type({
    id: 'string',
    definitionId: 'string',
    at: PositionSchema,
    'guard?': 'boolean | undefined',
    'rank?': "'minor' | 'major' | undefined",
  }).array(),
  quests: ScenarioQuestSchema.array(),
  /** Terrain d'essai : outils de placement et de réglage des dés, pas une aventure. */
  'sandbox?': 'boolean | undefined',
  'questsRequired?': 'number.integer > 0 | undefined',
  /** Script du maître de jeu : règles « quand… alors… » (récit, quêtes, renforts, portes). */
  'script?': RuleSchema.array().or('undefined'),
  monsterCardSet: 'string',
  'spawnTileCapacity?': 'number.integer > 0 | undefined',
  'deck?': type({
    'listedMonsterIds?': 'string[] | undefined',
    'excluded?': 'string[] | undefined',
    'limited?': { '[string]': 'number.integer' },
    'delayed?': 'string[] | undefined',
    'wildPetCards?': 'number.integer >= 0 | undefined',
  }).or('undefined'),
});
export type ScenarioDefinition = typeof ScenarioDefinitionSchema.infer;

export interface StartOptions {
  sessionId: string;
  difficulty: Difficulty;
  seed: number;
  /** Gabarits des héros choisis, dans l'ordre des cases de départ. */
  heroes: HeroTemplate[];
}

const samePos = (a: Position, b: Position) => a.x === b.x && a.y === b.y;

/** Contrôles d'intégrité du scénario ; renvoie la liste des problèmes (vide = jouable). */
/**
 * Plateau d'un scénario. Sans `tiles`, il vient de la description textuelle. Avec `tiles`, il est construit depuis les tuiles
 * du jeu (murs, bâtiments, salles, cases bloquées, rotation) ; la description n'apporte plus que les jetons Spawn, les portes
 * (pions porte), les murs et les portails ajoutés par le scénario.
 */
export function scenarioBoard(def: ScenarioDefinition, content: Pick<Content, 'tiles'>): ParsedBoard {
  const parsed = parseBoardDsl(def.board);
  if (!def.tiles) return parsed;
  const tiles = content.tiles ?? {};
  for (const pl of def.tiles.placements) {
    if (!tiles[pl.tileId]) throw new Error(`la tuile ${pl.tileId} n'est pas définie : définissez-la dans l'éditeur de tuiles.`);
  }
  if (parsed.board.interior?.length || parsed.board.holes.length) {
    throw new Error('un plateau en tuiles ne décrit ni bâtiments (room) ni trous (hole) : ils viennent des tuiles.');
  }
  const board = boardFromLayout(tiles, def.tiles, { walls: parsed.board.walls, doors: parsed.board.doors, portals: parsed.board.portals });
  return { board, spawnPoints: parsed.spawnPoints };
}

export function validateScenario(def: ScenarioDefinition, content: Pick<Content, 'monsters' | 'tiles'>): string[] {
  const problems: string[] = [];
  let parsed: ReturnType<typeof parseBoardDsl>;
  try {
    parsed = scenarioBoard(def, content);
  } catch (e) {
    return [`Plateau : ${e instanceof Error ? e.message : String(e)}`];
  }
  const { board, spawnPoints } = parsed;
  const playable = (p: Position) => p.x >= 0 && p.y >= 0 && p.x < board.width && p.y < board.height && !board.holes.some((h) => samePos(h, p));
  const where = (p: Position) => `(${p.x},${p.y})`;
  def.heroStarts.forEach((p) => playable(p) || problems.push(`Départ de héros hors du plateau ${where(p)}`));
  const used = new Map<string, number>();
  for (const p of def.heroStarts) used.set(`${p.x},${p.y}`, (used.get(`${p.x},${p.y}`) ?? 0) + 1);
  for (const m of def.monsters) {
    if (!content.monsters[m.definitionId]) problems.push(`Monstre inconnu : ${m.definitionId}`);
    if (!playable(m.at)) problems.push(`${m.id} hors du plateau ${where(m.at)}`);
    const k = `${m.at.x},${m.at.y}`;
    used.set(k, (used.get(k) ?? 0) + 1);
  }
  const perType = new Map<string, number>();
  for (const m of def.monsters) perType.set(m.definitionId, (perType.get(m.definitionId) ?? 0) + 1);
  for (const [id, n] of perType) {
    const copies = content.monsters[id]?.copies;
    if (copies !== undefined && n > copies) problems.push(`Trop de figurines ${content.monsters[id]!.name} : ${n} pour ${copies} dans la boîte`);
  }
  for (const [k, n] of used) if (n > CELL_CAPACITY) problems.push(`Plus de ${CELL_CAPACITY} figurines sur la case ${k}`);
  for (const q of def.quests) if (q.at && !playable(q.at)) problems.push(`Objectif « ${q.title} » hors du plateau ${where(q.at)}`);
  if (def.heroStarts.length < 1) problems.push('Aucune case de départ pour les héros');
  if (spawnPoints.length === 0) problems.push('Aucun jeton Spawn');
  problems.push(...doorTokenProblems(board.doors));
  if (def.heroStarts.every(playable) && heroStartsEnclosed(board, def.heroStarts)) problems.push(HERO_START_ENCLOSED);
  if (def.tiles) {
    const check = tilePlacementProblems(def.tiles.placements.map((p) => p.tileId));
    problems.push(...check.errors);
    for (const id of check.notInGame) problems.push(`Tuile « ${id} » : il n'existe que les tuiles 1A/1B à 9A/9B.`);
    // La taille annoncée par la description (size LxH) doit correspondre aux tuiles : 3 cases par tuile.
    const size = parseBoardDsl(def.board).board;
    // Un pion porte se pose sur un mur et le remplace : sur une arête sans mur, il n'a pas de sens.
    if (def.tiles.placements.every((p) => content.tiles?.[p.tileId])) {
      const hand = parseBoardDsl(def.board).board;
      for (const d of doorsWithoutWall(content.tiles ?? {}, def.tiles, { walls: hand.walls, doors: hand.doors, portals: hand.portals })) {
        problems.push(`La porte « ${d.id} » est posée sur une arête sans mur : un pion porte remplace un mur (côté « porte ouverte », il le supprime).`);
      }
    }
    const extent = layoutExtent(def.tiles);
    if (extent.width !== size.width || extent.height !== size.height) {
      problems.push(`Les tuiles (${extent.width}×${extent.height} cases) ne correspondent pas au plateau (${size.width}×${size.height}).`);
    }
    problems.push(...layoutProblems(def.tiles));
  }
  if (def.quests.length === 0) problems.push('Aucune quête');
  problems.push(
    ...validateScript(def.script ?? [], {
      questIds: def.quests.map((q) => q.id),
      doorIds: board.doors.map((d) => d.id),
      monsterIds: def.monsters.map((m) => m.id),
      knownDefinitions: (id) => !!content.monsters[id],
      playable,
    }),
  );
  for (const id of def.deck?.listedMonsterIds ?? []) if (!content.monsters[id]) problems.push(`Deck : monstre inconnu ${id}`);
  return problems;
}

/** Configuration de partie prête à jouer : plus aucune mise en place manuelle. */
export function scenarioToSetup(def: ScenarioDefinition, opts: StartOptions, content: Pick<Content, 'monsters' | 'tiles'>): SetupConfig {
  const problems = validateScenario(def, content);
  if (problems.length) throw new Error(`Scénario « ${def.title} » invalide :\n- ${problems.join('\n- ')}`);
  if (opts.heroes.length > def.heroStarts.length) throw new Error(`Ce scénario accepte ${def.heroStarts.length} héros au plus`);
  const { board, spawnPoints } = scenarioBoard(def, content);
  const deck: DeckRules = {
    ...(def.deck?.listedMonsterIds ? { listedMonsterIds: def.deck.listedMonsterIds } : {}),
    ...(def.deck?.excluded ? { excluded: def.deck.excluded } : {}),
    ...(def.deck?.limited ? { limited: def.deck.limited } : {}),
    ...(def.deck?.delayed ? { delayed: def.deck.delayed } : {}),
    ...(def.deck?.wildPetCards !== undefined ? { wildPetCards: def.deck.wildPetCards } : {}),
  };
  return {
    sessionId: opts.sessionId,
    scenarioId: def.id,
    difficulty: opts.difficulty,
    monsterCardSet: def.monsterCardSet,
    board,
    ...(def.tiles ? { tileLayout: def.tiles } : {}),
    spawnPoints,
    heroes: opts.heroes.map((h, i) => ({
      id: `h${i + 1}`,
      name: h.name,
      life: h.life,
      defense: h.defense,
      rerolls: h.rerolls,
      ...(h.weapons?.length ? { weapons: h.weapons } : {}),
      position: def.heroStarts[i]!,
    })),
    monsters: def.monsters.map((m) => ({ id: m.id, definitionId: m.definitionId, position: m.at, isGuard: m.guard ?? false, ...(m.rank ? { rank: m.rank } : {}) })),
    deck,
    quests: def.quests.map((q) => ({ id: q.id, title: q.title, ...(q.at ? { at: q.at } : {}), ...(q.icon ? { icon: q.icon } : {}) })),
    ...(def.questsRequired ? { questsRequired: def.questsRequired } : {}),
    ...(def.spawnTileCapacity ? { spawnTileCapacity: def.spawnTileCapacity } : {}),
    seed: opts.seed,
  };
}

/** Crée la partie d'un scénario ; lève une erreur lisible si le scénario ou le choix de héros est invalide. */
export function createScenarioGame(def: ScenarioDefinition, opts: StartOptions, content: Content) {
  return createGame(scenarioToSetup(def, opts, content), content);
}

export const parseScenario = (raw: unknown): ScenarioDefinition => parse(ScenarioDefinitionSchema, raw);

import type { Content, MonsterDefinition, Position, Rotation } from '../domain/schemas';
import { boxRemaining } from '../figurines';
import { monsterStats } from '../monsters';
import { key, samePos } from '../movement/board';
import { createSeededRandom, type RandomSource } from '../random';
import { SPAWN_TOKEN_TYPES } from '../spawn/tokens';
import { TILE_FACES, TILE_NUMBERS } from '../tileCatalog';
import { boardFromLayout, layoutExtent, layoutHeroStarts, type TileDef, type TileLayout } from '../tiles';
import { scenarioBoard, validateScenario, type ScenarioDefinition } from './definition';
import { walkDistances } from './reachability';
import { drawObjective, type ObjectiveKind } from './objectives';
import type { Rule } from './script';

/**
 * Générateur de scénarios aléatoires : on donne le nombre de tuiles du terrain, un scénario complet en sort — tuiles tirées
 * (numéro, face, rotation, assemblage d'un seul tenant), pions porte, départ des héros, jetons Spawn, monstres et deux quêtes.
 * Le tirage est reproductible : même graine, même scénario.
 */

export const MIN_GENERATED_TILES = 1;
export const MAX_GENERATED_TILES = 9;
const MAX_ATTEMPTS = 300;
const DOOR_TOKENS = 22;

type Edge = [Position, Position];
const DIRS: Position[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];
const add = (p: Position, d: Position): Position => ({ x: p.x + d.x, y: p.y + d.y });
const edgeKey = (a: Position, b: Position): string => (key(a) < key(b) ? `${key(a)}|${key(b)}` : `${key(b)}|${key(a)}`);
const dist = (a: Position, b: Position): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

const pick = <T>(rng: RandomSource, list: readonly T[]): T => list[rng.nextInt(0, list.length - 1)]!;
function shuffle<T>(rng: RandomSource, list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const INTRO_OPENING = [
  'La nuit tombe sur Arcadia et les ruelles se vident.',
  'Des brutes ont investi le quartier au crépuscule.',
  'Une rumeur court dans la ville : des orcs fouillent les ruelles, et personne n’ose plus sortir.',
  'Le guet a abandonné ce quartier ; les orcs en font leur repaire.',
];
const INTRO_HOOK = [
  'Votre guilde est la seule à pouvoir encore intervenir.',
  'Personne d’autre n’osera franchir ces portes cette nuit.',
  'Chaque heure qui passe renforce la bande : il faut agir vite.',
];
/** Portails à partir de 5 tuiles (un couple violet) et de 7 tuiles (un couple bleu en plus). */
export const MIN_PORTAL_TILES = 5;
export const MIN_BLUE_PORTAL_TILES = 7;
const WIN = ['Le chef est tombé et le quartier respire. Au matin, les ruelles de la ville sont de nouveau à vous.', 'La bande fuit dans la nuit : la guilde a tenu le terrain.'];
const LOSE = ['Les orcs referment le quartier derrière vous. Cette nuit, la guilde n’a plus d’issue.', 'Trop de héros sont tombés : la bande garde la rue.'];

/** Assemble `count` emplacements d'un seul tenant en faisant grossir une forme case par case, puis la recale à l'origine. */
function growShape(rng: RandomSource, count: number): { x: number; y: number }[] {
  const cells = [{ x: 0, y: 0 }];
  while (cells.length < count) {
    const next = add(pick(rng, cells), pick(rng, DIRS));
    if (!cells.some((c) => samePos(c, next))) cells.push(next);
  }
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  return cells.map((c) => ({ x: c.x - minX, y: c.y - minY }));
}

function drawLayout(rng: RandomSource, count: number, tiles: Record<string, TileDef>): TileLayout {
  const shape = growShape(rng, count);
  const numbers = shuffle(rng, TILE_NUMBERS).slice(0, count);
  const placements = shape.map((cell, i) => {
    const faces = TILE_FACES.filter((f) => tiles[`${numbers[i]}${f}`]);
    if (faces.length === 0) throw new Error(`La tuile ${numbers[i]} n'est définie sur aucune face.`);
    return { tileId: `${numbers[i]}${pick(rng, faces)}`, tx: cell.x, ty: cell.y, rotation: pick(rng, [0, 90, 180, 270] as const) as Rotation };
  });
  return { tilesW: Math.max(...shape.map((c) => c.x)) + 1, tilesH: Math.max(...shape.map((c) => c.y)) + 1, placements };
}

interface Door {
  id: string;
  a: Position;
  b: Position;
  open: boolean;
}

/** Une tentative de scénario ; renvoie `null` quand le tirage ne tient pas debout (trop peu de place, case inaccessible…). */
function attempt(rng: RandomSource, count: number, seed: number, level: GeneratedLevel, avoidChiefs: readonly string[], content: Pick<Content, 'monsters' | 'tiles'>, wantedObjective?: ObjectiveKind): ScenarioDefinition | null {
  const tiles = content.tiles ?? {};
  const layout = drawLayout(rng, count, tiles);
  const bare = boardFromLayout(tiles, layout);
  const { width, height } = layoutExtent(layout);

  const present = (p: Position) => p.x >= 0 && p.y >= 0 && p.x < width && p.y < height && !bare.holes.some((h) => samePos(h, p));
  const inside = (p: Position) => [...(bare.interior ?? []), ...(bare.rooms ?? [])].some((c) => samePos(c, p));
  const walled = new Set(bare.walls.map(([a, b]) => edgeKey(a, b)));
  const wallBetween = (a: Position, b: Position) => walled.has(edgeKey(a, b));

  // Bâtiments et salles : groupes de cases reliées sans mur ; chacun a des arêtes de sortie vers la rue.
  const insideCells = [...(bare.interior ?? []), ...(bare.rooms ?? [])];
  const seen = new Set<string>();
  const groups: { cells: Position[]; exits: Edge[] }[] = [];
  for (const start of insideCells) {
    if (seen.has(key(start))) continue;
    const cells = [start];
    seen.add(key(start));
    for (let i = 0; i < cells.length; i++) {
      for (const d of DIRS) {
        const n = add(cells[i]!, d);
        if (present(n) && inside(n) && !seen.has(key(n)) && !wallBetween(cells[i]!, n)) {
          seen.add(key(n));
          cells.push(n);
        }
      }
    }
    const exits: Edge[] = [];
    for (const c of cells) for (const d of DIRS) {
      const n = add(c, d);
      if (present(n) && !inside(n) && wallBetween(c, n)) exits.push([c, n]);
    }
    groups.push({ cells, exits });
  }
  const streets: Position[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (present({ x, y }) && !inside({ x, y })) streets.push({ x, y });
  if (streets.length < 4) return null;
  // Sur un petit terrain, on ne peut pas exiger les mêmes distances que sur un grand : monstres et jetons restent au moins à `far` cases du départ.
  const far = count <= 1 ? 1 : count === 2 ? 2 : 3;

  // Départ des héros : la zone de départ d'une tuile (3 cases d'un même bâtiment) avec une porte ouverte pour en sortir ;
  // à défaut, trois cases de rue côte à côte.
  const doors: Door[] = [];
  const addDoor = (e: Edge, open: boolean) => doors.push({ id: `porte-${doors.length + 1}`, a: e[0], b: e[1], open });
  let starts: Position[] = [];
  let startGroup: (typeof groups)[number] | null = null;
  const zones = layout.placements
    .map((pl) => layoutHeroStarts(tiles, { ...layout, placements: [pl] }))
    .map((zone) => ({ zone, group: groups.find((g) => zone.length > 0 && zone.every((c) => g.cells.some((x) => samePos(x, c)))) }))
    .filter((z) => z.zone.length >= 3 && z.group && z.group.exits.length > 0);
  if (zones.length > 0) {
    const z = pick(rng, zones);
    starts = shuffle(rng, z.zone).slice(0, 3);
    startGroup = z.group!;
    addDoor(pick(rng, startGroup.exits), true);
  } else {
    const base = pick(rng, streets);
    const around = shuffle(rng, DIRS.map((d) => add(base, d)).filter((p) => streets.some((s) => samePos(s, p))));
    if (around.length < 2) return null;
    starts = [base, around[0]!, around[1]!];
  }

  // Les autres bâtiments : un pion porte sur leur contour, fermé le plus souvent.
  const others = groups.filter((g) => g !== startGroup && g.exits.length > 0);
  for (const g of others) {
    if (doors.length >= DOOR_TOKENS) break;
    addDoor(pick(rng, g.exits), rng.nextInt(0, 3) === 0);
  }

  // Jetons Spawn : jusqu'à 5, sur des cases de rue distinctes, loin du départ.
  const free = (p: Position) => !starts.some((s) => samePos(s, p));
  // Pas forcément les 5 : le scénario en pose de 1 à 5 (au moins un, sinon les monstres n'agiraient jamais).
  const wanted = rng.nextInt(1, SPAWN_TOKEN_TYPES.length);
  const spawnCells = shuffle(rng, streets.filter((p) => free(p) && starts.every((s) => dist(s, p) >= far))).slice(0, wanted);
  if (spawnCells.length === 0) return null;
  const tokens = shuffle(rng, SPAWN_TOKEN_TYPES).slice(0, spawnCells.length);

  // Monstres : des Orc Marauder (les seuls dont le niveau 1 est saisi), sur la rue et dans les bâtiments dotés d'une porte.
  const closedGroups = others.filter((g) => doors.some((d) => g.exits.some(([a, b]) => samePos(a, d.a) && samePos(b, d.b))));
  const roomy = [...streets, ...closedGroups.flatMap((g) => g.cells)].filter((p) => starts.every((s) => dist(s, p) >= far) && !spawnCells.some((c) => samePos(c, p)));
  const total = Math.min(8, Math.max(2, count + 1));
  // Le bestiaire du niveau choisi (les monstres dont les statistiques existent à ce niveau), dans les limites des boîtes : 8 Orcs
  // (Marauder et Captain), 1 Minotaur, 1 Troll, 2 Spear Beastman, 2 Hammer Beastman, et 6 Goblin Archer au niveau 2-3.
  const roster = Object.values(content.monsters).filter((d) => monsterStats(d, level));
  const inPlay = new Map<string, number>();
  const take = (d: MonsterDefinition) => inPlay.set(d.id, (inPlay.get(d.id) ?? 0) + 1);
  const available = (d: MonsterDefinition) => boxRemaining(d, content.monsters, inPlay) > 0;
  // Le chef est un vilain (Minotaur ou Troll) ; à défaut un Orc Captain, puis le premier monstre du niveau.
  const villains = roster.filter((d) => d.kind === 'villain');
  // `avoidChiefs` : des chefs à éviter quand c'est possible (une campagne varie ses vilains d'un chapitre à l'autre).
  const fresh = villains.filter((d) => !avoidChiefs.includes(d.id));
  const chiefDef = villains.length > 0 ? pick(rng, fresh.length > 0 ? fresh : villains) : (roster.find((d) => d.id === 'OC') ?? roster[0]);
  if (!chiefDef) return null;
  take(chiefDef);
  // Les autres : surtout des Orc Marauder, avec des Orc Captain et des Beastmen, tant que les boîtes le permettent.
  const WEIGHT: Record<string, number> = { OM: 4, OC: 2, GA: 2, SB: 1, HB: 1 };
  const crew: MonsterDefinition[] = [];
  while (crew.length < total - 1) {
    const pool = roster.filter((d) => d.kind !== 'villain' && available(d));
    if (pool.length === 0) break;
    const draw = rng.nextInt(1, pool.reduce((sum, d) => sum + (WEIGHT[d.id] ?? 1), 0));
    let acc = 0;
    const next = pool.find((d) => (acc += WEIGHT[d.id] ?? 1) >= draw) ?? pool[0]!;
    take(next);
    crew.push(next);
  }
  const chiefPool = closedGroups.flatMap((g) => g.cells).filter((p) => starts.every((s) => dist(s, p) >= far));
  const chiefAt = chiefPool.length > 0 ? pick(rng, chiefPool) : [...roomy].sort((a, b) => Math.min(...starts.map((s) => dist(s, b))) - Math.min(...starts.map((s) => dist(s, a))))[0];
  if (!chiefAt) return null;
  const spots = shuffle(rng, roomy.filter((p) => !samePos(p, chiefAt))).slice(0, crew.length);
  if (spots.length < crew.length || crew.length < 1) return null;
  const counters: Record<string, number> = {};
  const idFor = (d: MonsterDefinition) => `${d.id}${(counters[d.id] = (counters[d.id] ?? 0) + 1)}`;
  const monsters = [
    ...spots.map((at, i) => ({ id: idFor(crew[i]!), definitionId: crew[i]!.id, at, ...(rng.nextInt(0, 2) === 0 ? { guard: true } : {}) })),
    { id: idFor(chiefDef), definitionId: chiefDef.id, at: chiefAt, guard: true },
  ];

  // Objectif : un type tiré au hasard parmi la dizaine du catalogue (voir `objectives.ts`) ; le chef reste sur le plateau.
  const chiefId = monsters[monsters.length - 1]!.id;
  const farFromStart = (p: Position) => starts.every((st) => dist(st, p) >= far);
  const objective = drawObjective(
    {
      rng,
      tileCount: count,
      starts,
      monsters,
      chiefId,
      chiefName: chiefDef.name,
      chiefAt,
      nameOf: (id) => content.monsters[id]?.name ?? id,
      closed: closedGroups.flatMap((g) => g.cells).filter((p) => farFromStart(p) && !samePos(p, chiefAt)),
      open: roomy.filter((p) => !samePos(p, chiefAt)),
      streets,
      doors,
      far,
    },
    wantedObjective,
  );
  if (!objective) return null;
  // Des événements aléatoires (tirés à chaque partie) : de la surprise quand on rejoue le même scénario.
  const eventRounds = count <= 2 ? [3] : count <= 5 ? [2, 4] : [2, 4, 6];
  const script: Rule[] = [
    ...objective.rules,
    ...eventRounds.map((round, i): Rule => ({ id: `evenement-${i + 1}`, when: [{ type: 'round-reached', round }], then: [{ type: 'random-event' }] })),
  ];
  const objectiveCells = objective.quests.flatMap((q) => (q.at ? [q.at] : []));

  const e = (a: Position, b: Position) => `${a.x},${a.y}-${b.x},${b.y}`;
  const board = [
    `size ${width}x${height}`,
    ...doors.map((d) => `door ${d.id} ${e(d.a, d.b)} ${d.open ? 'open' : 'closed'}${d.id === objective.specialDoorId ? ' special' : ''}`),
    ...spawnCells.map((c, i) => `spawn S${i + 1} ${c.x},${c.y} ${tokens[i]![0]}+${tokens[i]![1]}`),
  ].join('\n');

  const def: ScenarioDefinition = {
    id: level === '1' ? `aleatoire-${seed}` : `aleatoire-${level}-${seed}`,
    title: `Scénario aléatoire · ${count} tuile${count > 1 ? 's' : ''}${level === '1' ? '' : ` · niveau ${level}`}`,
    tagline: objective.tagline,
    recommended: 'medium',
    generated: true,
    story: {
      intro: [pick(rng, INTRO_OPENING), pick(rng, INTRO_HOOK), objective.intro],
      win: [pick(rng, WIN)],
      lose: [pick(rng, LOSE)],
    },
    tiles: layout,
    board,
    heroStarts: starts,
    monsters,
    quests: objective.quests,
    script,
    monsterCardSet: level,
    deck: { listedMonsterIds: [...new Set(monsters.map((m) => m.definitionId))] },
  };

  // À partir de 5 tuiles, le terrain est assez grand pour des portails : un couple violet qui relie le départ à l'autre bout du
  // plateau, et à partir de 7 tuiles un couple bleu en plus (raccourcis entre zones lointaines). Jetons violets et bleus : 8 au plus.
  if (count >= MIN_PORTAL_TILES) {
    const flat = scenarioBoard(def, content).board;
    const walk = walkDistances(flat, starts);
    const taken = new Set([...starts, ...monsters.map((m) => m.at), ...objectiveCells, chiefAt, ...spawnCells].map(key));
    const cells = [...walk.entries()].map(([k, d]) => ({ p: { x: Number(k.split(',')[0]), y: Number(k.split(',')[1]) }, d })).filter((c) => !taken.has(key(c.p)));
    const maxD = Math.max(...cells.map((c) => c.d), 0);
    const portalLines: string[] = [];
    const place = (color: string, near: (c: { p: Position; d: number }) => boolean, far: (c: { p: Position; d: number }) => boolean, apart: Position[] = []) => {
      const a = cells.filter((c) => near(c) && !taken.has(key(c.p)));
      const b = cells.filter((c) => far(c) && !taken.has(key(c.p)) && apart.every((q) => dist(q, c.p) >= 4));
      if (a.length === 0 || b.length === 0) return;
      const from = pick(rng, a);
      taken.add(key(from.p));
      const to = pick(rng, b.filter((c) => dist(c.p, from.p) >= 4).length > 0 ? b.filter((c) => dist(c.p, from.p) >= 4) : b);
      taken.add(key(to.p));
      portalLines.push(`portal portail-${portalLines.length + 1} ${from.p.x},${from.p.y} ${color}`, `portal portail-${portalLines.length + 2} ${to.p.x},${to.p.y} ${color}`);
    };
    if (maxD >= 5) place('violet', (c) => c.d >= 1 && c.d <= 3, (c) => c.d >= Math.ceil(maxD * 0.8));
    if (count >= MIN_BLUE_PORTAL_TILES && maxD >= 8) {
      const violetCells = portalLines.map((l) => ({ x: Number(l.split(' ')[2]!.split(',')[0]), y: Number(l.split(' ')[2]!.split(',')[1]) }));
      place('blue', (c) => c.d >= Math.floor(maxD * 0.3) && c.d <= Math.ceil(maxD * 0.5), (c) => c.d >= Math.ceil(maxD * 0.65), violetCells);
    }
    if (portalLines.length > 0) def.board = [def.board, ...portalLines].join(String.fromCharCode(10));
  }

  // Le scénario doit être valide et tout doit être atteignable depuis le départ (une porte, fermée ou ouverte, se franchit).
  if (validateScenario(def, content).length > 0) return null;
  const built = scenarioBoard(def, content).board;
  const reach = new Set<string>(starts.map(key));
  const queue = [...starts];
  const doorEdges = new Set(built.doors.map((d) => edgeKey(d.a, d.b)));
  const wallEdges = new Set(built.walls.map(([a, b]) => edgeKey(a, b)));
  for (let i = 0; i < queue.length; i++) {
    for (const d of DIRS) {
      const n = add(queue[i]!, d);
      if (n.x < 0 || n.y < 0 || n.x >= built.width || n.y >= built.height || built.holes.some((h) => samePos(h, n)) || reach.has(key(n))) continue;
      if (wallEdges.has(edgeKey(queue[i]!, n)) && !doorEdges.has(edgeKey(queue[i]!, n))) continue;
      reach.add(key(n));
      queue.push(n);
    }
  }
  const needed = [...monsters.map((m) => m.at), ...objectiveCells, ...spawnCells];
  if (!needed.every((p) => reach.has(key(p)))) return null;
  return def;
}

/** Niveaux de monstres proposés par le mode aléatoire : ceux dont les statistiques sont saisies dans `monsters.json`. */
export const GENERATED_LEVELS = ['1', '2-3', '4-5', '6'] as const;
export type GeneratedLevel = (typeof GENERATED_LEVELS)[number];

/** Génère un scénario de `tileCount` tuiles (1 à 9) avec des monstres du niveau `level` (1 par défaut). Même graine et même niveau, même scénario ; lève une erreur lisible si aucun tirage ne convient. */
export function generateScenario(opts: { tileCount: number; seed: number; level?: GeneratedLevel; avoidChiefs?: readonly string[]; objective?: ObjectiveKind }, content: Pick<Content, 'monsters' | 'tiles'>): ScenarioDefinition {
  const level = opts.level ?? '1';
  if (!GENERATED_LEVELS.includes(level)) throw new Error(`Niveau « ${String(level)} » inconnu : choisissez ${GENERATED_LEVELS.join(' ou ')}.`);
  if (!Object.values(content.monsters).some((d) => monsterStats(d, level))) throw new Error(`Aucun monstre n'a de statistiques au niveau ${level} : renseignez-les dans monsters.json.`);
  const count = Math.round(opts.tileCount);
  if (!Number.isFinite(count) || count < MIN_GENERATED_TILES || count > MAX_GENERATED_TILES) {
    throw new Error(`Le nombre de tuiles doit être compris entre ${MIN_GENERATED_TILES} et ${MAX_GENERATED_TILES}.`);
  }
  if (!content.tiles || Object.keys(content.tiles).length === 0) throw new Error("Aucune tuile n'est définie : définissez les tuiles dans l'éditeur avant de générer un scénario.");
  const rng = createSeededRandom(opts.seed);
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const def = attempt(rng, count, opts.seed, level, opts.avoidChiefs ?? [], content, opts.objective);
    if (def) return def;
  }
  throw new Error(`Aucun scénario viable n'a été trouvé avec ${count} tuile${count > 1 ? 's' : ''} : essayez un autre nombre de tuiles.`);
}

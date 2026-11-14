import { type } from 'arktype';
import { ExpansionSchema, type GameState } from './domain/schemas';
import { parse } from './domain/validate';
import { shuffle, type RandomSource } from './random';

export const CAMPAIGN_SCHEMA_VERSION = 1;

export type Stage = 'outer' | 'inner' | 'final';

/** 3 scénarios dans l'Outer Circle, 2 dans l'Inner Circle, puis le Final Showdown (solo v1.3 p.1). */
export const STAGE_BY_RANK: Record<number, Stage> = { 1: 'outer', 2: 'outer', 3: 'outer', 4: 'inner', 5: 'inner', 6: 'final' };

export const ScenarioResultSchema = type({
  scenarioId: 'string',
  rank: 'number.integer',
  won: 'boolean',
  deaths: 'number.integer',
  coinsWon: 'number.integer',
  deathsByHero: { '[string]': 'number.integer' },
});
export type ScenarioResult = typeof ScenarioResultSchema.infer;

export const CampaignSchema = type({
  schemaVersion: type.unit(CAMPAIGN_SCHEMA_VERSION),
  id: 'string',
  name: 'string',
  contentVersion: 'string',
  expansions: ExpansionSchema.array(),
  heroIds: 'string[] == 3',
  /** Jeu de cartes Monster par rang de scénario (ex. 1 → « 1 », 3 → « 2-3 ») : à renseigner selon le matériel. */
  cardSetByRank: { '[string]': 'string' },
  results: ScenarioResultSchema.array(),
  /** Cartes d'amélioration possédées (noms ou codes), 12 au maximum. */
  cards: 'string[]',
  savedCoin: '0 <= number.integer <= 1',
  /** Malédiction retenue par héros pour le prochain scénario. */
  curses: { '[string]': 'string | null' },
  /** Phase d'amélioration en attente après un scénario terminé. */
  pendingUpgrade: type({
    won: 'boolean',
    coinsWon: 'number.integer',
    revealCount: 'number.integer',
    dragonPart1Next: 'boolean',
  }).or('null'),
});
export type Campaign = typeof CampaignSchema.infer;

export const MAX_UPGRADE_CARDS = 12;
export const MAX_PURCHASES = 3;

export function createCampaign(p: {
  id: string;
  name: string;
  contentVersion: string;
  heroIds: string[];
  expansions?: Campaign['expansions'];
  cardSetByRank?: Record<string, string>;
}): Campaign {
  return parse(CampaignSchema, {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    id: p.id,
    name: p.name,
    contentVersion: p.contentVersion,
    expansions: p.expansions ?? [],
    heroIds: p.heroIds,
    // Seuls les rangs 1 (« 1 ») et 3 (« 2-3 ») sont cités par le livret de base (p.10) ; les autres sont à saisir.
    cardSetByRank: p.cardSetByRank ?? { '1': '1', '3': '2-3' },
    results: [],
    cards: [],
    savedCoin: 0,
    curses: Object.fromEntries(p.heroIds.map((h) => [h, null])),
    pendingUpgrade: null,
  });
}

export const nextRank = (c: Campaign): number => c.results.length + 1;
export const isFinished = (c: Campaign): boolean => c.results.length >= 6;
export const currentStage = (c: Campaign): Stage => STAGE_BY_RANK[Math.min(nextRank(c), 6)]!;

export function monsterCardSetFor(c: Campaign, rank = nextRank(c)): string {
  const set = c.cardSetByRank[String(rank)];
  if (!set) throw new Error(`Jeu de cartes Monster non renseigné pour le scénario n°${rank} (campagne ${c.name})`);
  return set;
}

/** Vérifie qu'un scénario peut être joué à ce stade (non déjà joué ; étape imposée par le rang). */
export function assertCanPlay(c: Campaign, scenarioId: string, stageOfScenario: Stage): void {
  if (c.pendingUpgrade) throw new Error("Phase d'amélioration à terminer avant le prochain scénario");
  if (isFinished(c)) throw new Error('Campagne terminée');
  if (c.results.some((r) => r.scenarioId === scenarioId)) throw new Error(`Scénario déjà joué : ${scenarioId}`);
  if (stageOfScenario !== currentStage(c)) {
    throw new Error(`Ce scénario appartient à l'étape ${stageOfScenario}, l'étape courante est ${currentStage(c)}`);
  }
}

/** Fin de scénario (victoire ou défaite : la campagne continue dans tous les cas, solo v1.3 p.1). */
export function finishScenario(c: Campaign, g: GameState): Campaign {
  if (g.phase !== 'SCENARIO_WON' && g.phase !== 'SCENARIO_LOST') throw new Error('Le scénario n est pas terminé');
  const won = g.phase === 'SCENARIO_WON';
  const rank = nextRank(c);
  const result: ScenarioResult = {
    scenarioId: g.scenarioId,
    rank,
    won,
    deaths: g.deaths,
    coinsWon: g.coins + g.quests.filter((q) => q.done).length,
    deathsByHero: Object.fromEntries(g.heroes.map((h) => [h.id, h.deaths])),
  };
  // Pièces : monstres tués (déjà cumulées) + 1 pièce par quête accomplie en fin de scénario (rulebook p.23-24).
  // Le « First Bonus » est ignoré en solo mais la pièce de la quête reste acquise (solo v1.3 p.6).
  const reveal = upgradeRevealCount(won, result.coinsWon);
  return parse(CampaignSchema, {
    ...c,
    results: [...c.results, result],
    pendingUpgrade: { won, coinsWon: result.coinsWon, revealCount: reveal, dragonPart1Next: false },
  });
}

/** Solo v1.3 p.7 : victoire = 8 cartes + 3 par tranche de 5 pièces gagnées ; défaite = 6 cartes. */
export function upgradeRevealCount(won: boolean, coinsWon: number): number {
  return won ? 8 + 3 * Math.floor(coinsWon / 5) : 6;
}

export interface Purchase {
  card: string;
  cost: number;
}

/**
 * Achats de la phase d'amélioration : 3 cartes maximum, pièces dépensées normalement, 1 pièce économisable,
 * 12 cartes au plus (rulebook p.24). Les Death Curses sont appliquées séparément.
 */
export function applyUpgradePhase(c: Campaign, purchases: Purchase[], discard: string[] = []): Campaign {
  if (!c.pendingUpgrade) throw new Error("Aucune phase d'amélioration en attente");
  if (purchases.length > MAX_PURCHASES) throw new Error(`${MAX_PURCHASES} achats au maximum`);
  const available = c.pendingUpgrade.coinsWon + c.savedCoin;
  const spent = purchases.reduce((n, p) => n + p.cost, 0);
  if (spent > available) throw new Error(`Pièces insuffisantes : ${spent} demandées pour ${available}`);
  const cards = [...c.cards.filter((x) => !discard.includes(x)), ...purchases.map((p) => p.card)];
  if (cards.length > MAX_UPGRADE_CARDS) {
    throw new Error(`${cards.length} cartes : défaussez-en ${cards.length - MAX_UPGRADE_CARDS} (maximum ${MAX_UPGRADE_CARDS})`);
  }
  return parse(CampaignSchema, {
    ...c,
    cards,
    savedCoin: Math.min(1, available - spent),
    pendingUpgrade: null,
  });
}

export interface DeathCurse {
  id: string;
  value: number;
}

/**
 * Death Curses (rulebook p.24) : chaque héros ayant des jetons Death pioche autant de cartes que de jetons
 * et garde la plus haute valeur. Les montures ne reçoivent pas de malédiction.
 */
export function drawDeathCurses(
  deathsByHero: Record<string, number>,
  deck: DeathCurse[],
  rng: RandomSource,
): Record<string, DeathCurse | null> {
  const out: Record<string, DeathCurse | null> = {};
  for (const [heroId, n] of Object.entries(deathsByHero)) {
    if (n <= 0) {
      out[heroId] = null;
      continue;
    }
    const drawn = shuffle(deck, rng).slice(0, n);
    out[heroId] = drawn.reduce<DeathCurse | null>((best, c) => (!best || c.value > best.value ? c : best), null);
  }
  return out;
}

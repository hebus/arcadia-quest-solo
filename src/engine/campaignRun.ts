import { type } from 'arktype';
import type { GameState } from './domain/schemas';
import { parse } from './domain/validate';

/**
 * Progression d'une petite campagne (suite ordonnée de chapitres, chacun un scénario) jouée avec la même guilde de 3 héros.
 * Le chapitre suivant se déverrouille quand le précédent est gagné ; les pièces d'or (PO) gagnées par la guilde se cumulent
 * d'un chapitre à l'autre. La phase d'amélioration (cartes) reste physique : l'application ne suit que les chapitres et les PO.
 */

export const RunAttemptSchema = type({
  /** Une partie ne compte qu'une fois : le résultat est enregistré par identifiant de partie. */
  sessionId: 'string',
  /** Rang du chapitre, à partir de 0. */
  chapter: 'number.integer >= 0',
  scenarioId: 'string',
  won: 'boolean',
  /** PO gagnés pendant cette partie : monstres tués + une pièce par quête accomplie (comme à la fin d'un scénario). */
  coinsWon: 'number.integer >= 0',
  deaths: 'number.integer >= 0',
  /** Cartes Récompense gagnées pendant cette partie (identifiants de carte). */
  'rewards?': 'string[] | undefined',
});
export type RunAttempt = typeof RunAttemptSchema.infer;

export const CampaignRunSchema = type({
  campaignId: 'string',
  startedAt: 'number',
  attempts: RunAttemptSchema.array(),
});
export type CampaignRun = typeof CampaignRunSchema.infer;

export type ChapterState = 'locked' | 'todo' | 'retry' | 'won';

export interface ChapterProgress {
  chapter: number;
  scenarioId: string;
  state: ChapterState;
  /** PO gagnés à ce chapitre, toutes parties comprises. */
  coinsWon: number;
  attempts: number;
}

export function startRun(campaignId: string, now: number = Date.now()): CampaignRun {
  return { campaignId, startedAt: now, attempts: [] };
}

/** Relit une progression enregistrée ; toute donnée invalide (ou d'une autre campagne) donne `null`. */
export function parseRun(raw: unknown, campaignId: string): CampaignRun | null {
  if (raw === undefined || raw === null) return null;
  try {
    const run = parse(CampaignRunSchema, raw);
    return run.campaignId === campaignId ? run : null;
  } catch {
    return null;
  }
}

/** PO gagnés par un jeu terminé : monstres tués + une pièce par quête accomplie. */
export const coinsOfGame = (g: Pick<GameState, 'coins' | 'quests'>): number => g.coins + g.quests.filter((q) => q.done).length;

/** État de chaque chapitre : verrouillé tant que le précédent n'est pas gagné, à rejouer après une défaite. */
export function chapterProgress(run: CampaignRun | null, chapterIds: readonly string[]): ChapterProgress[] {
  let previousWon = true;
  return chapterIds.map((scenarioId, chapter) => {
    const attempts = (run?.attempts ?? []).filter((a) => a.chapter === chapter);
    const won = attempts.some((a) => a.won);
    const state: ChapterState = !run || !previousWon ? 'locked' : won ? 'won' : attempts.length > 0 ? 'retry' : 'todo';
    previousWon = previousWon && won;
    return { chapter, scenarioId, state, coinsWon: attempts.reduce((n, a) => n + a.coinsWon, 0), attempts: attempts.length };
  });
}

/** Cumul des PO gagnés par la guilde depuis le début de la campagne. */
/** Cartes Récompense gagnées par la guilde pendant la campagne (parties gagnées ou perdues : le butin est ramassé en route). */
export const runRewards = (run: CampaignRun | null): string[] => (run?.attempts ?? []).flatMap((a) => a.rewards ?? []);

export const totalGold = (run: CampaignRun | null): number => (run?.attempts ?? []).reduce((n, a) => n + a.coinsWon, 0);

/** Le prochain chapitre à jouer (le premier non gagné), ou `null` quand la campagne est terminée. */
export function nextChapter(run: CampaignRun | null, chapterIds: readonly string[]): number | null {
  if (!run) return null;
  const next = chapterProgress(run, chapterIds).find((c) => c.state !== 'won');
  return next ? next.chapter : null;
}

export const isRunComplete = (run: CampaignRun | null, chapterIds: readonly string[]): boolean => !!run && chapterIds.length > 0 && chapterProgress(run, chapterIds).every((c) => c.state === 'won');

/**
 * Enregistre la fin d'une partie dans la campagne. Sans effet si la partie n'est pas terminée, n'appartient à aucun chapitre,
 * appartient à un chapitre encore verrouillé, ou a déjà été enregistrée (une partie ne compte qu'une fois).
 */
export function recordAttempt(run: CampaignRun, chapterIds: readonly string[], g: Pick<GameState, 'sessionId' | 'scenarioId' | 'phase' | 'coins' | 'quests' | 'deaths'> & Partial<Pick<GameState, 'rewards'>>): CampaignRun {
  if (g.phase !== 'SCENARIO_WON' && g.phase !== 'SCENARIO_LOST') return run;
  const chapter = chapterIds.indexOf(g.scenarioId);
  if (chapter < 0) return run;
  if (run.attempts.some((a) => a.sessionId === g.sessionId)) return run;
  const state = chapterProgress(run, chapterIds)[chapter]!.state;
  if (state === 'locked' || state === 'won') return run; // un chapitre verrouillé ne peut pas compter ; un chapitre gagné ne se rejoue pas ici
  const attempt: RunAttempt = { sessionId: g.sessionId, chapter, scenarioId: g.scenarioId, won: g.phase === 'SCENARIO_WON', coinsWon: coinsOfGame(g), deaths: g.deaths, ...(g.rewards?.length ? { rewards: g.rewards.map((r) => r.cardId) } : {}) };
  return { ...run, attempts: [...run.attempts, attempt] };
}

/** Une campagne est « en cours » quand elle est commencée et pas terminée : l'abandonner demande une confirmation. */
export const runInProgress = (run: CampaignRun | null, chapterIds: readonly string[]): boolean => !!run && !isRunComplete(run, chapterIds);

import { DEFEAT_THRESHOLD, type DecisionTrace, type GameState, type Phase } from './domain/schemas';

export const cloneState = (s: GameState): GameState => structuredClone(s);

/** Ajoute un événement au journal (état mutable : à appeler sur un clone). */
export function log(
  s: GameState,
  type: string,
  message: string,
  data?: Record<string, unknown>,
  trace?: DecisionTrace,
): void {
  s.eventSeq += 1;
  s.events.push({ seq: s.eventSeq, round: s.round, phase: s.phase, type, message, data, trace });
}

export const defeatThreshold = (s: GameState): number => DEFEAT_THRESHOLD[s.difficulty];

/** Un seul héros est activé par Guild Turn (le même d'un tour à l'autre est permis) : livret de base, et Dragon Partie 2. */
export const oneHeroPerTurn = (s: GameState): boolean => s.dragonPart2 || s.settings.heroActivation === 'one';

/** Un autre héros que `heroId` a déjà été activé ce tour : en mode « un héros par tour », il ne peut plus agir. */
export const blockedByOtherHero = (s: GameState, heroId: string): boolean =>
  oneHeroPerTurn(s) && s.activatedHeroIds.some((id) => id !== heroId && s.heroes.some((h) => h.id === id));

export const questsDone = (s: GameState): number => s.quests.filter((q) => q.done).length;

export function isTerminal(phase: Phase): boolean {
  return phase === 'SCENARIO_WON' || phase === 'SCENARIO_LOST';
}

/**
 * Vérifie les conditions de fin (solo v1.3 p.1). La défaite est testée en premier : si le seuil de morts
 * est atteint, le scénario est perdu même si la dernière quête est accomplie dans le même événement.
 * Dragon Partie 2 : conditions propres au dragon, gérées par le scénario (non évaluées ici).
 */
export function checkEnd(s: GameState): void {
  if (isTerminal(s.phase) || s.dragonPart2) return;
  if (s.deaths >= defeatThreshold(s)) {
    s.phase = 'SCENARIO_LOST';
    log(s, 'scenario-lost', `Défaite : ${s.deaths} mort(s) pour un seuil de ${defeatThreshold(s)}.`);
  } else if (questsDone(s) >= s.questsRequired) {
    s.phase = 'SCENARIO_WON';
    log(s, 'scenario-won', `Victoire : ${questsDone(s)} quête(s) PvE accomplie(s).`);
  }
}

export function completeQuest(s: GameState, questId: string): void {
  const q = s.quests.find((x) => x.id === questId);
  if (!q) throw new Error(`Quête inconnue : ${questId}`);
  if (q.done) throw new Error(`Quête déjà accomplie : ${questId} (une seule fois par scénario)`);
  q.done = true;
  log(s, 'quest-completed', `Quête accomplie : ${q.title}`, { questId });
  checkEnd(s);
}

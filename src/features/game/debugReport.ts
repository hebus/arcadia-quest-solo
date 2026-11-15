import { useGameStore } from '@/stores/gameStore';

/**
 * Rapport de débogage du terrain d'essai, à coller dans une conversation : tout ce qu'il faut pour reproduire la situation.
 * Rejouer : repartir de `startState` (ou `createGame(startConfig)`), puis appliquer `actionLog` dans l'ordre (les entrées
 * de profondeur > 0 sont déclenchées par la précédente) ; `rngSeed` et `rngCounter` rendent les tirages identiques. Les saisies
 * physiques (dés, cartes) sont dans `answers` / `awaiting`.
 */
export function buildDebugReport(): string {
  const st = useGameStore.getState();
  const g = st.game;
  const report = {
    format: 'aq-solo-debug',
    version: 1,
    exportedAt: new Date().toISOString(),
    howToReplay: "Partir de startState (ou createGame(startConfig, content)) puis appliquer actionLog dans l'ordre ; les entrées de depth > 0 sont déclenchées par l'entrée précédente. rngSeed et rngCounter rendent les tirages identiques ; les saisies physiques sont dans awaiting / answers.",
    scenarioId: g?.scenarioId ?? null,
    startConfig: st.startConfig,
    settings: g?.settings ?? null,
    dice: { attackDie: st.content.attackDie, defenseDie: st.content.defenseDie },
    startState: st.logStart,
    actionLog: st.actionLog,
    current: g && {
      phase: g.phase,
      round: g.round,
      rngSeed: g.rngSeed,
      rngCounter: g.rngCounter,
      error: st.error,
      agent: st.agent,
      answers: st.answers,
      pendingInstructions: st.instructions.filter((i) => !i.confirmed),
      allInstructions: st.instructions,
      correctionMode: st.correctionMode,
      selectedId: st.selectedId,
      traces: st.traces,
    },
    events: g?.events ?? [],
    state: g,
  };
  return JSON.stringify(report, null, 1);
}

/** Copie dans le presse-papiers ; renvoie false si le navigateur refuse (le texte est alors à copier à la main). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

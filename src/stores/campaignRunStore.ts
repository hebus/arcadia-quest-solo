import { create } from 'zustand';
import { parseRun, recordAttempt, startRun, type CampaignRun } from '@/engine/campaignRun';
import type { GameState } from '@/engine/domain/schemas';
import { CHUTE_DES_BRAISES } from '@/game-data/original/campaigns/chute-des-braises';
import type { Repository } from '@/infrastructure/persistence/repository';

const PREF = 'campaign-run';
export const CAMPAIGN = CHUTE_DES_BRAISES;
export const CHAPTER_IDS = CAMPAIGN.chapters.map((c) => c.scenarioId);

let repo: Repository | null = null;
export const setCampaignRunRepository = (r: Repository | null): void => {
  repo = r;
};

interface CampaignRunStore {
  run: CampaignRun | null;
  loaded: boolean;
  load(): Promise<void>;
  /** Commence la campagne (ou la recommence : la progression est effacée). */
  start(): void;
  /** Enregistre la fin d'une partie dans la campagne si elle appartient à un chapitre ; sans effet sinon. */
  record(g: GameState): void;
  reset(): void;
}

/** Progression de la petite campagne, gardée sur l'appareil (préférences) d'un lancement à l'autre. */
export const useCampaignRunStore = create<CampaignRunStore>()((set, get) => {
  const persist = () => void repo?.setPref(PREF, get().run).catch(() => undefined);
  return {
    run: null,
    loaded: false,
    async load() {
      try {
        const saved = await repo?.getPref<unknown>(PREF);
        set({ run: parseRun(saved, CAMPAIGN.id) });
      } catch {
        // pas de stockage : la progression reste en mémoire
      }
      set({ loaded: true });
    },
    start() {
      set({ run: startRun(CAMPAIGN.id) });
      persist();
    },
    record(g) {
      const run = get().run;
      if (!run) return;
      const next = recordAttempt(run, CHAPTER_IDS, g);
      if (next === run) return;
      set({ run: next });
      persist();
    },
    reset() {
      set({ run: null });
      persist();
    },
  };
});

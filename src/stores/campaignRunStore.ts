import { create } from 'zustand';
import { parseRun, recordAttempt, startRun, type CampaignRun } from '@/engine/campaignRun';
import { generateCampaign, parseGeneratedCampaign, type GeneratedCampaign } from '@/engine/scenario/generateCampaign';
import { ORIGINAL_CONTENT } from '@/game-data/original';
import type { GameState } from '@/engine/domain/schemas';
import { CHUTE_DES_BRAISES } from '@/game-data/original/campaigns/chute-des-braises';
import { SIEGE_DE_VAL_NOIR } from '@/game-data/original/campaigns/siege-de-val-noir';
import type { Repository } from '@/infrastructure/persistence/repository';

const PREF = 'campaign-run';
const PREF_RANDOM = 'campaign-random';
const PREF_MEDIUM = 'campaign-medium';
export const CAMPAIGN = CHUTE_DES_BRAISES;
export const CHAPTER_IDS = CAMPAIGN.chapters.map((c) => c.scenarioId);
/** La campagne moyenne de 5 chapitres écrits à la main. */
export const MEDIUM_CAMPAIGN = SIEGE_DE_VAL_NOIR;
export const MEDIUM_IDS = MEDIUM_CAMPAIGN.chapters.map((c) => c.scenarioId);

let repo: Repository | null = null;
export const setCampaignRunRepository = (r: Repository | null): void => {
  repo = r;
};

/** Campagne aléatoire en cours : ses trois chapitres (tirés une fois pour toutes) et la progression. */
export interface RandomCampaignRun {
  campaign: GeneratedCampaign;
  run: CampaignRun;
}
export const randomChapterIds = (r: RandomCampaignRun | null): string[] => (r ? r.campaign.chapters.map((c) => c.scenario.id) : []);

interface CampaignRunStore {
  /** Progression de la campagne écrite à la main. */
  run: CampaignRun | null;
  /** Campagne aléatoire (ses chapitres et sa progression). Une seule campagne est active à la fois : l'une ou l'autre. */
  random: RandomCampaignRun | null;
  /** Progression de la campagne moyenne (5 chapitres écrits à la main). */
  medium: CampaignRun | null;
  loaded: boolean;
  load(): Promise<void>;
  /** Commence la campagne (ou la recommence : la progression est effacée). Abandonne la campagne aléatoire si elle existe. */
  start(): void;
  /** Tire une campagne aléatoire de 3 scénarios et la commence. Abandonne la campagne écrite à la main si elle est commencée. */
  drawRandom(seed?: number): void;
  /** « Autre tirage » : remplace la campagne aléatoire par une autre, tant qu'aucun chapitre n'a été joué. */
  redrawRandom(): void;
  resetRandom(): void;
  /** Commence la campagne moyenne (ou la recommence : la progression est effacée). Abandonne les autres campagnes. */
  startMedium(): void;
  resetMedium(): void;
  /** Enregistre la fin d'une partie dans la campagne à laquelle elle appartient ; sans effet sinon. */
  record(g: GameState): void;
  reset(): void;
}

/** La campagne (écrite à la main ou aléatoire) à laquelle appartient un scénario, avec sa progression ; `null` hors campagne. */
export function activeCampaignFor(s: Pick<CampaignRunStore, 'run' | 'random'> & { medium?: CampaignRun | null }, scenarioId: string): { title: string; chapterIds: string[]; run: CampaignRun } | null {
  if (s.run && CHAPTER_IDS.includes(scenarioId)) return { title: CAMPAIGN.title, chapterIds: CHAPTER_IDS, run: s.run };
  if (s.medium && MEDIUM_IDS.includes(scenarioId)) return { title: MEDIUM_CAMPAIGN.title, chapterIds: MEDIUM_IDS, run: s.medium };
  const ids = randomChapterIds(s.random);
  if (s.random && ids.includes(scenarioId)) return { title: s.random.campaign.title, chapterIds: ids, run: s.random.run };
  return null;
}

const newSeed = (): number => Math.floor(Math.random() * 2 ** 31);

/** Progression des campagnes, gardée sur l'appareil (préférences) d'un lancement à l'autre. */
export const useCampaignRunStore = create<CampaignRunStore>()((set, get) => {
  const persist = () => {
    void repo?.setPref(PREF, get().run).catch(() => undefined);
    void repo?.setPref(PREF_RANDOM, get().random).catch(() => undefined);
    void repo?.setPref(PREF_MEDIUM, get().medium).catch(() => undefined);
  };
  return {
    run: null,
    random: null,
    medium: null,
    loaded: false,
    async load() {
      try {
        const saved = await repo?.getPref<unknown>(PREF);
        set({ run: parseRun(saved, CAMPAIGN.id) });
        const savedRandom = await repo?.getPref<{ campaign?: unknown; run?: unknown } | null>(PREF_RANDOM);
        const campaign = parseGeneratedCampaign(savedRandom?.campaign);
        const run = campaign ? parseRun(savedRandom?.run, campaign.id) : null;
        set({ random: campaign && run ? { campaign, run } : null });
        set({ medium: parseRun(await repo?.getPref<unknown>(PREF_MEDIUM), MEDIUM_CAMPAIGN.id) });
      } catch {
        // pas de stockage : la progression reste en mémoire
      }
      set({ loaded: true });
    },
    start() {
      set({ run: startRun(CAMPAIGN.id), random: null, medium: null });
      persist();
    },
    drawRandom(seed = newSeed()) {
      const campaign = generateCampaign({ seed }, ORIGINAL_CONTENT);
      set({ random: { campaign, run: startRun(campaign.id) }, run: null, medium: null });
      persist();
    },
    redrawRandom() {
      const current = get().random;
      if (!current || current.run.attempts.length > 0) return; // un chapitre a été joué : la campagne est engagée
      const campaign = generateCampaign({ seed: newSeed() }, ORIGINAL_CONTENT);
      set({ random: { campaign, run: startRun(campaign.id) } });
      persist();
    },
    resetRandom() {
      set({ random: null });
      persist();
    },
    startMedium() {
      set({ medium: startRun(MEDIUM_CAMPAIGN.id), run: null, random: null });
      persist();
    },
    resetMedium() {
      set({ medium: null });
      persist();
    },
    record(g) {
      const { run, random, medium } = get();
      if (run) {
        const next = recordAttempt(run, CHAPTER_IDS, g);
        if (next !== run) set({ run: next });
      }
      if (random) {
        const next = recordAttempt(random.run, randomChapterIds(random), g);
        if (next !== random.run) set({ random: { campaign: random.campaign, run: next } });
      }
      if (medium) {
        const next = recordAttempt(medium, MEDIUM_IDS, g);
        if (next !== medium) set({ medium: next });
      }
      if (get().run !== run || get().random !== random || get().medium !== medium) persist();
    },
    reset() {
      set({ run: null });
      persist();
    },
  };
});

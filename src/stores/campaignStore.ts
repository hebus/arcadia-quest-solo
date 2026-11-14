import { create } from 'zustand';
import {
  applyUpgradePhase,
  createCampaign,
  finishScenario,
  type Campaign,
  type Purchase,
} from '@/engine/campaign';
import type { GameState } from '@/engine/domain/schemas';
import { Repository } from '@/infrastructure/persistence/repository';

interface CampaignStore {
  campaign: Campaign | null;
  error: string | null;
  create(name: string, heroIds: string[]): void;
  set(c: Campaign | null): void;
  setCardSet(rank: number, set: string): void;
  finish(g: GameState): void;
  upgrade(purchases: Purchase[], discard: string[]): void;
}

let repo: Repository | null = null;
export const setCampaignRepository = (r: Repository | null): void => {
  repo = r;
};

export const useCampaignStore = create<CampaignStore>()((set, get) => {
  const apply = (fn: (c: Campaign) => Campaign) => {
    const c = get().campaign;
    if (!c) return;
    try {
      const next = fn(c);
      set({ campaign: next, error: null });
      void repo?.saveCampaign(next).catch(() => undefined);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  };
  return {
    campaign: null,
    error: null,
    create(name, heroIds) {
      try {
        const c = createCampaign({ id: `c-${Date.now()}`, name, contentVersion: 'user-1', heroIds });
        set({ campaign: c, error: null });
        void repo?.saveCampaign(c).catch(() => undefined);
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e) });
      }
    },
    set(c) {
      set({ campaign: c, error: null });
    },
    setCardSet(rank, setName) {
      apply((c) => ({ ...c, cardSetByRank: { ...c.cardSetByRank, [String(rank)]: setName } }));
    },
    finish(g) {
      apply((c) => finishScenario(c, g));
    },
    upgrade(purchases, discard) {
      apply((c) => applyUpgradePhase(c, purchases, discard));
    },
  };
});

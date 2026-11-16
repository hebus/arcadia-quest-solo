import { create } from 'zustand';
import { MAX_HERO_LIFE, MIN_HERO_LIFE, parseGuild, randomGuild, type GuildHero } from '@/engine/guild';
import type { Repository } from '@/infrastructure/persistence/repository';

const PREF = 'guild';
let repo: Repository | null = null;
export const setGuildRepository = (r: Repository | null): void => {
  repo = r;
};

interface GuildStore {
  heroes: GuildHero[];
  loaded: boolean;
  load(): Promise<void>;
  setName(index: number, name: string): void;
  setLife(index: number, life: number): void;
  setStealth(index: number, stealth: boolean): void;
}

/** La guilde du joueur (3 héros : nom et points de vie), gardée sur l'appareil d'une partie à l'autre. */
export const useGuildStore = create<GuildStore>()((set, get) => {
  const persist = () => void repo?.setPref(PREF, get().heroes).catch(() => undefined);
  return {
    // Noms tirés au hasard la première fois ; ils sont ensuite enregistrés, donc stables d'un lancement à l'autre.
    heroes: randomGuild(),
    loaded: false,
    async load() {
      try {
        const saved = await repo?.getPref<unknown>(PREF);
        if (saved !== undefined) set({ heroes: parseGuild(saved) });
        else persist();
      } catch {
        // pas de stockage : on garde la guilde par défaut
      }
      set({ loaded: true });
    },
    setName(index, name) {
      set({ heroes: get().heroes.map((h, i) => (i === index ? { ...h, name } : h)) });
      persist();
    },
    setLife(index, life) {
      const clamped = Math.max(MIN_HERO_LIFE, Math.min(MAX_HERO_LIFE, Math.round(life)));
      set({ heroes: get().heroes.map((h, i) => (i === index ? { ...h, life: clamped } : h)) });
      persist();
    },
    setStealth(index, stealth) {
      set({ heroes: get().heroes.map((h, i) => (i === index ? { ...h, stealth } : h)) });
      persist();
    },
  };
});

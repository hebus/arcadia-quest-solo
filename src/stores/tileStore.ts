import { create } from 'zustand';
import type { TileDef } from '@/engine/tiles';
import { Repository } from '@/infrastructure/persistence/repository';

interface TileStore {
  tiles: TileDef[];
  loaded: boolean;
  load(): Promise<void>;
  save(t: TileDef): void;
  remove(id: string): void;
}

let repo: Repository | null = null;
export const setTileRepository = (r: Repository | null): void => {
  repo = r;
};

/** Bibliothèque des tuiles scannées : en mémoire, persistée dans IndexedDB quand elle est disponible. */
export const useTileStore = create<TileStore>()((set, get) => ({
  tiles: [],
  loaded: false,
  async load() {
    try {
      const tiles = (await repo?.listTiles()) ?? [];
      set({ tiles, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  save(t) {
    const others = get().tiles.filter((x) => x.id !== t.id);
    set({ tiles: [...others, t].sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true })) });
    void repo?.saveTile(t).catch(() => undefined);
  },
  remove(id) {
    set({ tiles: get().tiles.filter((x) => x.id !== id) });
    void repo?.deleteTile(id).catch(() => undefined);
  },
}));

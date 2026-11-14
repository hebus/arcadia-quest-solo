import { parse } from '@/engine/domain/validate';
import { CampaignSchema, type Campaign } from '@/engine/campaign';
import { GameStateSchema, type GameState } from '@/engine/domain/schemas';
import { TileDefSchema, type TileDef } from '@/engine/tiles';
import { getDb, type AqDatabase } from './db';

export const SNAPSHOT_LIMIT = 50;

/** Accès aux données locales (IndexedDB). Aucune donnée ne quitte l'appareil (plan §9.4). */
export class Repository {
  constructor(private readonly db: AqDatabase = getDb()) {}

  async saveCampaign(c: Campaign): Promise<void> {
    await this.db.campaigns.put(parse(CampaignSchema, c));
  }
  async loadCampaign(id: string): Promise<Campaign | undefined> {
    const raw = await this.db.campaigns.get(id);
    return raw ? parse(CampaignSchema, raw) : undefined;
  }
  async listCampaigns(): Promise<Campaign[]> {
    return (await this.db.campaigns.toArray()).map((c) => parse(CampaignSchema, c));
  }
  async deleteCampaign(id: string): Promise<void> {
    await this.db.campaigns.delete(id);
  }

  async saveSession(state: GameState, campaignId: string | null = null): Promise<void> {
    await this.db.sessions.put({ sessionId: state.sessionId, campaignId, updatedAt: Date.now(), state });
  }
  async loadSession(sessionId: string): Promise<GameState | undefined> {
    const raw = await this.db.sessions.get(sessionId);
    return raw ? parse(GameStateSchema, raw.state) : undefined;
  }
  async listSessions() {
    return (await this.db.sessions.orderBy('updatedAt').reverse().toArray()).map((r) => ({
      sessionId: r.sessionId,
      campaignId: r.campaignId,
      updatedAt: r.updatedAt,
      scenarioId: r.state.scenarioId,
      round: r.state.round,
      phase: r.state.phase,
    }));
  }
  async deleteSession(sessionId: string): Promise<void> {
    await this.db.sessions.delete(sessionId);
    await this.db.snapshots.where('sessionId').equals(sessionId).delete();
  }

  /** Instantané avant une transaction : sert à l'annulation contrôlée. */
  async pushSnapshot(sessionId: string, state: GameState, label: string): Promise<void> {
    await this.db.snapshots.add({ sessionId, at: Date.now(), label, state });
    const all = await this.db.snapshots.where('sessionId').equals(sessionId).primaryKeys();
    if (all.length > SNAPSHOT_LIMIT) await this.db.snapshots.bulkDelete(all.slice(0, all.length - SNAPSHOT_LIMIT));
  }
  async popSnapshot(sessionId: string): Promise<GameState | undefined> {
    const last = await this.db.snapshots.where('sessionId').equals(sessionId).last();
    if (!last?.id) return undefined;
    await this.db.snapshots.delete(last.id);
    return parse(GameStateSchema, last.state);
  }
  async countSnapshots(sessionId: string): Promise<number> {
    return this.db.snapshots.where('sessionId').equals(sessionId).count();
  }

  /** Bibliothèque de tuiles scannées (images et murs), conservée sur l'appareil. */
  async saveTile(t: TileDef): Promise<void> {
    await this.db.tiles.put(parse(TileDefSchema, t));
  }
  async listTiles(): Promise<TileDef[]> {
    return (await this.db.tiles.toArray()).map((t) => parse(TileDefSchema, t));
  }
  async deleteTile(id: string): Promise<void> {
    await this.db.tiles.delete(id);
  }

  /**
   * Efface toutes les sauvegardes de l'appareil : parties, instantanés d'annulation, campagnes, sauvegardes de secours,
   * préférences. La bibliothèque de tuiles importées n'est effacée que sur demande (ce sont des scans que l'on a préparés).
   */
  async clearAll(opts: { tiles?: boolean } = {}): Promise<void> {
    const tables = [this.db.sessions, this.db.snapshots, this.db.campaigns, this.db.backups, this.db.prefs, ...(opts.tiles ? [this.db.tiles] : [])];
    await this.db.transaction('rw', tables, async () => {
      await Promise.all(tables.map((t) => t.clear()));
    });
  }

  async backup(reason: string, payload: string): Promise<void> {
    await this.db.backups.add({ at: Date.now(), reason, payload });
  }
  async setPref(key: string, value: unknown): Promise<void> {
    await this.db.prefs.put({ key, value });
  }
  async getPref<T>(key: string): Promise<T | undefined> {
    return (await this.db.prefs.get(key))?.value as T | undefined;
  }
}

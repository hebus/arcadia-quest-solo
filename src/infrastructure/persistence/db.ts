import Dexie, { type EntityTable } from 'dexie';
import type { Campaign } from '@/engine/campaign';
import type { GameState } from '@/engine/domain/schemas';
import type { TileDef } from '@/engine/tiles';

export interface SessionRecord {
  sessionId: string;
  campaignId: string | null;
  updatedAt: number;
  state: GameState;
}

export interface SnapshotRecord {
  id?: number;
  sessionId: string;
  at: number;
  label: string;
  state: GameState;
}

export interface BackupRecord {
  id?: number;
  at: number;
  reason: string;
  payload: string;
}

export interface PrefRecord {
  key: string;
  value: unknown;
}

export class AqDatabase extends Dexie {
  campaigns!: EntityTable<Campaign, 'id'>;
  sessions!: EntityTable<SessionRecord, 'sessionId'>;
  snapshots!: EntityTable<SnapshotRecord, 'id'>;
  backups!: EntityTable<BackupRecord, 'id'>;
  prefs!: EntityTable<PrefRecord, 'key'>;
  tiles!: EntityTable<TileDef, 'id'>;

  constructor(name = 'arcadia-quest-solo') {
    super(name);
    this.version(1).stores({
      campaigns: 'id',
      sessions: 'sessionId, campaignId, updatedAt',
      snapshots: '++id, sessionId, at',
      backups: '++id, at',
      prefs: 'key',
    });
    this.version(2).stores({ tiles: 'id' });
  }
}

let shared: AqDatabase | null = null;
export const getDb = (): AqDatabase => (shared ??= new AqDatabase());

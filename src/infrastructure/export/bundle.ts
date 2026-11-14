import { type } from 'arktype';
import { CampaignSchema, type Campaign } from '@/engine/campaign';
import { GameStateSchema, type GameState } from '@/engine/domain/schemas';
import { parse, safeParse } from '@/engine/domain/validate';

export const BUNDLE_FORMAT = 'aq-solo-bundle';
export const BUNDLE_VERSION = 1;

export const BundleSchema = type({
  format: type.unit(BUNDLE_FORMAT),
  bundleVersion: type.unit(BUNDLE_VERSION),
  exportedAt: 'string',
  campaign: CampaignSchema.or('null'),
  sessions: GameStateSchema.array(),
});
export type Bundle = typeof BundleSchema.infer;

export function exportBundle(campaign: Campaign | null, sessions: GameState[], now = new Date()): string {
  const bundle: Bundle = {
    format: BUNDLE_FORMAT,
    bundleVersion: BUNDLE_VERSION,
    exportedAt: now.toISOString(),
    campaign,
    sessions,
  };
  return JSON.stringify(parse(BundleSchema, bundle), null, 2);
}

/** Migration d'une version de bundle vers la suivante. */
export type Migration = { from: number; to: number; run: (raw: Record<string, unknown>) => Record<string, unknown> };

export const MIGRATIONS: Migration[] = [];

export class ImportError extends Error {}

/**
 * Import validé par ArkType (plan §9.4). Les anciennes versions sont migrées pas à pas ; une version plus récente
 * que celle de l'application est refusée. L'appelant sauvegarde l'existant avant d'appliquer le résultat.
 */
export function parseBundle(json: string, migrations: Migration[] = MIGRATIONS): Bundle {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new ImportError('Fichier illisible : JSON invalide');
  }
  if (typeof raw !== 'object' || raw === null || (raw as { format?: unknown }).format !== BUNDLE_FORMAT) {
    throw new ImportError("Ce fichier n'est pas une sauvegarde Arcadia Quest Solo");
  }
  let obj = raw as Record<string, unknown>;
  let version = Number(obj.bundleVersion);
  if (!Number.isInteger(version)) throw new ImportError('Version de sauvegarde absente');
  if (version > BUNDLE_VERSION) throw new ImportError(`Sauvegarde trop récente (v${version}) : mettez l'application à jour`);
  while (version < BUNDLE_VERSION) {
    const m = migrations.find((x) => x.from === version);
    if (!m) throw new ImportError(`Aucune migration depuis la version ${version}`);
    obj = { ...m.run(obj), bundleVersion: m.to };
    version = m.to;
  }
  const parsed = safeParse(BundleSchema, obj);
  if (!parsed.success) {
    throw new ImportError(`Sauvegarde invalide : ${parsed.issues.map((i) => `${i.path} ${i.message}`).join(' ; ')}`);
  }
  return parsed.data;
}

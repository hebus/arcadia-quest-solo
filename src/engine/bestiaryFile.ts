import { type } from 'arktype';
import { MonsterStatsSchema, type MonsterDefinition, type MonsterStats } from './domain/schemas';
import { parse } from './domain/validate';

/**
 * Lecture du fichier du bestiaire (`monsters.json`). Chaque monstre a une fiche par niveau ; une fiche vide (tous les champs à
 * null) est « à saisir » et simplement ignorée : l'application la signale ensuite (« stats manquantes »). Une fiche remplie à
 * moitié est une erreur, avec le nom du monstre, le niveau et les champs manquants.
 */

/** Champs obligatoires d'une fiche dès qu'elle est commencée. */
export const REQUIRED_STAT_FIELDS = ['rank', 'life', 'overkill', 'movement', 'reward', 'attackType', 'attackDice'] as const;

const MonsterEntrySchema = type({
  id: 'string',
  name: 'string',
  'abbr?': 'string | undefined',
  kind: "'minion' | 'villain'",
  tier: 'number.integer > 0',
  'copies?': 'number.integer > 0 | undefined',
  'group?': 'string | undefined',
  levels: { '[string]': 'object' },
});

const isBlank = (v: unknown) => v === null || v === undefined || (Array.isArray(v) && v.length === 0);

export function parseBestiaryFile(raw: unknown): MonsterDefinition[] {
  const list = (raw as { monsters?: unknown })?.monsters;
  if (!Array.isArray(list)) throw new Error('Bestiaire : la liste « monsters » est absente.');
  return list.map((entry, index) => {
    const base = parse(MonsterEntrySchema, entry);
    const levels: Record<string, MonsterStats> = {};
    const majorLevels: Record<string, MonsterStats> = {};
    for (const [level, rawSheet] of Object.entries(base.levels)) {
      const sheet = rawSheet as Record<string, unknown>;
      const where = `Bestiaire, monstre ${base.id || index + 1}, niveau ${level}`;
      const filled = REQUIRED_STAT_FIELDS.filter((f) => !isBlank(sheet[f]));
      if (filled.length === 0 && isBlank(sheet.defense) && isBlank(sheet.rerolls) && isBlank(sheet.skills)) continue; // fiche à saisir
      const missing = REQUIRED_STAT_FIELDS.filter((f) => isBlank(sheet[f]));
      if (missing.length > 0) throw new Error(`${where} : champs à renseigner : ${missing.join(', ')}.`);
      if (sheet.rank !== 'minor' && sheet.rank !== 'major') throw new Error(`${where} : rank doit valoir "minor" ou "major".`);
      let stats: MonsterStats;
      try {
        stats = parse(MonsterStatsSchema, {
          life: sheet.life,
          overkill: sheet.overkill,
          movement: sheet.movement,
          reward: sheet.reward,
          attackType: sheet.attackType,
          attackDice: sheet.attackDice,
          ...(isBlank(sheet.defense) ? {} : { defense: sheet.defense }),
          ...(isBlank(sheet.rerolls) ? {} : { rerolls: sheet.rerolls }),
          ...(isBlank(sheet.skills) ? {} : { skills: sheet.skills }),
        });
      } catch (e) {
        throw new Error(`${where} : ${e instanceof Error ? e.message : String(e)}`, { cause: e });
      }
      (sheet.rank === 'major' ? majorLevels : levels)[level] = stats;
    }
    return {
      id: base.id,
      name: base.name,
      ...(base.abbr ? { abbr: base.abbr } : {}),
      kind: base.kind,
      tier: base.tier,
      ...(base.copies ? { copies: base.copies } : {}),
      ...(base.group ? { group: base.group } : {}),
      levels,
      ...(Object.keys(majorLevels).length > 0 ? { majorLevels } : {}),
    };
  });
}

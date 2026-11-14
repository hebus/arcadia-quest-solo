import type { Content, GameState, MonsterDefinition, MonsterInstance, MonsterSkill, MonsterStats } from './domain/schemas';

/** Niveaux (jeux de cartes Monster) du jeu : un monstre existe à chacun d'eux, en version minor et major. */
export const MONSTER_LEVELS = ['1', '2-3', '4-5', '6'] as const;
export type MonsterLevel = (typeof MONSTER_LEVELS)[number];

export type MonsterRank = 'minor' | 'major';

/**
 * Statistiques d'un monstre pour un niveau et un rang. `levels` porte les stats des minor (ou de la version unique),
 * `majorLevels` celles des major. Renvoie `undefined` si ces stats ne sont pas (encore) renseignées.
 */
export function monsterStats(def: MonsterDefinition | undefined, level: string, rank?: MonsterRank): MonsterStats | undefined {
  if (rank === 'major') return def?.majorLevels?.[level];
  if (rank === 'minor') return def?.levels[level];
  // Rang non précisé : celui où le monstre existe à ce niveau (un Hammer Beastman n'existe qu'en major au niveau 1).
  return def?.levels[level] ?? def?.majorLevels?.[level];
}

/** Rang d'un monstre à un niveau : minor ou major (undefined si ses stats ne sont pas saisies). */
export function rankAtLevel(def: MonsterDefinition | undefined, level: string): MonsterRank | undefined {
  if (def?.levels[level]) return 'minor';
  return def?.majorLevels?.[level] ? 'major' : undefined;
}

/** « minion mineur », « vilain majeur »… */
export function monsterClassLabel(def: MonsterDefinition | undefined, level: string): string {
  const rank = rankAtLevel(def, level);
  if (!def || !rank) return '';
  return `${def.kind === 'villain' ? 'vilain' : 'minion'} ${rank === 'major' ? 'majeur' : 'mineur'}`;
}

export const MONSTER_SKILLS: Record<MonsterSkill, string> = {
  'crit-extra-wound': 'Chaque critique donne une blessure supplémentaire (et un dé supplémentaire est lancé).',
  'attack-all-adjacent': 'Son attaque cible tous les héros adjacents.',
  'extra-die-next-to-monster': 'Lance un dé d’attaque supplémentaire s’il est adjacent à un autre monstre.',
  stun: 'Si au moins une blessure passe, le héros est étourdi.',
};

/** Capacités d'un monstre, en clair : relances, puis compétences. */
export function skillLines(stats: MonsterStats | undefined): string[] {
  if (!stats) return [];
  return [...(stats.rerolls ? [`${stats.rerolls} relance${stats.rerolls > 1 ? 's' : ''} de l’attaque.`] : []), ...(stats.skills ?? []).map((s) => MONSTER_SKILLS[s])];
}

/** Stats d'une figurine posée : niveau du scénario en cours et rang de la figurine. */
export function statsOfMonster(content: Content, state: Pick<GameState, 'monsterCardSet'>, m: Pick<MonsterInstance, 'definitionId' | 'rank'>): MonsterStats | undefined {
  return monsterStats(content.monsters[m.definitionId], state.monsterCardSet, m.rank);
}

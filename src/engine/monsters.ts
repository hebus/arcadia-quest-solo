import type { Content, GameState, MonsterDefinition, MonsterInstance, MonsterStats } from './domain/schemas';

/** Niveaux (jeux de cartes Monster) du jeu : un monstre existe à chacun d'eux, en version minor et major. */
export const MONSTER_LEVELS = ['1', '2-3', '4-5', '6'] as const;
export type MonsterLevel = (typeof MONSTER_LEVELS)[number];

export type MonsterRank = 'minor' | 'major';

/**
 * Statistiques d'un monstre pour un niveau et un rang. `levels` porte les stats des minor (ou de la version unique),
 * `majorLevels` celles des major. Renvoie `undefined` si ces stats ne sont pas (encore) renseignées.
 */
export function monsterStats(def: MonsterDefinition | undefined, level: string, rank: MonsterRank = 'minor'): MonsterStats | undefined {
  return rank === 'major' ? def?.majorLevels?.[level] : def?.levels[level];
}

/** Stats d'une figurine posée : niveau du scénario en cours et rang de la figurine. */
export function statsOfMonster(content: Content, state: Pick<GameState, 'monsterCardSet'>, m: Pick<MonsterInstance, 'definitionId' | 'rank'>): MonsterStats | undefined {
  return monsterStats(content.monsters[m.definitionId], state.monsterCardSet, m.rank ?? 'minor');
}

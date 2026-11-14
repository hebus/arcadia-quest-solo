import type { MonsterDefinition } from '@/engine/domain/schemas';

/**
 * Bestiaire. Deux catégories de monstres : les minions et les vilains. Chacun existe à quatre niveaux
 * (« 1 », « 2-3 », « 4-5 », « 6 ») et, à chaque niveau, en version minor et major.
 *
 * Pour l'instant seuls deux minions sont utilisés, et seules leurs statistiques communiquées sont renseignées :
 * les autres niveaux et les versions major restent à saisir (l'application signale alors « stats manquantes »).
 * `levels` porte les stats des minor, `majorLevels` celles des major.
 */
export const ORIGINAL_MONSTERS: MonsterDefinition[] = [
  {
    id: 'GA',
    name: 'Goblin Archer',
    abbr: 'GA',
    kind: 'minion',
    tier: 1,
    copies: 6,
    levels: {
      // Minor, niveau 2-3 : 2 dés d'attaque à distance.
      '2-3': { life: 2, overkill: 3, movement: 1, reward: 1, attackType: 'ranged', attackDice: 2 },
    },
  },
  {
    id: 'OM',
    name: 'Orc Marauder',
    abbr: 'OM',
    kind: 'minion',
    tier: 1,
    copies: 8,
    levels: {
      // Minor, niveau 1 : 3 dés d'attaque de mêlée.
      '1': { life: 2, overkill: 3, movement: 1, reward: 1, attackType: 'melee', attackDice: 3 },
    },
  },
];

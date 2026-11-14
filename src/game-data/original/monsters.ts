import type { MonsterDefinition, MonsterStats } from '@/engine/domain/schemas';

/**
 * Bestiaire de Port-Cendre (univers original). Un monstre a cinq caractéristiques : points de vie, blessures pour le tuer
 * sur le coup (sans riposte), points de déplacement, dés d'attaque et type (mêlée ou distance), pièces d'or à sa mort.
 * Les statistiques sont celles de l'application, pas celles de cartes physiques : si vous jouez avec des figurines d'un autre jeu, elles servent seulement d'habillage.
 * Jeux de cartes par rang de scénario : « 1 », « 2-3 », « 4 », « 5-6 » (le deck d'activation tire les AUTRES niveaux).
 */
const LEVELS = ['1', '2-3', '4', '5-6'] as const;

/** Un cran de plus aux rangs avancés : +1 dé d'attaque au rang 4, +1 point de vie au rang 5-6. */
function levels(base: MonsterStats): Record<string, MonsterStats> {
  return Object.fromEntries(
    LEVELS.map((l, i) => [l, { ...base, attackDice: base.attackDice + (i >= 2 ? 1 : 0), life: base.life + (i >= 3 ? 1 : 0), overkill: base.overkill + (i >= 3 ? 1 : 0) }]),
  );
}

export const ORIGINAL_MONSTERS: MonsterDefinition[] = [
  {
    id: 'rodeur',
    name: 'Rôdeur des quais',
    tier: 1,
    levels: levels({ life: 2, overkill: 4, reward: 1, attackType: 'melee', attackDice: 2, movement: 3 }),
  },
  {
    id: 'archer-os',
    name: 'Archer d\'os',
    tier: 1,
    levels: levels({ life: 2, overkill: 4, reward: 1, attackType: 'ranged', attackDice: 2, movement: 2 }),
  },
  {
    id: 'brute',
    name: 'Brute de forge',
    tier: 2,
    levels: levels({ life: 4, overkill: 6, reward: 2, attackType: 'melee', attackDice: 3, movement: 2 }),
  },
  {
    id: 'sorciere',
    name: 'Sorcière des braises',
    tier: 2,
    levels: levels({ life: 3, overkill: 5, reward: 2, attackType: 'ranged', attackDice: 3, movement: 2 }),
  },
  {
    id: 'seigneur-cendre',
    name: 'Seigneur Cendre',
    tier: 3,
    villain: true,
    levels: levels({ life: 7, overkill: 9, reward: 4, attackType: 'melee', attackDice: 4, movement: 3 }),
  },
];

import type { HeroTemplate } from '@/engine/scenario/definition';

/**
 * Guilde de Port-Cendre : quatre gabarits, la partie en prend trois. Vie, défense, dés et types d'arme sont ceux de
 * l'application. Chaque carte arme indique le nombre de dés lancés et le type d'attaque (mêlée ou distance) ;
 * les effets additionnels de certaines armes ne sont pas encore modélisés.
 */
export const ORIGINAL_HEROES: HeroTemplate[] = [
  {
    id: 'mira',
    name: 'Mira',
    epithet: 'Lame-de-cendre : rapide et précise, elle ne recule jamais.',
    life: 4,
    defense: 1,
    rerolls: 0,
    weapons: [
      { id: 'lame', name: 'Lame de cendre', attackDice: 3, attackType: 'melee' },
      { id: 'arbalete', name: 'Arbalète de poing', attackDice: 2, attackType: 'ranged' },
    ],
  },
  {
    id: 'brogan',
    name: 'Brogan',
    epithet: 'Rempart de la guilde : lent à tomber, lent à convaincre.',
    life: 5,
    defense: 1,
    rerolls: 0,
    weapons: [
      { id: 'marteau', name: 'Marteau-rempart', attackDice: 3, attackType: 'melee' },
      { id: 'javelots', name: 'Javelots', attackDice: 2, attackType: 'ranged' },
    ],
  },
  {
    id: 'pip',
    name: 'Pip',
    epithet: 'Étincelle : fragile, mais le hasard lui obéit.',
    life: 3,
    defense: 1,
    rerolls: 1,
    weapons: [
      { id: 'etincelle', name: 'Fronde d’étincelles', attackDice: 3, attackType: 'ranged' },
      { id: 'dague', name: 'Dague d’étincelle', attackDice: 2, attackType: 'melee' },
    ],
  },
  {
    id: 'sora',
    name: 'Sora',
    epithet: 'Brumeline : insaisissable, elle esquive ce que les autres encaissent.',
    life: 3,
    defense: 2,
    rerolls: 0,
    weapons: [
      { id: 'arc', name: 'Arc de brume', attackDice: 3, attackType: 'ranged' },
      { id: 'stylet', name: 'Stylet', attackDice: 2, attackType: 'melee' },
    ],
  },
];

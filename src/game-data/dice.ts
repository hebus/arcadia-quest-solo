import type { DieFaceDef } from '@/engine/domain/schemas';

/**
 * Les dés du jeu. Dé de combat : noir. Dé de défense : blanc.
 *
 * - Dé noir (6 faces) : 3 épées, 2 arcs, 1 critique.
 *   Une attaque de mêlée touche avec une épée ou un critique ; à distance, avec un arc ou un critique ; sinon c'est un échec.
 * - Dé blanc (6 faces) : 2 boucliers, 1 critique, 3 faces vides.
 *   Un bouclier ou un critique annule une touche.
 * Un critique est une réussite et ajoute un dé (règle du livret).
 */
export const DICE_STATUS = 'verified' as const;

export const ATTACK_DIE_COLOR = 'black' as const;
export const DEFENSE_DIE_COLOR = 'white' as const;

const attack = (symbol: string, melee: boolean, ranged: boolean, crit = false): DieFaceDef => ({ symbol, melee, ranged, crit, save: false });

export const DEFAULT_ATTACK_DIE: DieFaceDef[] = [
  attack('sword', true, false),
  attack('sword', true, false),
  attack('sword', true, false),
  attack('bow', false, true),
  attack('bow', false, true),
  attack('crit', true, true, true),
];

export const DEFAULT_DEFENSE_DIE: DieFaceDef[] = [
  { symbol: 'shield', melee: false, ranged: false, crit: false, save: true },
  { symbol: 'shield', melee: false, ranged: false, crit: false, save: true },
  { symbol: 'crit', melee: false, ranged: false, crit: true, save: true },
  { symbol: 'blank', melee: false, ranged: false, crit: false, save: false },
  { symbol: 'blank', melee: false, ranged: false, crit: false, save: false },
  { symbol: 'blank', melee: false, ranged: false, crit: false, save: false },
];

import type { DieFaceDef } from '@/engine/domain/schemas';

/**
 * ATTENTION — DONNÉES NON VÉRIFIÉES (question ouverte B17).
 * Les livrets fournis ne décrivent pas les faces des dés (les symboles sont des images).
 * Cette configuration est un PLACEHOLDER à comparer aux dés physiques avant toute partie réelle :
 * adaptez les faces dans l'écran Paramètres ou ce fichier. Les règles de crit et de relance, elles, sont celles du livret.
 */
export const DICE_STATUS = 'to-verify' as const;

export const DEFAULT_ATTACK_DIE: DieFaceDef[] = [
  { symbol: 'sword', melee: true, ranged: false, crit: false, save: false },
  { symbol: 'sword', melee: true, ranged: false, crit: false, save: false },
  { symbol: 'bow', melee: false, ranged: true, crit: false, save: false },
  { symbol: 'bow', melee: false, ranged: true, crit: false, save: false },
  { symbol: 'crit', melee: true, ranged: true, crit: true, save: false },
  { symbol: 'blank', melee: false, ranged: false, crit: false, save: false },
];

export const DEFAULT_DEFENSE_DIE: DieFaceDef[] = [
  { symbol: 'shield', melee: false, ranged: false, crit: false, save: true },
  { symbol: 'shield', melee: false, ranged: false, crit: false, save: true },
  { symbol: 'crit', melee: false, ranged: false, crit: true, save: false },
  { symbol: 'blank', melee: false, ranged: false, crit: false, save: false },
  { symbol: 'blank', melee: false, ranged: false, crit: false, save: false },
  { symbol: 'blank', melee: false, ranged: false, crit: false, save: false },
];

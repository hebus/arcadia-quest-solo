import type { Content } from '@/engine/domain/schemas';
import { ORIGINAL_CONTENT } from '@/game-data/original';

/**
 * Contenu de l'univers original pour les tests : le Goblin Archer de niveau 1 y reprend les caractéristiques de son
 * niveau 2-3 (les vraies stats du niveau 1 ne sont pas encore saisies). Jamais utilisé par l'application.
 */
const ga = ORIGINAL_CONTENT.monsters.GA!;
export const TEST_ORIGINAL_CONTENT: Content = {
  ...ORIGINAL_CONTENT,
  monsters: { ...ORIGINAL_CONTENT.monsters, GA: { ...ga, levels: { ...ga.levels, '1': ga.levels['2-3']! } } },
};

import type { DifficultyVariant } from '@/engine/scenario/difficulty';

/**
 * Scénarios « one shot » : la difficulté choisie décide du niveau des fiches de monstres (facile = niveau 1, moyen = 2-3,
 * difficile = 4-5, légendaire = 6) ; chaque scénario ajoute ou retire des monstres par-dessus. Le scénario écrit dans le fichier
 * est la version « moyenne ».
 */
export const LEVEL_OF = { easy: '1', medium: '2-3', hard: '4-5', legendary: '6' } as const;

export const levelVariant = (d: keyof typeof LEVEL_OF, extra: Omit<DifficultyVariant, 'monsterCardSet'> = {}): DifficultyVariant => ({ monsterCardSet: LEVEL_OF[d], ...extra });

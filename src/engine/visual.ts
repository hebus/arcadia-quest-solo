import type { Position } from './domain/schemas';

/**
 * Action physique décrite comme une donnée visuelle (jamais comme du texte) : le rendu la montre sur le plateau
 * (pion fantôme, flèche, marqueur de retrait, case surlignée) sans que le joueur ait à lire une coordonnée.
 */
export type VisualAction =
  /** Poser une figurine sur une case (spawn). */
  | { type: 'place'; actorId: string; at: Position }
  /** Déplacer une figurine le long d'un trajet exact ; `doorIds` = portes qui s'ouvrent en chemin. */
  | { type: 'move'; actorId: string; path: Position[]; doorIds: string[] }
  /** Retirer une figurine du plateau (tuée, remise dans la boîte) ; `at` = sa case si elle y était. */
  | { type: 'remove'; actorId: string; at?: Position }
  /** Attaque : l'attaquant et la cible sont mis en évidence ; `wounds` blessures infligées. */
  | { type: 'attack'; attackerId: string; targetId: string; wounds: number }
  /** Une porte s'ouvre ou se ferme. */
  | { type: 'door'; doorId: string; open: boolean }
  /** Monstre activé : c'est lui qui va agir. */
  | { type: 'activate'; actorId: string; at: Position }
  /** Jeton Spawn de référence désigné par les dés. */
  | { type: 'spawn-point'; at: Position; pointId: string };

export const visualFocus = (v: VisualAction): Position | undefined => {
  switch (v.type) {
    case 'place':
    case 'spawn-point':
    case 'activate':
      return v.at;
    case 'move':
      return v.path[v.path.length - 1];
    case 'remove':
      return v.at;
    case 'attack':
    case 'door':
      return undefined;
  }
};

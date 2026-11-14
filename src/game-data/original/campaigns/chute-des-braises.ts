/**
 * Petite campagne de 3 chapitres : « La Chute des Braises ». Les chapitres se jouent dans l'ordre avec la même guilde de 3 héros ;
 * le suivant se déverrouille quand le précédent est gagné. Les trois sont au niveau de cartes Monster « 1 » : ce sont les seules
 * statistiques de monstres saisies pour l'instant (voir `monsters.json`).
 */
export interface CampaignChapter {
  /** Identifiant du scénario (dans `ORIGINAL_SCENARIOS`). */
  scenarioId: string;
  /** Ce que la guilde sait en arrivant à ce chapitre (affiché dans la campagne). */
  bridge: string;
}

export interface CampaignDefinition {
  id: string;
  title: string;
  tagline: string;
  chapters: readonly CampaignChapter[];
}

export const CHUTE_DES_BRAISES: CampaignDefinition = {
  id: 'chute-des-braises',
  title: 'La Chute des Braises',
  tagline: 'Trois nuits pour reprendre Port-Cendre aux maraudeurs : un seigneur, un troll, un maître de forge.',
  chapters: [
    { scenarioId: 'cave-aux-cendres', bridge: 'Port-Cendre brûle depuis trois nuits : il faut d’abord abattre le Seigneur Cendre dans sa chapelle.' },
    { scenarioId: 'marche-aux-ombres', bridge: 'Le seigneur est tombé, mais ses maraudeurs se sont repliés au Marché des Ombres, chez le troll Gorge-Sombre.' },
    { scenarioId: 'forge-du-maitre-fer', bridge: 'Un sceau de fer mène à la dernière piste : la Forge du Maître-Fer, qui arme tous les maraudeurs du quartier.' },
  ],
};

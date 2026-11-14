import type { ScenarioDefinition } from '@/engine/scenario/definition';

/**
 * Terrain d'essai : pas une aventure, un banc d'essai. On y place héros et monstres où l'on veut, on règle les dés des
 * monstres et on lance le tour des monstres en un clic pour vérifier le déroulement (déplacements, attaques, ripostes,
 * jets de défense) dans des conditions reproductibles.
 */
export const TERRAIN_ESSAI: ScenarioDefinition = {
  id: 'terrain-essai',
  title: 'Terrain d’essai',
  tagline: 'Placez héros et monstres où vous voulez pour reproduire une situation.',
  recommended: 'easy',
  sandbox: true,
  story: {
    intro: [
      'Un banc d’essai pour vérifier le déroulement du jeu, sans enchaîner une campagne.',
      'Le « Placement libre » est activé : glissez n’importe quel pion où vous voulez. Le menu « Terrain d’essai » ajoute ou retire des monstres, règle leurs blessures et leurs dés, saute le tour de guilde et remet la disposition de départ.',
      'Pour rejouer une situation à l’identique, choisissez des dés « toujours » : le jeton Spawn de référence est alors fixé et décide quel monstre agit.',
    ],
    win: ['Terrain d’essai validé.'],
    lose: ['Terrain d’essai : trop de héros sont tombés. Remettez la disposition de départ depuis le menu.'],
  },
  board: `
size 9x9
room 5,0 4x3
door porte-salle 4,1-5,1 closed
door porte-remise 2,6-2,5 closed
room 1,3 3x3
hole 4,4
wall 6,5-6,6
wall 6,6-7,6
spawn S1 0,0 sword+sword
spawn S2 8,8 bow+bow
spawn S3 4,0 sword+bow
spawn S4 8,4 crit+sword
spawn S5 4,8 crit+bow
`,
  heroStarts: [
    { x: 0, y: 7 },
    { x: 0, y: 8 },
    { x: 1, y: 8 },
  ],
  monsters: [
    { id: 'rodeur1', definitionId: 'rodeur', at: { x: 4, y: 6 } },
    { id: 'archer-os1', definitionId: 'archer-os', at: { x: 7, y: 7 } },
    { id: 'brute1', definitionId: 'brute', at: { x: 6, y: 3 } },
    { id: 'sorciere1', definitionId: 'sorciere', at: { x: 8, y: 2 } },
    { id: 'seigneur-cendre1', definitionId: 'seigneur-cendre', at: { x: 2, y: 4 }, guard: true },
  ],
  quests: [{ id: 'essai', icon: 'flag', title: 'Terrain d’essai (à valider à la main)', completion: 'Essai terminé.', at: { x: 4, y: 7 } }],
  deck: { listedMonsterIds: ['rodeur', 'archer-os', 'brute', 'sorciere', 'seigneur-cendre'] },
  monsterCardSet: '1',
};

import type { ScenarioDefinition } from '@/engine/scenario/definition';

/**
 * Chapitre 1 de la campagne moyenne « Le Siège de Val-Noir » : le Pont du Guet. Plateau de 4 tuiles (2 × 2, 6 × 6 cases).
 * Repère (x → droite, y → bas) : les héros partent du bâtiment en bas à gauche (tuile 7A), la tour du guet (tuile 3A, en haut à
 * gauche) porte le phare à rallumer, le puits (case bloquée de la tuile 4A) occupe le bas à droite.
 *
 * Population (niveau de cartes « 1 » : seuls les Orcs et les Beastmen y ont leurs statistiques, pas de Goblin Archer) : l'Orc Captain
 * Brise-Pont (chef, en garde sur le pont), trois Orc Marauder, un Spear Beastman collé à un Orc (un dé de plus) et un Hammer
 * Beastman en garde dans la tour ; 2 renforts d'Orc Marauder (6 Orcs sur 8).
 */
export const PONT_DU_GUET: ScenarioDefinition = {
  id: 'pont-du-guet',
  title: 'Le Pont du Guet',
  tagline: 'Rallumez le phare du guet, abattez le capitaine Brise-Pont.',
  recommended: 'easy',
  story: {
    intro: [
      'Val-Noir est un bourg de montagne : un seul pont, un seul guet, et depuis trois nuits le pont est tenu par des orcs. Le phare du guet, qui prévenait la vallée à chaque alerte, est éteint.',
      'Le capitaine Brise-Pont, un orc au casque cabossé, garde le pont avec ses maraudeurs. Un hammer beastman veille dans la tour, au pied du phare.',
      'Rallumez le phare pour que la vallée sache que le bourg résiste, puis abattez Brise-Pont avant que les orcs ne se regroupent.',
    ],
    win: ['Brise-Pont s’écroule sur les planches, et le phare brûle de nouveau au-dessus de Val-Noir. Dans la poche du capitaine, un ordre de marche : le gros des orcs campe aux Halles aux Grains.'],
    lose: ['Le pont se ferme derrière vous. Au sommet de la tour, le phare reste éteint, et la vallée ignore tout du siège de Val-Noir.'],
  },
  // Plateau de 4 tuiles : 3A (la tour du guet), 5A (tournée d'un quart de tour), 7A (le départ), 4A (le puits, case bloquée).
  tiles: {
    tilesW: 2,
    tilesH: 2,
    placements: [
      { tileId: '3A', tx: 0, ty: 0, rotation: 0 },
      { tileId: '5A', tx: 1, ty: 0, rotation: 90 },
      { tileId: '7A', tx: 0, ty: 1, rotation: 0 },
      { tileId: '4A', tx: 1, ty: 1, rotation: 0 },
    ],
  },
  // Pions porte : la sortie du départ (ouverte) et la porte de la tour du guet (fermée). Trois jetons Spawn seulement.
  board: `
size 6x6
door porte-depart 1,4-1,5 open
door porte-tour 1,1-1,0 closed
spawn S1 5,0 sword+sword
spawn S2 5,4 bow+bow
spawn S3 4,5 sword+bow
`,
  heroStarts: [
    { x: 0, y: 5 },
    { x: 1, y: 5 },
    { x: 2, y: 5 },
  ],
  monsters: [
    // Le chef : l'Orc Captain Brise-Pont garde le pont (3 dés d'épée, une relance).
    { id: 'OC1', definitionId: 'OC', at: { x: 4, y: 1 }, guard: true },
    { id: 'OM1', definitionId: 'OM', at: { x: 3, y: 1 } },
    // Un Spear Beastman collé à un Orc Marauder lance un dé d'attaque en plus.
    { id: 'OM2', definitionId: 'OM', at: { x: 4, y: 3 } },
    { id: 'SB1', definitionId: 'SB', at: { x: 5, y: 3 } },
    { id: 'OM3', definitionId: 'OM', at: { x: 0, y: 3 } },
    // Un Hammer Beastman garde la tour, au pied du phare.
    { id: 'HB1', definitionId: 'HB', at: { x: 0, y: 0 }, guard: true },
  ],
  quests: [
    { id: 'phare', icon: 'flame', title: 'Rallumer le phare du guet', completion: 'Le phare flambe dans la nuit : sur la vallée, des feux lui répondent.', at: { x: 2, y: 0 } },
    { id: 'capitaine', icon: 'skull', title: 'Abattre le capitaine Brise-Pont', completion: 'Brise-Pont lâche sa hache : le pont est à vous.', at: { x: 4, y: 1 } },
  ],
  script: [
    {
      id: 'tour-ouverte',
      when: [{ type: 'door-open', doorId: 'porte-tour' }],
      then: [
        { type: 'narrate', title: 'La tour du guet', tone: 'danger', text: 'La porte cède sur un grondement : un hammer beastman se dresse devant le phare, et un maraudeur accourt de la rue.' },
        { type: 'spawn', monsterId: 'OM4', definitionId: 'OM', at: { x: 2, y: 1 } },
      ],
    },
    {
      id: 'phare-allume',
      when: [{ type: 'hero-on', at: { x: 2, y: 0 } }],
      then: [
        { type: 'complete-quest', questId: 'phare', text: 'Le phare flambe dans la nuit : sur la vallée, des feux lui répondent.' },
        { type: 'narrate', title: 'Le signal', tone: 'danger', text: 'La flamme se voit de très loin. Sur le pont, les orcs hurlent et les renforts se ruent vers la tour.' },
        { type: 'spawn', monsterId: 'OM5', definitionId: 'OM', at: { x: 5, y: 1 } },
      ],
    },
    {
      id: 'capitaine-tombe',
      when: [{ type: 'monster-down', monsterId: 'OC1' }],
      then: [{ type: 'complete-quest', questId: 'capitaine', text: 'Brise-Pont lâche sa hache : le pont est à vous.' }],
    },
  ],
  monsterCardSet: '1',
  // Une carte par type de monstre présent (au départ ou en renfort).
  deck: { listedMonsterIds: ['OC', 'OM', 'SB', 'HB'] },
};

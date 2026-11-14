import type { ScenarioDefinition } from '@/engine/scenario/definition';

/**
 * Scénario 1 : la rue, une remise fermée à l'ouest, une chapelle ruinée au nord-est, sur un plateau de 9 tuiles du jeu.
 * Repère (x → droite, y → bas) : les héros partent du coin sud-ouest, le Seigneur Cendre tient la chapelle.
 *
 * Population (niveau 1, boîtes respectées) : le Seigneur Cendre est un Minotaur (1 en boîte), vilain en garde dans la chapelle ;
 * un Troll (1 en boîte) garde la grande salle ; des Orc Captain gardent la chapelle et la remise ; deux Spear Beastman (tireurs, dont
 * un collé à un Orc) et un Hammer Beastman patrouillent la rue ; le reste est en Orc Marauder. 6 Orcs au départ, 2 renforts du
 * script : les 8 Orcs de la boîte, pas un de plus.
 */
export const CAVE_AUX_CENDRES: ScenarioDefinition = {
  id: 'cave-aux-cendres',
  title: 'Les Braises de Port-Cendre',
  tagline: 'Reprenez la clé, éteignez le brasero, abattez le seigneur.',
  recommended: 'medium',
  story: {
    intro: [
      'Port-Cendre brûle depuis trois nuits. Des flammes sans fumée lèchent les toits, et les cloches de la chapelle sonnent toutes seules.',
      'Le Seigneur Cendre, un minotaure cuirassé, s’est retranché dans la chapelle ruinée avec la Clé de Braise, qui garde ses braseros allumés. Votre guilde est la dernière à tenir la rue.',
      'Reprenez la clé dans la remise, éteignez le brasero maudit, puis abattez le seigneur avant que la ville ne tombe.',
    ],
    win: ['Le brasero s’éteint dans un sifflement. Au matin, Port-Cendre n’est plus que de la pluie noire sur des pavés froids : la guilde a tenu.'],
    lose: ['Les cloches se taisent. Sous la cendre, Port-Cendre n’a plus de rue où fuir.'],
  },
  // Plateau de 3×3 tuiles du jeu (9×9 cases), construit depuis leurs définitions : bâtiments, salles, case bloquée.
  // La chapelle est le bâtiment en L de la tuile 2A (colonne 3, ligne 1), la remise celui de la tuile 8A (colonne 1, ligne 2),
  // la case bloquée au centre est le puits (tuile 4A), les héros partent du bâtiment de la tuile 7A (colonne 1, ligne 3) et la
  // grande salle de la tuile 1B (colonne 3, ligne 3) cache des maraudeurs. Chaque tuile est posée sur une seule face.
  tiles: {
    tilesW: 3,
    tilesH: 3,
    placements: [
      { tileId: '5A', tx: 0, ty: 0, rotation: 0 },
      { tileId: '3B', tx: 1, ty: 0, rotation: 90 },
      { tileId: '2A', tx: 2, ty: 0, rotation: 0 },
      { tileId: '8A', tx: 0, ty: 1, rotation: 0 },
      { tileId: '4A', tx: 1, ty: 1, rotation: 0 },
      { tileId: '9A', tx: 2, ty: 1, rotation: 0 },
      { tileId: '7A', tx: 0, ty: 2, rotation: 0 },
      { tileId: '6B', tx: 1, ty: 2, rotation: 180 },
      { tileId: '1B', tx: 2, ty: 2, rotation: 0 },
    ],
  },
  // Les bâtiments, salles et cases bloquées viennent des tuiles ; la description ne donne que les pions porte (les tuiles n'ont
  // pas de portes : ce sont des pions posés par le scénario) et les jetons Spawn, sur des cases de rue.
  board: `
size 9x9
door porte-chapelle 7,1-7,2 closed
door porte-remise 1,6-1,5 closed
door porte-salle 5,7-6,7 closed
door porte-depart 1,7-1,8 open
spawn S1 0,0 sword+sword
spawn S2 7,4 bow+bow
spawn S3 4,0 sword+bow
spawn S4 4,7 sword+crit
spawn S5 4,6 bow+crit
`,
  heroStarts: [
    { x: 0, y: 8 },
    { x: 1, y: 8 },
    { x: 2, y: 8 },
  ],
  monsters: [
    // Le chef, vilain : le Minotaur (5 de vie, 4 dés, un critique donne une blessure en plus) tient le fond de la chapelle, en garde.
    { id: 'M1', definitionId: 'M', at: { x: 8, y: 1 }, guard: true },
    // Le Troll (son attaque touche tous les héros adjacents) garde la grande salle : on peut l'éviter, pas le surprendre.
    { id: 'T1', definitionId: 'T', at: { x: 7, y: 7 }, guard: true },
    // Orc Captain (1 relance, 2 PO) : un garde derrière la porte de la chapelle, un autre dans la remise.
    { id: 'OC1', definitionId: 'OC', at: { x: 7, y: 2 }, guard: true },
    { id: 'OC2', definitionId: 'OC', at: { x: 0, y: 4 }, guard: true },
    // Spear Beastman (3 dés d'arc, +1 dé près d'un autre monstre) : un au centre de la rue, un collé à un Orc Marauder.
    { id: 'SB1', definitionId: 'SB', at: { x: 5, y: 4 } },
    { id: 'SB2', definitionId: 'SB', at: { x: 3, y: 1 } },
    // Hammer Beastman (4 dés d'épée, étourdit) : il patrouille devant la remise.
    { id: 'HB1', definitionId: 'HB', at: { x: 3, y: 5 } },
    // Orc Marauder : la rue. 4 au départ, 2 renforts : avec les 2 Orc Captain, les 8 Orcs de la boîte.
    { id: 'OM1', definitionId: 'OM', at: { x: 2, y: 1 } },
    { id: 'OM2', definitionId: 'OM', at: { x: 7, y: 5 } },
    { id: 'OM3', definitionId: 'OM', at: { x: 7, y: 0 } },
    { id: 'OM4', definitionId: 'OM', at: { x: 4, y: 2 } },
  ],
  quests: [
    { id: 'cle', icon: 'key', title: 'Reprendre la Clé de Braise', completion: 'La clé est encore tiède. Elle ouvre le brasero de la chapelle.', at: { x: 0, y: 3 } },
    { id: 'brasero', icon: 'flame', title: 'Éteindre le brasero maudit', completion: 'Le brasero crache une dernière étincelle puis s’éteint.', at: { x: 8, y: 0 } },
    { id: 'seigneur', icon: 'skull', title: 'Abattre le Seigneur Cendre', completion: 'Le minotaure s’effondre en poussière grise : le seigneur ne tient plus la ville.', at: { x: 8, y: 1 } },
  ],
  script: [
    {
      id: 'remise-ouverte',
      when: [{ type: 'door-open', doorId: 'porte-remise' }],
      then: [{ type: 'narrate', title: 'La remise', text: 'Le verrou cède. Dans la pénombre, quelque chose de tiède pulse sur une étagère : la Clé de Braise.' }],
    },
    {
      id: 'cle-reprise',
      when: [{ type: 'hero-on', at: { x: 0, y: 3 } }],
      then: [{ type: 'complete-quest', questId: 'cle', text: 'La clé est encore tiède. Elle ouvre le brasero de la chapelle.' }],
    },
    {
      id: 'chapelle-ouverte',
      when: [{ type: 'door-open', doorId: 'porte-chapelle' }],
      then: [
        { type: 'narrate', title: 'La chapelle', tone: 'danger', text: 'Les cloches s’arrêtent net. Dans la nef, le minotaure relève sa tête cornue, un capitaine orc aboie un ordre, et un maraudeur surgit dans votre dos.' },
        { type: 'spawn', monsterId: 'OM5', definitionId: 'OM', at: { x: 7, y: 1 } },
      ],
    },
    {
      id: 'brasero-eteint',
      when: [{ type: 'hero-on', at: { x: 8, y: 0 } }, { type: 'quest-done', questId: 'cle' }],
      then: [
        { type: 'complete-quest', questId: 'brasero', text: 'Le brasero crache une dernière étincelle puis s’éteint. La forge enchantée se réveille.' },
        { type: 'spawn', monsterId: 'OM6', definitionId: 'OM', at: { x: 6, y: 2 } },
      ],
    },
    {
      id: 'cendre-tombe',
      when: [{ type: 'round-reached', round: 3 }],
      then: [
        { type: 'narrate', title: 'La cendre tombe', tone: 'danger', text: 'Une pluie grise couvre la rue. Là où elle se pose, des ombres se redressent.' },
      ],
    },
    {
      id: 'seigneur-tombe',
      when: [{ type: 'monster-down', monsterId: 'M1' }],
      then: [{ type: 'complete-quest', questId: 'seigneur', text: 'Le minotaure s’effondre en poussière grise : le seigneur ne tient plus la ville.' }],
    },
  ],
  monsterCardSet: '1',
  // Une carte par type de monstre présent (au départ ou en renfort) : les cartes d'activation des autres niveaux.
  deck: { listedMonsterIds: ['M', 'T', 'OC', 'SB', 'HB', 'OM'] },
};

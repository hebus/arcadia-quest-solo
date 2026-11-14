import type { ScenarioDefinition } from '@/engine/scenario/definition';

/**
 * Chapitre 3 de la petite campagne « La Chute des Braises » : la Forge du Maître-Fer. Plateau de 9 tuiles (10 × 9 cases) : la
 * tuile 9A est décalée d'une case vers la droite, ce qui ouvre une colonne vide, donc bloquante, entre elle et le reste du
 * plateau : la forge est une île, on n'y entre que par les salles qui la bordent, par un pion porte.
 * Repère (x → droite, y → bas) : les héros partent du bâtiment en bas à gauche (tuile 6A), la grande salle (tuile 1B) est en haut à
 * droite, l'atelier (tuile 2B) en bas à droite, la cave (tuile 7B) au milieu en bas, la forge (tuile 9A décalée) à l'extrême droite.
 *
 * Population (niveau de cartes « 1 », boîtes respectées, la plus fournie de la campagne) : le Minotaur Maître-Fer (chef) en garde
 * dans la forge, le Troll en garde dans la grande salle, deux Orc Captain, deux Spear Beastman (dont un collé à un Orc), deux
 * Hammer Beastman et trois Orc Marauder ; 3 renforts d'Orc Marauder : les 8 Orcs de la boîte, pas un de plus.
 */
export const FORGE_DU_MAITRE_FER: ScenarioDefinition = {
  id: 'forge-du-maitre-fer',
  title: 'La Forge du Maître-Fer',
  tagline: 'Éteignez les deux braseros, forcez la forge, abattez le Maître-Fer.',
  recommended: 'hard',
  story: {
    intro: [
      'Le sceau de fer trouvé sur Gorge-Sombre porte un nom : le Maître-Fer, un minotaure qui forge, depuis des mois, les armes de tous les maraudeurs de Port-Cendre. Sa forge se dresse au bout du quartier, derrière une brèche que la nuit a creusée.',
      'On n’y entre pas par la rue : la forge est une île, ceinte par la grande salle des maîtres de forge au nord et par l’atelier au sud. Deux braseros alimentent ses soufflets ; tant qu’ils brûlent, le Maître-Fer est invincible.',
      'Éteignez les deux braseros, forcez la porte violette de la forge, puis abattez le Maître-Fer : c’est la dernière nuit de Port-Cendre.',
    ],
    win: ['Le Maître-Fer s’écroule sur son enclume, et la forge meurt dans un dernier souffle. Au matin, Port-Cendre fume encore, mais ses cloches sonnent enfin pour de vrai : la guilde a gagné la ville.'],
    lose: ['La forge rugit une dernière fois. Sous les marteaux du Maître-Fer, la guilde s’éteint avec Port-Cendre.'],
  },
  // Plateau de 9 tuiles. 9A est décalée d'une case vers la droite (dx = 1) : la colonne 6, entre elle et la tuile 4A, est vide.
  tiles: {
    tilesW: 3,
    tilesH: 3,
    placements: [
      { tileId: '3A', tx: 0, ty: 0, rotation: 0 },
      { tileId: '8B', tx: 1, ty: 0, rotation: 90 },
      { tileId: '1B', tx: 2, ty: 0, rotation: 0 },
      { tileId: '5B', tx: 0, ty: 1, rotation: 0 },
      { tileId: '4A', tx: 1, ty: 1, rotation: 0 },
      { tileId: '9A', tx: 2, ty: 1, rotation: 0, dx: 1 },
      { tileId: '6A', tx: 0, ty: 2, rotation: 0 },
      { tileId: '7B', tx: 1, ty: 2, rotation: 0 },
      { tileId: '2B', tx: 2, ty: 2, rotation: 0 },
    ],
  },
  // Pions porte : la sortie du départ (ouverte), la grande salle, l'île de la forge (le pion spécial violet, entre la grande salle et
  // l'île), l'atelier, l'entrée sud de l'île, la cave, et la fonderie, le bâtiment où se tient le Maître-Fer. 7 pions sur les 22 de la boîte.
  board: `
size 10x9
door porte-depart 1,7-1,8 open
door porte-halle 5,1-6,1 closed
door porte-forge 7,2-7,3 closed special
door porte-atelier 6,7-6,6 closed
door porte-sud 8,6-8,5 closed
door porte-cave 4,6-4,7 closed
door porte-fonderie 8,4-9,4 closed
spawn S1 4,0 sword+sword
spawn S2 8,4 bow+bow
spawn S3 3,6 sword+bow
spawn S4 1,1 bow+crit
`,
  heroStarts: [
    { x: 0, y: 7 },
    { x: 0, y: 8 },
    { x: 1, y: 8 },
  ],
  monsters: [
    // Le chef : le Minotaur Maître-Fer tient le fond de la forge, en garde (4 dés d'épée, chaque critique donne une blessure de plus).
    { id: 'M1', definitionId: 'M', at: { x: 9, y: 4 }, guard: true },
    // Le Troll garde la grande salle, un Orc Captain la porte de la forge, l'autre l'atelier.
    { id: 'T1', definitionId: 'T', at: { x: 7, y: 1 }, guard: true },
    { id: 'OC1', definitionId: 'OC', at: { x: 7, y: 3 }, guard: true },
    { id: 'OC2', definitionId: 'OC', at: { x: 7, y: 6 }, guard: true },
    // Deux Spear Beastman : un collé à un Orc Marauder (un dé de plus), l'autre isolé au nord.
    { id: 'SB1', definitionId: 'SB', at: { x: 5, y: 3 } },
    { id: 'OM1', definitionId: 'OM', at: { x: 5, y: 4 } },
    { id: 'SB2', definitionId: 'SB', at: { x: 3, y: 1 } },
    // Deux Hammer Beastman qui étourdissent, au milieu de la rue.
    { id: 'HB1', definitionId: 'HB', at: { x: 3, y: 4 } },
    { id: 'HB2', definitionId: 'HB', at: { x: 7, y: 7 } },
    { id: 'OM2', definitionId: 'OM', at: { x: 1, y: 4 } },
    { id: 'OM3', definitionId: 'OM', at: { x: 4, y: 5 } },
  ],
  quests: [
    { id: 'brasero-nord', icon: 'flame', title: 'Éteindre le brasero de la grande salle', completion: 'Le brasero siffle et s’éteint ; les soufflets de la forge toussent.', at: { x: 8, y: 0 } },
    { id: 'brasero-sud', icon: 'flame', title: 'Éteindre le brasero de la cave', completion: 'Le second brasero s’éteint dans un nuage de cendre ; la forge n’a plus de souffle.', at: { x: 4, y: 8 } },
    { id: 'maitre', icon: 'skull', title: 'Abattre le Maître-Fer', completion: 'Le minotaure s’écroule sur son enclume : plus un marteau ne frappera.', at: { x: 9, y: 4 } },
  ],
  script: [
    {
      id: 'halle-ouverte',
      when: [{ type: 'door-open', doorId: 'porte-halle' }],
      then: [
        { type: 'narrate', title: 'La grande salle', tone: 'danger', text: 'La porte cède sur un grondement : le troll des maîtres de forge se lève de son banc, et un maraudeur sort de l’ombre derrière vous.' },
        { type: 'spawn', monsterId: 'OM4', definitionId: 'OM', at: { x: 4, y: 1 } },
      ],
    },
    {
      id: 'atelier-ouvert',
      when: [{ type: 'door-open', doorId: 'porte-atelier' }],
      then: [
        { type: 'narrate', title: 'L’atelier', tone: 'danger', text: 'L’atelier sent le fer chaud. Dans le fracas des enclumes, un capitaine orc hurle, et un renfort accourt.' },
        { type: 'spawn', monsterId: 'OM5', definitionId: 'OM', at: { x: 5, y: 7 } },
      ],
    },
    {
      id: 'brasero-nord-eteint',
      when: [{ type: 'hero-on', at: { x: 8, y: 0 } }],
      then: [{ type: 'complete-quest', questId: 'brasero-nord', text: 'Le brasero siffle et s’éteint ; les soufflets de la forge toussent.' }],
    },
    {
      id: 'brasero-sud-eteint',
      when: [{ type: 'hero-on', at: { x: 4, y: 8 } }],
      then: [{ type: 'complete-quest', questId: 'brasero-sud', text: 'Le second brasero s’éteint dans un nuage de cendre ; la forge n’a plus de souffle.' }],
    },
    {
      id: 'forge-ouverte',
      when: [{ type: 'door-open', doorId: 'porte-forge' }],
      then: [
        { type: 'narrate', title: 'La forge', tone: 'danger', text: 'Le sceau violet se brise. Dans la lueur rouge, le Maître-Fer lève son marteau, et un dernier renfort jaillit des soufflets.' },
        { type: 'spawn', monsterId: 'OM6', definitionId: 'OM', at: { x: 8, y: 3 } },
      ],
    },
    {
      id: 'fonderie-ouverte',
      when: [{ type: 'door-open', doorId: 'porte-fonderie' }],
      then: [{ type: 'narrate', title: 'La fonderie', tone: 'danger', text: 'La porte de la fonderie bascule. Au centre, sur son enclume rougeoyante, le Maître-Fer se redresse, deux fois plus grand que vous.' }],
    },
    {
      id: 'maitre-tombe',
      when: [{ type: 'monster-down', monsterId: 'M1' }],
      then: [{ type: 'complete-quest', questId: 'maitre', text: 'Le minotaure s’écroule sur son enclume : plus un marteau ne frappera.' }],
    },
  ],
  monsterCardSet: '1',
  // Une carte par type de monstre présent (au départ ou en renfort).
  deck: { listedMonsterIds: ['M', 'T', 'OC', 'SB', 'HB', 'OM'] },
};

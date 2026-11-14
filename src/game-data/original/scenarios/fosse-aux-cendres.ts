import type { ScenarioDefinition } from '@/engine/scenario/definition';

/**
 * Chapitre 4 de la campagne moyenne « Le Siège de Val-Noir » : la Fosse aux Cendres. Plateau de 8 tuiles posées en anneau autour
 * d'un emplacement vide (3 × 3, 9 × 9 cases) : au centre, la fosse est un trou de 3 × 3 cases absentes, donc bloquantes, qu'il faut
 * contourner par la rue. Repère (x → droite, y → bas) : les héros partent du bâtiment en haut à gauche (tuile 2A) ; l'antre du chef
 * est la salle en T du haut (tuile 7B, cases (3,0) (4,0) (5,0) (4,1)) ; la tour du troll est la petite maison à sa droite en (6,2) ;
 * la tour du phare est le bâtiment de deux cases en haut à droite (8,0) (8,1).
 *
 * Population (niveau de cartes « 4-5 ») : le Hammer Beastman Brise-Os (chef, en garde dans l'antre), le Troll Pierre-Gueule (en garde
 * dans sa tour), un second Hammer Beastman, deux Orc Captain, deux Orc Marauder, deux Spear Beastman (chacun collé à un Orc, donc
 * avec un dé de plus) et trois Goblin Archer ; 2 renforts d'Orc Marauder (6 Orcs sur 8).
 */
export const FOSSE_AUX_CENDRES: ScenarioDefinition = {
  id: 'fosse-aux-cendres',
  title: 'La Fosse aux Cendres',
  tagline: 'Allumez le phare nord, brisez le sceau de l’antre, abattez Brise-Os.',
  recommended: 'hard',
  story: {
    intro: [
      'Le sceau de guerre de Cornelune mène à la Fosse aux Cendres : un ancien puits de mine, grand comme une place, que les orcs ont ceinturé de tours. Personne n’y traverse : il faut en faire le tour.',
      'Brise-Os, un hammer beastman à la masse rougie, tient l’antre au nord ; un troll nommé Pierre-Gueule monte la garde dans la tour voisine. Au nord-est, un phare de signalisation attend d’être allumé.',
      'Allumez le phare nord pour appeler les secours, brisez le sceau de l’antre, puis abattez Brise-Os avant que la fosse ne crache ses renforts.',
    ],
    win: ['Brise-Os s’écroule sur sa masse, et la fosse se tait. Dans l’antre, un étendard noir : celui de Vel-Karn, le seigneur de guerre, qui attend au Trône de Val-Noir.'],
    lose: ['La fosse crache ses cendres sur vous. Au fond, quelque chose rit, et le Trône de Val-Noir semble très loin.'],
  },
  // Plateau de 8 tuiles en anneau autour de la fosse (emplacement vide au centre) : 2A (le départ, retournée), 7B (l'antre, retournée),
  // 8B (la tour du phare), 6B, 1A (retournée), 3B, 5A (tournée) et 4A (tournée, case bloquée). Une seule face par tuile.
  tiles: {
    tilesW: 3,
    tilesH: 3,
    placements: [
      { tileId: '2A', tx: 0, ty: 0, rotation: 180 },
      { tileId: '7B', tx: 1, ty: 0, rotation: 180 },
      { tileId: '8B', tx: 2, ty: 0, rotation: 0 },
      { tileId: '6B', tx: 0, ty: 1, rotation: 0 },
      { tileId: '1A', tx: 2, ty: 1, rotation: 180 },
      { tileId: '3B', tx: 0, ty: 2, rotation: 0 },
      { tileId: '5A', tx: 1, ty: 2, rotation: 270 },
      { tileId: '4A', tx: 2, ty: 2, rotation: 270 },
    ],
  },
  // Pions porte : la sortie du départ (ouverte), l'antre (le pion spécial violet), la tour du troll, la tour du phare. Cinq jetons Spawn.
  board: `
size 9x9
door porte-depart 0,1-1,1 open
door porte-antre 4,1-4,2 closed special
door porte-tour 5,2-6,2 closed
door porte-nord 7,1-8,1 closed
spawn S1 3,1 sword+sword
spawn S2 7,3 bow+bow
spawn S3 1,5 sword+bow
spawn S4 4,8 sword+crit
spawn S5 6,7 bow+crit
`,
  heroStarts: [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
  ],
  monsters: [
    // Le chef : le Hammer Beastman Brise-Os, en garde au fond de l'antre (4 dés d'épée, étourdit le héros touché).
    { id: 'HB1', definitionId: 'HB', at: { x: 4, y: 0 }, guard: true },
    // Le Troll Pierre-Gueule garde sa tour ; un Orc Captain garde la porte de l'antre.
    { id: 'T1', definitionId: 'T', at: { x: 6, y: 2 }, guard: true },
    { id: 'OC1', definitionId: 'OC', at: { x: 5, y: 1 }, guard: true },
    { id: 'OC2', definitionId: 'OC', at: { x: 3, y: 2 } },
    // Deux Spear Beastman, chacun collé à un Orc Marauder (un dé de plus).
    { id: 'SB1', definitionId: 'SB', at: { x: 6, y: 4 } },
    { id: 'OM1', definitionId: 'OM', at: { x: 7, y: 4 } },
    { id: 'SB2', definitionId: 'SB', at: { x: 2, y: 4 } },
    { id: 'OM2', definitionId: 'OM', at: { x: 1, y: 4 } },
    { id: 'HB2', definitionId: 'HB', at: { x: 4, y: 7 } },
    // Trois Goblin Archer tiennent le contour de la fosse.
    { id: 'GA1', definitionId: 'GA', at: { x: 8, y: 2 } },
    { id: 'GA2', definitionId: 'GA', at: { x: 7, y: 6 } },
    { id: 'GA3', definitionId: 'GA', at: { x: 1, y: 6 } },
  ],
  quests: [
    { id: 'phare', icon: 'flame', title: 'Allumer le phare de la tour nord', completion: 'Le phare flambe au-dessus de la fosse : sur la vallée, des feux lui répondent.', at: { x: 8, y: 0 } },
    { id: 'sceau', icon: 'key', title: 'Briser le sceau de l’antre (porte violette)', completion: 'Le sceau violet éclate : l’antre de Brise-Os est béant.', at: { x: 4, y: 1 } },
    { id: 'chef', icon: 'skull', title: 'Abattre le hammer beastman Brise-Os', completion: 'Brise-Os lâche sa masse : l’antre n’a plus de maître.', at: { x: 4, y: 0 } },
  ],
  script: [
    {
      id: 'nord-ouvert',
      when: [{ type: 'door-open', doorId: 'porte-nord' }],
      then: [
        { type: 'narrate', title: 'La tour nord', tone: 'danger', text: 'La porte s’ouvre sur un escalier en colimaçon, et un maraudeur se jette dans la rue au pied de la tour.' },
        { type: 'spawn', monsterId: 'OM3', definitionId: 'OM', at: { x: 7, y: 2 } },
      ],
    },
    {
      id: 'tour-ouverte',
      when: [{ type: 'door-open', doorId: 'porte-tour' }],
      then: [{ type: 'narrate', title: 'La tour du troll', tone: 'danger', text: 'La porte de la tour tremble : à l’intérieur, Pierre-Gueule se redresse, et ses poings font tomber la poussière du plafond.' }],
    },
    {
      id: 'phare-allume',
      when: [{ type: 'hero-on', at: { x: 8, y: 0 } }],
      then: [
        { type: 'complete-quest', questId: 'phare', text: 'Le phare flambe au-dessus de la fosse : sur la vallée, des feux lui répondent.' },
        { type: 'spawn', monsterId: 'OM4', definitionId: 'OM', at: { x: 6, y: 1 } },
      ],
    },
    {
      id: 'antre-brise',
      when: [{ type: 'door-open', doorId: 'porte-antre' }],
      then: [
        { type: 'complete-quest', questId: 'sceau', text: 'Le sceau violet éclate : l’antre de Brise-Os est béant.' },
        { type: 'narrate', title: 'L’antre', tone: 'danger', text: 'Le sceau éclate. Dans l’antre, Brise-Os fait tourner sa masse, et son rire fait trembler la fosse.' },
      ],
    },
    {
      id: 'chef-tombe',
      when: [{ type: 'monster-down', monsterId: 'HB1' }],
      then: [{ type: 'complete-quest', questId: 'chef', text: 'Brise-Os lâche sa masse : l’antre n’a plus de maître.' }],
    },
  ],
  monsterCardSet: '4-5',
  // Une carte par type de monstre présent (au départ ou en renfort).
  deck: { listedMonsterIds: ['HB', 'T', 'OC', 'SB', 'OM', 'GA'] },
};

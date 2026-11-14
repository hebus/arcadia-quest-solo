import type { ScenarioDefinition } from '@/engine/scenario/definition';

/**
 * Chapitre 2 de la petite campagne « La Chute des Braises » : le Marché des Ombres. Plateau de 6 tuiles (3 × 2, 9 × 6 cases).
 * Repère (x → droite, y → bas) : les héros partent du bâtiment de gauche (tuile 9B), le Troll Gorge-Sombre tient la maison de
 * comptes en L (tuile 2A, en bas à droite), la salle du marché (tuile 7B, en haut à droite) garde la bourse.
 *
 * Population (niveau de cartes « 1 », boîtes respectées) : un Troll (vilain, chef), deux Orc Captain, deux Hammer Beastman (l'un
 * garde la salle du marché), deux Spear Beastman (dont un collé à un Hammer Beastman, donc avec un dé de plus), quatre Orc Marauder ;
 * 2 renforts d'Orc Marauder : les 8 Orcs de la boîte. Un plateau plus petit que le chapitre 1 (6 tuiles) mais plus serré : un vilain
 * qui frappe tous les héros adjacents, deux étourdisseurs et deux tireurs.
 */
export const MARCHE_AUX_OMBRES: ScenarioDefinition = {
  id: 'marche-aux-ombres',
  title: 'Le Marché des Ombres',
  tagline: 'Forcez le coffre-fort, reprenez la bourse, abattez Gorge-Sombre.',
  recommended: 'medium',
  story: {
    intro: [
      'Le Seigneur Cendre est tombé, mais ses braises couvent encore. Un colporteur tremblant vous mène au Marché des Ombres, où l’on a vu entrer, la nuit dernière, tout ce qui restait de ses maraudeurs.',
      'Un troll nommé Gorge-Sombre y tient la maison de comptes : c’est là qu’il enferme le butin de Port-Cendre, derrière une porte marquée d’un sceau violet. La bourse du marché, elle, dort dans la salle des enchères.',
      'Forcez le coffre-fort, reprenez la bourse, puis abattez Gorge-Sombre avant que les orcs ne se regroupent.',
    ],
    win: ['Gorge-Sombre s’effondre sur ses registres. Dans la poussière du marché, vous trouvez un sceau de fer frappé d’un marteau : la piste mène à la Forge du Maître-Fer.'],
    lose: ['Le marché se referme sur vous. Sous les étals, les orcs comptent vos pièces ; la piste du Maître-Fer s’éloigne un peu plus.'],
  },
  // Plateau de 6 tuiles : 9B (départ), 5A, 7B (salle du marché), 6B, 4A (le puits, case bloquée), 2A (la maison de comptes).
  // Chaque tuile est posée sur une seule face ; 5A, 6B et 2A sont tournées.
  tiles: {
    tilesW: 3,
    tilesH: 2,
    placements: [
      { tileId: '9B', tx: 0, ty: 0, rotation: 0 },
      { tileId: '5A', tx: 1, ty: 0, rotation: 90 },
      { tileId: '7B', tx: 2, ty: 0, rotation: 0 },
      { tileId: '6B', tx: 0, ty: 1, rotation: 180 },
      { tileId: '4A', tx: 1, ty: 1, rotation: 0 },
      { tileId: '2A', tx: 2, ty: 1, rotation: 270 },
    ],
  },
  // Pions porte : la sortie du départ (ouverte), le coffre-fort (le pion spécial violet), la salle du marché, la maison de comptes,
  // et un pion posé côté « porte ouverte » entre la salle du marché et la maison de comptes : il supprime le mur qui les sépare.
  board: `
size 9x6
door porte-depart 1,1-0,1 open
door porte-coffre 3,3-2,3 closed special
door porte-marche 7,1-7,0 closed
door porte-forge 5,3-6,3 closed
door ouverture 7,2-7,3 open
spawn S1 5,0 sword+sword
spawn S2 6,4 bow+bow
spawn S3 1,4 sword+bow
spawn S4 4,5 sword+crit
`,
  heroStarts: [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
  ],
  monsters: [
    // Le chef : le Troll Gorge-Sombre tient le fond de la maison de comptes ; son attaque touche tous les héros adjacents.
    { id: 'T1', definitionId: 'T', at: { x: 8, y: 4 }, guard: true },
    // Un Orc Captain garde la porte de la maison de comptes, l'autre le fond, derrière le troll ; un Hammer Beastman garde la salle
    // du marché, l'autre patrouille.
    { id: 'OC1', definitionId: 'OC', at: { x: 6, y: 3 }, guard: true },
    { id: 'OC2', definitionId: 'OC', at: { x: 8, y: 5 }, guard: true },
    { id: 'HB1', definitionId: 'HB', at: { x: 7, y: 1 }, guard: true },
    { id: 'HB2', definitionId: 'HB', at: { x: 4, y: 2 } },
    // Deux Spear Beastman : l'un collé à un Orc Marauder, l'autre à un Hammer Beastman (un dé de plus chacun).
    { id: 'SB1', definitionId: 'SB', at: { x: 5, y: 1 } },
    { id: 'SB2', definitionId: 'SB', at: { x: 4, y: 3 } },
    { id: 'OM1', definitionId: 'OM', at: { x: 4, y: 1 } },
    { id: 'OM2', definitionId: 'OM', at: { x: 5, y: 4 } },
    { id: 'OM3', definitionId: 'OM', at: { x: 3, y: 5 } },
    { id: 'OM4', definitionId: 'OM', at: { x: 1, y: 5 } },
  ],
  quests: [
    { id: 'coffre', icon: 'chest', title: 'Forcer le coffre-fort (porte violette)', completion: 'Le sceau violet saute. Dans le coffre, un registre noirci : les noms de ceux qui ont vendu Port-Cendre.', at: { x: 2, y: 3 } },
    { id: 'bourse', icon: 'gem', title: 'Reprendre la bourse du marché', completion: 'La bourse est lourde de pièces brûlées : de quoi payer les réparations du quartier.', at: { x: 8, y: 2 } },
    { id: 'troll', icon: 'skull', title: 'Abattre Gorge-Sombre', completion: 'Le troll s’affaisse dans un grondement : la maison de comptes n’a plus de maître.', at: { x: 8, y: 4 } },
  ],
  script: [
    {
      id: 'coffre-ouvert',
      when: [{ type: 'door-open', doorId: 'porte-coffre' }],
      then: [
        { type: 'complete-quest', questId: 'coffre', text: 'Le sceau violet saute. Dans le coffre, un registre noirci : les noms de ceux qui ont vendu Port-Cendre.' },
        { type: 'narrate', title: 'L’alarme', tone: 'danger', text: 'Le sceau hurle en se brisant. Dans la rue, un maraudeur répond à l’appel.' },
        { type: 'spawn', monsterId: 'OM5', definitionId: 'OM', at: { x: 3, y: 4 } },
      ],
    },
    {
      id: 'marche-ouvert',
      when: [{ type: 'door-open', doorId: 'porte-marche' }],
      then: [{ type: 'narrate', title: 'La salle des enchères', tone: 'danger', text: 'Un hammer beastman se redresse derrière un étal renversé, son marteau déjà levé.' }],
    },
    {
      id: 'bourse-prise',
      when: [{ type: 'hero-on', at: { x: 8, y: 2 } }],
      then: [
        { type: 'complete-quest', questId: 'bourse', text: 'La bourse est lourde de pièces brûlées : de quoi payer les réparations du quartier.' },
        { type: 'spawn', monsterId: 'OM6', definitionId: 'OM', at: { x: 5, y: 5 } },
      ],
    },
    {
      id: 'maison-de-comptes',
      when: [{ type: 'door-open', doorId: 'porte-forge' }],
      then: [{ type: 'narrate', title: 'La maison de comptes', tone: 'danger', text: 'Dans la pénombre, un troll grogne : il compte ses pièces et n’aime pas qu’on le dérange.' }],
    },
    {
      id: 'troll-tombe',
      when: [{ type: 'monster-down', monsterId: 'T1' }],
      then: [{ type: 'complete-quest', questId: 'troll', text: 'Le troll s’affaisse dans un grondement : la maison de comptes n’a plus de maître.' }],
    },
  ],
  monsterCardSet: '1',
  // Une carte par type de monstre présent (au départ ou en renfort).
  deck: { listedMonsterIds: ['T', 'OC', 'HB', 'SB', 'OM'] },
};

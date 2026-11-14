import type { ScenarioDefinition } from '@/engine/scenario/definition';
import { levelVariant } from './oneshot';

/**
 * One shot « Le Dernier Rempart » : 6 tuiles (3 × 2, plateau 9 × 6). Les héros partent du bâtiment en bas à gauche, éteignent le
 * brasero de la grande salle (en haut, au milieu), vident la cave (en bas, au milieu) et abattent le Minotaur qui tient la halle de
 * l'est.
 */
export const DERNIER_REMPART: ScenarioDefinition = {
  id: 'dernier-rempart',
  title: 'Le Dernier Rempart',
  tagline: 'Un brasero, une cave, un minotaure : le plus long des trois terrains.',
  recommended: 'hard',
  story: {
    intro: [
      'Le dernier rempart de Port-Cendre tient encore, mais ses défenseurs sont en fuite. Le brasero de la grande salle éclaire les assaillants, et le Minotaur des maraudeurs commande l’assaut depuis la halle de l’est.',
      'Éteignez le brasero, vidangez la cave où l’on cache les munitions, puis brisez le Minotaur.',
    ],
    win: ['Le Minotaur tombe, le brasero s’éteint : le rempart tient jusqu’à l’aube.'],
    lose: ['Le rempart cède dans un fracas : Port-Cendre n’a plus de murs.'],
  },
  tiles: {
    tilesW: 3,
    tilesH: 2,
    placements: [
      { tileId: '4A', tx: 0, ty: 0, rotation: 0 },
      { tileId: '1B', tx: 1, ty: 0, rotation: 0 },
      { tileId: '6B', tx: 2, ty: 0, rotation: 0 },
      { tileId: '3A', tx: 0, ty: 1, rotation: 0 },
      { tileId: '7B', tx: 1, ty: 1, rotation: 0 },
      { tileId: '2B', tx: 2, ty: 1, rotation: 0 },
    ],
  },
  board: `
size 9x6
door porte-depart 2,3-3,3 open
door porte-salle 2,1-3,1 closed
door porte-cave 4,3-4,4 closed
door porte-halle 5,3-6,3 closed special
door porte-rempart-1 3,2-3,3 closed
door porte-rempart-2 5,1-6,1 closed
door porte-liaison-1 6,5-5,5 closed
door porte-liaison-2 6,0-5,0 closed
spawn S1 1,0 sword+sword
spawn S2 7,2 bow+bow
spawn S3 2,4 sword+bow
spawn S4 8,1 bow+crit
`,
  heroStarts: [
    { x: 0, y: 3 },
    { x: 1, y: 3 },
    { x: 2, y: 3 },
  ],
  monsters: [
    { id: 'M1', definitionId: 'M', at: { x: 7, y: 3 }, guard: true },
    { id: 'T1', definitionId: 'T', at: { x: 4, y: 1 }, guard: true },
    { id: 'OM1', definitionId: 'OM', at: { x: 1, y: 0 } },
    { id: 'OM2', definitionId: 'OM', at: { x: 3, y: 4 } },
    { id: 'OC1', definitionId: 'OC', at: { x: 7, y: 1 } },
    { id: 'SB1', definitionId: 'SB', at: { x: 7, y: 4 } },
    { id: 'HB1', definitionId: 'HB', at: { x: 5, y: 4 } },
    { id: 'GA1', definitionId: 'GA', at: { x: 0, y: 2 } },
    { id: 'GA2', definitionId: 'GA', at: { x: 8, y: 4 } },
  ],
  quests: [
    { id: 'brasero', icon: 'flame', title: 'Éteindre le brasero de la grande salle', completion: 'Le brasero s’éteint dans un nuage de cendre.', at: { x: 4, y: 0 } },
    { id: 'cave', icon: 'gem', title: 'Vider la cave aux munitions', completion: 'La cave est vide : plus une flèche pour l’assaut.', at: { x: 4, y: 5 } },
    { id: 'minotaure', icon: 'skull', title: 'Abattre le Minotaur', completion: 'Le Minotaur s’écroule.', at: { x: 7, y: 3 } },
  ],
  script: [
    {
      id: 'salle-ouverte',
      when: [{ type: 'door-open', doorId: 'porte-salle' }],
      then: [
        { type: 'narrate', title: 'La grande salle', tone: 'danger', text: 'La porte cède : le Troll se dresse devant le brasero, et un maraudeur sort de la rue.' },
        { type: 'spawn', monsterId: 'OM3', definitionId: 'OM', at: { x: 1, y: 2 } },
      ],
    },
    {
      id: 'brasero-eteint',
      when: [{ type: 'hero-on', at: { x: 4, y: 0 } }],
      then: [{ type: 'complete-quest', questId: 'brasero', text: 'Le brasero s’éteint dans un nuage de cendre.' }],
    },
    {
      id: 'cave-videe',
      when: [{ type: 'hero-on', at: { x: 4, y: 5 } }],
      then: [{ type: 'complete-quest', questId: 'cave', text: 'La cave est vide : plus une flèche pour l’assaut.' }],
    },
    {
      id: 'halle-ouverte',
      when: [{ type: 'door-open', doorId: 'porte-halle' }],
      then: [
        { type: 'narrate', title: 'La halle', tone: 'danger', text: 'Le sceau violet saute. Le Minotaur se redresse, et un dernier renfort jaillit des rangs.' },
        { type: 'spawn', monsterId: 'OM4', definitionId: 'OM', at: { x: 7, y: 2 } },
      ],
    },
    {
      id: 'minotaure-tombe',
      when: [{ type: 'monster-down', monsterId: 'M1' }],
      then: [ { type: 'reward', card: 'random', text: 'Le Minotaur tombe et lâche son arme.' }, { type: 'complete-quest', questId: 'minotaure', text: 'Le Minotaur s’écroule.' }],
    },
  ],
  monsterCardSet: '2-3',
  deck: { listedMonsterIds: ['M', 'T', 'OC', 'OM', 'SB', 'HB', 'GA'] },
  difficulties: {
    easy: levelVariant('easy', { removeMonsters: ['GA1', 'GA2'], removeListedMonsterIds: ['GA'] }),
    medium: levelVariant('medium'),
    hard: levelVariant('hard', { addMonsters: [{ id: 'OM5', definitionId: 'OM', at: { x: 6, y: 4 } }] }),
    legendary: levelVariant('legendary', {
      addMonsters: [
        { id: 'OM5', definitionId: 'OM', at: { x: 6, y: 4 } },
        { id: 'SB2', definitionId: 'SB', at: { x: 3, y: 5 } },
        { id: 'HB2', definitionId: 'HB', at: { x: 0, y: 4 } },
      ],
    }),
  },
};

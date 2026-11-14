import type { ScenarioDefinition } from '@/engine/scenario/definition';
import { levelVariant } from './oneshot';

/**
 * One shot « Le Corridor des Ombres » : 3 tuiles alignées (plateau 9 × 3), un long boyau fermé par des portes. Les héros partent du
 * bâtiment à l'ouest, prennent la clé dans la cave du milieu, puis forcent la porte de l'est pour abattre le Minotaur qui garde la
 * sortie.
 */
export const CORRIDOR_DES_OMBRES: ScenarioDefinition = {
  id: 'corridor-des-ombres',
  title: 'Le Corridor des Ombres',
  tagline: 'Un long boyau, une clé au milieu, un minotaure au bout.',
  recommended: 'medium',
  story: {
    intro: [
      'Sous Port-Cendre, un corridor relie les bas-quartiers à la citadelle. Les maraudeurs l’ont muré de portes pour garder ce qu’il y a au bout.',
      'La clé de la dernière porte se trouve dans la cave, au milieu du boyau. Au fond, le Minotaur veille.',
      'Avancez porte après porte : plus vous allez vers l’est, plus il fait sombre.',
    ],
    win: ['Le Minotaur s’écroule dans le noir. La citadelle est à portée de main.'],
    lose: ['Le boyau se referme derrière vous. Personne ne reviendra du corridor.'],
  },
  tiles: {
    tilesW: 3,
    tilesH: 1,
    placements: [
      { tileId: '2A', tx: 0, ty: 0, rotation: 0 },
      { tileId: '5B', tx: 1, ty: 0, rotation: 0 },
      { tileId: '8B', tx: 2, ty: 0, rotation: 0 },
    ],
  },
  board: `
size 9x3
door porte-depart 2,0-3,0 open
door porte-milieu 3,1-4,1 closed
door porte-cave 4,2-5,2 closed
door porte-est 7,1-8,1 closed special
spawn S1 4,1 sword+sword
spawn S2 6,1 bow+bow
spawn S3 7,2 sword+bow
`,
  heroStarts: [
    { x: 0, y: 2 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
  ],
  monsters: [
    { id: 'M1', definitionId: 'M', at: { x: 8, y: 0 }, guard: true },
    { id: 'OM1', definitionId: 'OM', at: { x: 4, y: 2 } },
    { id: 'OM2', definitionId: 'OM', at: { x: 6, y: 1 } },
    { id: 'SB1', definitionId: 'SB', at: { x: 5, y: 1 } },
    { id: 'OC1', definitionId: 'OC', at: { x: 7, y: 2 }, guard: true },
    { id: 'GA1', definitionId: 'GA', at: { x: 7, y: 1 } },
    { id: 'GA2', definitionId: 'GA', at: { x: 4, y: 1 } },
  ],
  quests: [
    { id: 'cle', icon: 'key', title: 'Prendre la clé dans la cave', completion: 'La clé est à vous.', at: { x: 5, y: 2 } },
    { id: 'gardien', icon: 'skull', title: 'Abattre le Minotaur du fond', completion: 'Le Minotaur s’écroule.', at: { x: 8, y: 0 } },
  ],
  script: [
    {
      id: 'cle-prise',
      when: [{ type: 'hero-on', at: { x: 5, y: 2 } }],
      then: [{ type: 'complete-quest', questId: 'cle', text: 'La clé est à vous.' }],
    },
    {
      id: 'milieu-ouvert',
      when: [{ type: 'door-open', doorId: 'porte-milieu' }],
      then: [
        { type: 'narrate', title: 'Le boyau', tone: 'danger', text: 'La porte du milieu grince : au fond du boyau, des yeux brillent, et un maraudeur sort de l’ombre.' },
        { type: 'spawn', monsterId: 'OM3', definitionId: 'OM', at: { x: 6, y: 2 } },
      ],
    },
    {
      id: 'est-ouvert',
      when: [{ type: 'door-open', doorId: 'porte-est' }],
      then: [{ type: 'narrate', title: 'Le gardien', tone: 'danger', text: 'La dernière porte cède. Le Minotaur lève la tête, et le sol tremble.' }],
    },
    {
      id: 'gardien-tombe',
      when: [{ type: 'monster-down', monsterId: 'M1' }],
      then: [{ type: 'complete-quest', questId: 'gardien', text: 'Le Minotaur s’écroule.' }],
    },
  ],
  monsterCardSet: '2-3',
  deck: { listedMonsterIds: ['M', 'OC', 'OM', 'SB', 'GA'] },
  difficulties: {
    easy: levelVariant('easy', { removeMonsters: ['GA1', 'GA2'], removeListedMonsterIds: ['GA'] }),
    medium: levelVariant('medium'),
    hard: levelVariant('hard', { addMonsters: [{ id: 'HB1', definitionId: 'HB', at: { x: 6, y: 2 } }], addListedMonsterIds: ['HB'] }),
    legendary: levelVariant('legendary', {
      addMonsters: [
        { id: 'HB1', definitionId: 'HB', at: { x: 6, y: 2 } },
        { id: 'HB2', definitionId: 'HB', at: { x: 4, y: 0 } },
        { id: 'OC2', definitionId: 'OC', at: { x: 6, y: 0 } },
      ],
      addListedMonsterIds: ['HB'],
    }),
  },
};

import type { ScenarioDefinition } from '@/engine/scenario/definition';

/**
 * Scénario 1 : la rue, une remise fermée au sud-ouest, une chapelle ruinée au nord-est.
 * Repère (x → droite, y → bas) : les héros partent du coin sud-ouest, le Seigneur Cendre tient la chapelle.
 */
export const CAVE_AUX_CENDRES: ScenarioDefinition = {
  id: 'cave-aux-cendres',
  title: 'Les Braises de Port-Cendre',
  tagline: 'Reprenez la clé, éteignez le brasero, abattez le seigneur.',
  recommended: 'medium',
  story: {
    intro: [
      'Port-Cendre brûle depuis trois nuits. Des flammes sans fumée lèchent les toits, et les cloches de la chapelle sonnent toutes seules.',
      'Le Seigneur Cendre s’est retranché dans la chapelle ruinée avec la Clé de Braise, qui garde ses braseros allumés. Votre guilde est la dernière à tenir la rue.',
      'Reprenez la clé dans la remise, éteignez le brasero maudit, puis abattez le seigneur avant que la ville ne tombe.',
    ],
    win: ['Le brasero s’éteint dans un sifflement. Au matin, Port-Cendre n’est plus que de la pluie noire sur des pavés froids : la guilde a tenu.'],
    lose: ['Les cloches se taisent. Sous la cendre, Port-Cendre n’a plus de rue où fuir.'],
  },
  board: `
size 9x9
# Chapelle ruinée au nord-est, remise au sud-ouest. Le contour des pièces est muré automatiquement.
room 5,0 4x3
room 1,3 3x3
door porte-chapelle 4,1-5,1 closed
door porte-remise 2,6-2,5 closed
hole 4,4
wall 6,5-6,6
wall 6,6-7,6
spawn S1 0,0 sword+sword
spawn S2 8,4 bow+bow
spawn S3 4,0 sword+bow
spawn S4 4,8 crit+sword
spawn S5 8,8 crit+bow
`,
  heroStarts: [
    { x: 0, y: 8 },
    { x: 1, y: 8 },
    { x: 0, y: 7 },
  ],
  monsters: [
    { id: 'rodeur1', definitionId: 'rodeur', at: { x: 3, y: 1 } },
    { id: 'rodeur2', definitionId: 'rodeur', at: { x: 7, y: 6 } },
    { id: 'archer1', definitionId: 'archer-os', at: { x: 8, y: 3 } },
    { id: 'archer2', definitionId: 'archer-os', at: { x: 5, y: 4 } },
    { id: 'brute1', definitionId: 'brute', at: { x: 2, y: 4 }, guard: true },
    { id: 'sorciere1', definitionId: 'sorciere', at: { x: 6, y: 1 }, guard: true },
    { id: 'seigneur1', definitionId: 'seigneur-cendre', at: { x: 7, y: 1 }, guard: true },
  ],
  quests: [
    { id: 'cle', icon: 'key', title: 'Reprendre la Clé de Braise', completion: 'La clé est encore tiède. Elle ouvre le brasero de la chapelle.', at: { x: 1, y: 3 } },
    { id: 'brasero', icon: 'flame', title: 'Éteindre le brasero maudit', completion: 'Le brasero crache une dernière étincelle puis s’éteint.', at: { x: 8, y: 0 } },
    { id: 'seigneur', icon: 'skull', title: 'Abattre le Seigneur Cendre', completion: 'Le seigneur s’effondre en poussière grise.', at: { x: 7, y: 1 } },
  ],
  script: [
    {
      id: 'remise-ouverte',
      when: [{ type: 'door-open', doorId: 'porte-remise' }],
      then: [{ type: 'narrate', title: 'La remise', text: 'Le verrou cède. Dans la pénombre, quelque chose de tiède pulse sur une étagère : la Clé de Braise.' }],
    },
    {
      id: 'cle-reprise',
      when: [{ type: 'hero-on', at: { x: 1, y: 3 } }],
      then: [{ type: 'complete-quest', questId: 'cle', text: 'La clé est encore tiède. Elle ouvre le brasero de la chapelle.' }],
    },
    {
      id: 'chapelle-ouverte',
      when: [{ type: 'door-open', doorId: 'porte-chapelle' }],
      then: [
        { type: 'narrate', title: 'La chapelle', tone: 'danger', text: 'Les cloches s’arrêtent net. Dans la nef, la sorcière relève la tête, et un rôdeur surgit dans votre dos.' },
        { type: 'spawn', monsterId: 'rodeur3', definitionId: 'rodeur', at: { x: 4, y: 2 } },
      ],
    },
    {
      id: 'brasero-eteint',
      when: [{ type: 'hero-on', at: { x: 8, y: 0 } }, { type: 'quest-done', questId: 'cle' }],
      then: [
        { type: 'complete-quest', questId: 'brasero', text: 'Le brasero crache une dernière étincelle puis s’éteint. La forge enchantée se réveille.' },
        { type: 'spawn', monsterId: 'brute2', definitionId: 'brute', at: { x: 6, y: 2 } },
      ],
    },
    {
      id: 'cendre-tombe',
      when: [{ type: 'round-reached', round: 3 }],
      then: [
        { type: 'narrate', title: 'La cendre tombe', tone: 'danger', text: 'Une pluie grise couvre la rue. Là où elle se pose, des ombres se redressent.' },
        { type: 'spawn', monsterId: 'rodeur4', definitionId: 'rodeur', at: { x: 0, y: 0 } },
      ],
    },
    {
      id: 'seigneur-tombe',
      when: [{ type: 'monster-down', monsterId: 'seigneur1' }],
      then: [{ type: 'complete-quest', questId: 'seigneur', text: 'Le seigneur s’effondre en poussière grise.' }],
    },
  ],
  monsterCardSet: '1',
};

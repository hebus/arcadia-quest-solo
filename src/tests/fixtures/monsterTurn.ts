import type { GameState } from '@/engine/domain/schemas';
import { activateHero, finishHeroActivations, startScenario } from '@/engine/turn/machine';
import { demoGame } from './demo';

/**
 * Début de Monster Turn avec défense physique : le paquet ne contient que des Goblins, le Goblin g1 est activé en premier, se déplace
 * puis attaque un héros (la graine 1 donne au moins un coup) : le moteur réclame le jet de défense du joueur après l'activation et le déplacement.
 */
export function attackTurn(): GameState {
  const s = demoGame({
    seed: 1,
    deck: { listedMonsterIds: ['goblin'] },
    settings: { diceMode: 'digital', cardMode: 'digital', defenseRoll: 'physical' },
    heroes: [
      { id: 'h1', name: 'Grom', life: 4, defense: 2, position: { x: 1, y: 4 } },
      { id: 'h2', name: 'Maya', life: 3, defense: 2, position: { x: 2, y: 4 } },
      { id: 'h3', name: 'Zazu', life: 3, defense: 2, position: { x: 1, y: 3 } },
    ],
    monsters: [
      { id: 'g1', definitionId: 'goblin', position: { x: 3, y: 3 } },
      { id: 'o1', definitionId: 'orc', position: { x: 6, y: 1 } },
    ],
  });
  let g = startScenario(s);
  for (const h of g.heroes) g = activateHero(g, h.id);
  return finishHeroActivations(g);
}

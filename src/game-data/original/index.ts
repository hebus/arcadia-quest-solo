import type { Content } from '@/engine/domain/schemas';
import type { ScenarioDefinition } from '@/engine/scenario/definition';
import { DEFAULT_ATTACK_DIE, DEFAULT_DEFENSE_DIE } from '../dice';
import { ORIGINAL_HEROES } from './heroes';
import { ORIGINAL_MONSTERS } from './monsters';
import { GAME_TILES } from './tiles';
import { CAVE_AUX_CENDRES } from './scenarios/cave-aux-cendres';
import { TERRAIN_ESSAI } from './scenarios/terrain-essai';

export const ORIGINAL_SCENARIOS: ScenarioDefinition[] = [CAVE_AUX_CENDRES, TERRAIN_ESSAI];
export { ORIGINAL_HEROES, ORIGINAL_MONSTERS };

/** Contenu de l'univers original : bestiaire et dés par défaut (les faces des dés se règlent dans les paramètres). */
export const ORIGINAL_CONTENT: Content = {
  version: 'port-cendre-1',
  monsters: Object.fromEntries(ORIGINAL_MONSTERS.map((m) => [m.id, m])),
  attackDie: DEFAULT_ATTACK_DIE,
  defenseDie: DEFAULT_DEFENSE_DIE,
  tiles: Object.fromEntries(GAME_TILES.map((t) => [t.id, t])),
};

export const scenarioById = (id: string): ScenarioDefinition | undefined => ORIGINAL_SCENARIOS.find((s) => s.id === id);

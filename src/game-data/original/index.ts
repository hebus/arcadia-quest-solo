import type { Content } from '@/engine/domain/schemas';
import { parseScenario, type ScenarioDefinition } from '@/engine/scenario/definition';
import { DEFAULT_ATTACK_DIE, DEFAULT_DEFENSE_DIE } from '../dice';
import { ORIGINAL_HEROES } from './heroes';
import { ORIGINAL_MONSTERS } from './monsters';
import { GAME_TILES } from './tiles';
import { CAVE_AUX_CENDRES } from './scenarios/cave-aux-cendres';
import { FORGE_DU_MAITRE_FER } from './scenarios/forge-du-maitre-fer';
import { MARCHE_AUX_OMBRES } from './scenarios/marche-aux-ombres';
import { TERRAIN_ESSAI } from './scenarios/terrain-essai';

export const ORIGINAL_SCENARIOS: ScenarioDefinition[] = [CAVE_AUX_CENDRES, TERRAIN_ESSAI, MARCHE_AUX_OMBRES, FORGE_DU_MAITRE_FER];
export { CHUTE_DES_BRAISES } from './campaigns/chute-des-braises';
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

/** Scénario d'une partie : un scénario livré, ou un scénario généré aléatoirement que la partie a gardé avec elle. */
export function scenarioOfGame(g: { scenarioId: string; generatedScenario?: string | undefined }): ScenarioDefinition | undefined {
  const shipped = scenarioById(g.scenarioId);
  if (shipped || !g.generatedScenario) return shipped;
  try {
    return parseScenario(JSON.parse(g.generatedScenario));
  } catch {
    return undefined;
  }
}

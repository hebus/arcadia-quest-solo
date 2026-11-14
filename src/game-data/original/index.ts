import type { Content, Difficulty } from '@/engine/domain/schemas';
import { parseScenario, type ScenarioDefinition } from '@/engine/scenario/definition';
import { resolveDifficulty } from '@/engine/scenario/difficulty';
import { DEFAULT_ATTACK_DIE, DEFAULT_DEFENSE_DIE } from '../dice';
import { ORIGINAL_HEROES } from './heroes';
import { ORIGINAL_MONSTERS } from './monsters';
import { ORIGINAL_REWARDS } from './rewards';
import { GAME_TILES } from './tiles';
import { CAVE_AUX_CENDRES } from './scenarios/cave-aux-cendres';
import { FORGE_DU_MAITRE_FER } from './scenarios/forge-du-maitre-fer';
import { MARCHE_AUX_OMBRES } from './scenarios/marche-aux-ombres';
import { TERRAIN_ESSAI } from './scenarios/terrain-essai';
import { CORRIDOR_DES_OMBRES } from './scenarios/corridor-des-ombres';
import { DERNIER_REMPART } from './scenarios/dernier-rempart';
import { EVASION_DU_QUARTIER } from './scenarios/evasion-du-quartier';
import { QUARTIER_DES_VOLEURS } from './scenarios/quartier-des-voleurs';
import { CAVEAU_DES_BRUMES } from './scenarios/caveau-des-brumes';
import { PONT_DU_GUET } from './scenarios/pont-du-guet';
import { HALLE_AUX_GRAINS } from './scenarios/halle-aux-grains';
import { REMPARTS_DE_VAL_NOIR } from './scenarios/remparts-de-val-noir';
import { FOSSE_AUX_CENDRES } from './scenarios/fosse-aux-cendres';
import { TRONE_DE_VAL_NOIR } from './scenarios/trone-de-val-noir';

/** Scénarios « one shot » : le joueur choisit la difficulté, qui décide du niveau des monstres (voir `difficulty.ts`). */
export const ONE_SHOT_SCENARIOS: ScenarioDefinition[] = [QUARTIER_DES_VOLEURS, CORRIDOR_DES_OMBRES, EVASION_DU_QUARTIER, DERNIER_REMPART, CAVEAU_DES_BRUMES];

export const ORIGINAL_SCENARIOS: ScenarioDefinition[] = [CAVE_AUX_CENDRES, TERRAIN_ESSAI, MARCHE_AUX_OMBRES, FORGE_DU_MAITRE_FER, PONT_DU_GUET, HALLE_AUX_GRAINS, REMPARTS_DE_VAL_NOIR, FOSSE_AUX_CENDRES, TRONE_DE_VAL_NOIR, ...ONE_SHOT_SCENARIOS];
export { CHUTE_DES_BRAISES } from './campaigns/chute-des-braises';
export { SIEGE_DE_VAL_NOIR } from './campaigns/siege-de-val-noir';
export { ORIGINAL_HEROES, ORIGINAL_MONSTERS, ORIGINAL_REWARDS };

/** Contenu de l'univers original : bestiaire et dés par défaut (les faces des dés se règlent dans les paramètres). */
export const ORIGINAL_CONTENT: Content = {
  version: 'port-cendre-1',
  monsters: Object.fromEntries(ORIGINAL_MONSTERS.map((m) => [m.id, m])),
  attackDie: DEFAULT_ATTACK_DIE,
  defenseDie: DEFAULT_DEFENSE_DIE,
  tiles: Object.fromEntries(GAME_TILES.map((t) => [t.id, t])),
  rewards: ORIGINAL_REWARDS,
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

/** Scénario d'une partie tel qu'on le joue : celui de la difficulté choisie (niveau des monstres, renforts de départ). */
export function scenarioForGame(g: { scenarioId: string; generatedScenario?: string | undefined; difficulty: Difficulty }): ScenarioDefinition | undefined {
  const def = scenarioOfGame(g);
  return def && resolveDifficulty(def, g.difficulty);
}

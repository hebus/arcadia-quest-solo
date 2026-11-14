import { parseScenario } from '@/engine/scenario/definition';
import data from './terrain-essai.json';

/** Scénario lu dans `terrain-essai.json` (modifiable à la main : plateau en lignes, difficultés, script du maître de jeu). */
export const TERRAIN_ESSAI = parseScenario(data);

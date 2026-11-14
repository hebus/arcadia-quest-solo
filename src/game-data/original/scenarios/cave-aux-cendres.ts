import { parseScenario } from '@/engine/scenario/definition';
import data from './cave-aux-cendres.json';

/** Scénario lu dans `cave-aux-cendres.json` (modifiable à la main : plateau en lignes, difficultés, script du maître de jeu). */
export const CAVE_AUX_CENDRES = parseScenario(data);

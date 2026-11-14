import { parseScenario } from '@/engine/scenario/definition';
import data from './fosse-aux-cendres.json';

/** Scénario lu dans `fosse-aux-cendres.json` (modifiable à la main : plateau en lignes, difficultés, script du maître de jeu). */
export const FOSSE_AUX_CENDRES = parseScenario(data);

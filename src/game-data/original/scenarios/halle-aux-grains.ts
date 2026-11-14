import { parseScenario } from '@/engine/scenario/definition';
import data from './halle-aux-grains.json';

/** Scénario lu dans `halle-aux-grains.json` (modifiable à la main : plateau en lignes, difficultés, script du maître de jeu). */
export const HALLE_AUX_GRAINS = parseScenario(data);

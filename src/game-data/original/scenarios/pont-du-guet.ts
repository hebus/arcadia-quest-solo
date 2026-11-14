import { parseScenario } from '@/engine/scenario/definition';
import data from './pont-du-guet.json';

/** Scénario lu dans `pont-du-guet.json` (modifiable à la main : plateau en lignes, difficultés, script du maître de jeu). */
export const PONT_DU_GUET = parseScenario(data);

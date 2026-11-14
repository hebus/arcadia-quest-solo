import { parseScenario } from '@/engine/scenario/definition';
import data from './caveau-des-brumes.json';

/** Scénario lu dans `caveau-des-brumes.json` (modifiable à la main : plateau en lignes, difficultés, script du maître de jeu). */
export const CAVEAU_DES_BRUMES = parseScenario(data);

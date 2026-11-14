import { parseScenario } from '@/engine/scenario/definition';
import data from './corridor-des-ombres.json';

/** Scénario lu dans `corridor-des-ombres.json` (modifiable à la main : plateau en lignes, difficultés, script du maître de jeu). */
export const CORRIDOR_DES_OMBRES = parseScenario(data);

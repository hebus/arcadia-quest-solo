import { parseScenario } from '@/engine/scenario/definition';
import data from './trone-de-val-noir.json';

/** Scénario lu dans `trone-de-val-noir.json` (modifiable à la main : plateau en lignes, difficultés, script du maître de jeu). */
export const TRONE_DE_VAL_NOIR = parseScenario(data);

import { parseScenario } from '@/engine/scenario/definition';
import data from './marche-aux-ombres.json';

/** Scénario lu dans `marche-aux-ombres.json` (modifiable à la main : plateau en lignes, difficultés, script du maître de jeu). */
export const MARCHE_AUX_OMBRES = parseScenario(data);

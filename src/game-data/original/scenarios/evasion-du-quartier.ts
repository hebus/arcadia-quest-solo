import { parseScenario } from '@/engine/scenario/definition';
import data from './evasion-du-quartier.json';

/** Scénario lu dans `evasion-du-quartier.json` (modifiable à la main : plateau en lignes, difficultés, script du maître de jeu). */
export const EVASION_DU_QUARTIER = parseScenario(data);

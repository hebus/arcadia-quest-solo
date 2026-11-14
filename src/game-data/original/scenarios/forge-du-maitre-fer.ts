import { parseScenario } from '@/engine/scenario/definition';
import data from './forge-du-maitre-fer.json';

/** Scénario lu dans `forge-du-maitre-fer.json` (modifiable à la main : plateau en lignes, difficultés, script du maître de jeu). */
export const FORGE_DU_MAITRE_FER = parseScenario(data);

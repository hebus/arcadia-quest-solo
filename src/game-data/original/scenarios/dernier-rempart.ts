import { parseScenario } from '@/engine/scenario/definition';
import data from './dernier-rempart.json';

/** Scénario lu dans `dernier-rempart.json` (modifiable à la main : plateau en lignes, difficultés, script du maître de jeu). */
export const DERNIER_REMPART = parseScenario(data);

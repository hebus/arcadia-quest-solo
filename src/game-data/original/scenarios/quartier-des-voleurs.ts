import { parseScenario } from '@/engine/scenario/definition';
import data from './quartier-des-voleurs.json';

/** Scénario lu dans `quartier-des-voleurs.json` (modifiable à la main : plateau en lignes, difficultés, script du maître de jeu). */
export const QUARTIER_DES_VOLEURS = parseScenario(data);

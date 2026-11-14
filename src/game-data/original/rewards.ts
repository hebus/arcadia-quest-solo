import { parseRewardCards } from '@/engine/rewards';
import data from './rewards.json';

/** Les 12 cartes Récompense de la boîte de base (21 exemplaires), lues dans `rewards.json`. */
export const ORIGINAL_REWARDS = parseRewardCards(data);

import { type } from 'arktype';
import type { RandomSource } from './random';

/**
 * Cartes Récompense (équipement) : un vilain abattu ou un coffre ouvert en donne une, fixée par le scénario ou tirée au
 * hasard. Chaque carte existe en quelques exemplaires dans la boîte (`copies`) : on ne distribue jamais plus d'exemplaires
 * que la boîte n'en contient. Les effets sont indicatifs, la carte physique fait foi.
 */
export const RewardCardSchema = type({
  id: 'string',
  name: 'string',
  'nameVo?': 'string | undefined',
  'scenario?': 'string | undefined',
  copies: 'number.integer > 0',
  type: 'string',
  effect: 'string',
});
export type RewardCard = typeof RewardCardSchema.infer;

/** Lit le fichier des récompenses (`rewards.json`). */
export function parseRewardCards(raw: unknown): RewardCard[] {
  const list = (raw as { cards?: unknown })?.cards;
  if (!Array.isArray(list)) throw new Error('Récompenses : la liste « cards » est absente.');
  const seen = new Set<string>();
  return list.map((c, i) => {
    const out = RewardCardSchema(c);
    if (out instanceof type.errors) throw new Error(`Récompenses : carte n° ${i + 1} invalide (${out.summary}).`);
    if (seen.has(out.id)) throw new Error(`Récompenses : identifiant en double « ${out.id} ».`);
    seen.add(out.id);
    return out;
  });
}

/** Identifiants encore disponibles : une entrée par exemplaire restant, une fois retirés ceux déjà gagnés. */
export function availableRewards(catalog: readonly RewardCard[], owned: readonly string[]): string[] {
  const left = new Map(catalog.map((c) => [c.id, c.copies]));
  for (const id of owned) if (left.has(id)) left.set(id, left.get(id)! - 1);
  return catalog.flatMap((c) => Array.from({ length: Math.max(0, left.get(c.id)!) }, () => c.id));
}

/** Tire une carte au hasard parmi les exemplaires restants (chaque exemplaire a la même chance) ; undefined si la boîte est vide. */
export function drawReward(catalog: readonly RewardCard[], owned: readonly string[], rng: RandomSource): string | undefined {
  const pool = availableRewards(catalog, owned);
  return pool.length === 0 ? undefined : pool[rng.nextInt(0, pool.length - 1)];
}

export const rewardById = (catalog: readonly RewardCard[], id: string): RewardCard | undefined => catalog.find((c) => c.id === id);

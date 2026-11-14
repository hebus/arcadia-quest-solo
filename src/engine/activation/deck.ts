import type { ActivationCard, GameState } from '../domain/schemas';
import { log } from '../state';
import { shuffle, type RandomSource } from '../random';

/** Remélange la défausse dans la pioche (deck vide, solo v1.3 p.6 ; deux Wild Pet d'affilée, p.4). */
export function recycleDiscard(s: GameState, rng: RandomSource, reason: string): void {
  s.deck.draw = shuffle([...s.deck.draw, ...s.deck.discard], rng);
  s.deck.discard = [];
  log(s, 'deck-recycled', `Défausse remélangée (${reason}) : ${s.deck.draw.length} carte(s).`);
}

/**
 * Pioche une carte. En mode carte physique, `pick` désigne le type annoncé : on retire la première carte
 * correspondante pour garder les compteurs cohérents (le deck physique fait foi).
 */
export function drawCard(s: GameState, rng: RandomSource, pick: string | null): ActivationCard {
  if (s.deck.draw.length === 0) {
    if (s.deck.discard.length === 0) throw new Error("Deck d'activation vide et défausse vide");
    recycleDiscard(s, rng, 'deck épuisé');
  }
  let idx = 0;
  if (pick) {
    idx = s.deck.draw.findIndex((c) => (pick === 'wild-pet' ? c.kind === 'wild-pet' : c.monsterDefId === pick));
    if (idx < 0) throw new Error(`Carte « ${pick} » absente de la pioche : deck numérique désynchronisé`);
  }
  const [card] = s.deck.draw.splice(idx, 1);
  return card!;
}

export function discardCard(s: GameState, card: ActivationCard): void {
  s.deck.discard.push(card);
}

/** Ajoute les cartes retardées d'un monstre (ex. Lord Fang une fois sa figurine placée) au deck, mélangé. */
export function releaseDelayedCards(s: GameState, monsterDefId: string, rng: RandomSource): number {
  const released = s.deck.delayed.filter((c) => c.monsterDefId === monsterDefId);
  if (released.length === 0) return 0;
  s.deck.delayed = s.deck.delayed.filter((c) => c.monsterDefId !== monsterDefId);
  s.deck.draw = shuffle([...s.deck.draw, ...released], rng);
  log(s, 'deck-cards-added', `${released.length} carte(s) ajoutée(s) au deck d'activation.`, { monsterDefId });
  return released.length;
}

/** Option B13 : retire les cartes d'un type dont toutes les figurines ont quitté le jeu (Spawn Tile comprise). */
export function pruneEliminatedTypes(s: GameState): void {
  if (!s.settings.removeCardsOfEliminatedTypes) return;
  const alive = new Set(
    s.monsters.filter((m) => m.status === 'board' || m.status === 'spawn-tile').map((m) => m.definitionId),
  );
  const drop = (c: ActivationCard) => c.kind === 'monster' && !alive.has(c.monsterDefId!);
  const removed = [...s.deck.draw, ...s.deck.discard].filter(drop);
  if (removed.length === 0) return;
  s.deck.draw = s.deck.draw.filter((c) => !drop(c));
  s.deck.discard = s.deck.discard.filter((c) => !drop(c));
  s.deck.excluded.push(...removed);
  log(s, 'deck-pruned', `${removed.length} carte(s) retirée(s) : type de monstre éliminé du jeu.`);
}

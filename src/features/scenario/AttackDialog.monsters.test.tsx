import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { addMonster } from '@/engine/sandbox';
import { ORIGINAL_CONTENT } from '@/game-data/original';
import { useCampaignStore } from '@/stores/campaignStore';
import { defaultContent, useGameStore } from '@/stores/gameStore';
import { useTileStore } from '@/stores/tileStore';

beforeEach(() => {
  useGameStore.setState({ game: null, history: [], instructions: [], traces: [], answers: [], error: null, agent: { status: 'ready' }, content: defaultContent(), selectedId: null, placing: null, correctionMode: false, beats: [], script: [] });
  useCampaignStore.setState({ campaign: null, error: null });
  useTileStore.setState({ tiles: [], loaded: true });
});

/** Démarre le scénario 1, pose le monstre `id` sur la case de Brogan (h2, même Space : à portée de mêlée) et ouvre l'attaque au corps à corps. */
async function openAttackOn(user: ReturnType<typeof userEvent.setup>, id: string) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
  await user.click(screen.getByRole('button', { name: /Voir le briefing : Les Braises/ }));
  await user.click(screen.getByRole('button', { name: /Commencer l’aventure/ }));
  await user.click(await screen.findByRole('button', { name: 'Démarrer le scénario' }));
  const h2 = useGameStore.getState().game!.heroes[1]!.position!;
  // Le scénario 1 a déjà ses vilains, ses tireurs et son marteau, dont les boîtes sont pleines : on retire d'abord les figurines de ce type.
  act(() => useGameStore.setState((st) => ({ game: addMonster({ ...st.game!, monsters: st.game!.monsters.filter((m) => m.definitionId !== id) }, ORIGINAL_CONTENT, id, h2) })));
  const monsterId = useGameStore.getState().game!.monsters.find((m) => m.definitionId === id && m.position && m.position.x === h2.x && m.position.y === h2.y)!.id;
  fireEvent.click(screen.getByTestId('token-h2'));
  fireEvent.click(screen.getByTestId('token-h2'));
  fireEvent.click(screen.getByTestId('menu-melee'));
  fireEvent.click(screen.getByTestId(`token-${monsterId}`));
  const dialog = await screen.findByRole('region', { name: /attaque/ });
  return { dialog, card: within(dialog).getByTestId(`monster-card-${monsterId}`), monsterId };
}

describe('dialogue d’attaque : classe, défense et capacités du monstre ciblé', () => {
  it('Minotaur : vilain mineur, 1 dé de défense blanc, critique = blessure en plus', async () => {
    const { card, monsterId } = await openAttackOn(userEvent.setup(), 'M');
    expect(card).toHaveTextContent('Minotaur · vilain mineur');
    expect(screen.getByTestId(`monster-defense-${monsterId}`)).toHaveTextContent('Défense : 1 dé blanc : un bouclier ou un critique annule une touche, lancez-les avant d’indiquer les blessures.');
    expect(card).toHaveTextContent('Chaque critique donne une blessure supplémentaire');
  });

  it('Troll : vilain mineur, 2 dés de défense blancs, attaque tous les héros adjacents', async () => {
    const { card, monsterId } = await openAttackOn(userEvent.setup(), 'T');
    expect(card).toHaveTextContent('Troll · vilain mineur');
    expect(screen.getByTestId(`monster-defense-${monsterId}`)).toHaveTextContent('Défense : 2 dés blancs');
    expect(card).toHaveTextContent('Son attaque cible tous les héros adjacents.');
  });

  it('Spear Beastman : minion majeur, pas de défense, un dé de plus près d’un autre monstre', async () => {
    const { card, monsterId } = await openAttackOn(userEvent.setup(), 'SB');
    expect(card).toHaveTextContent('Spear Beastman · minion majeur');
    expect(screen.queryByTestId(`monster-defense-${monsterId}`)).not.toBeInTheDocument();
    expect(card).toHaveTextContent('Lance un dé d’attaque supplémentaire s’il est adjacent à un autre monstre.');
  });

  it('Hammer Beastman : minion majeur, étourdit le héros touché', async () => {
    const { card } = await openAttackOn(userEvent.setup(), 'HB');
    expect(card).toHaveTextContent('Hammer Beastman · minion majeur');
    expect(card).toHaveTextContent('Si au moins une blessure passe, le héros est étourdi.');
  });

  it('Orc Captain : minion mineur, 1 relance, pas de défense', async () => {
    const { card, monsterId } = await openAttackOn(userEvent.setup(), 'OC');
    expect(card).toHaveTextContent('Orc Captain · minion mineur');
    expect(card).toHaveTextContent('1 relance de l’attaque.');
    expect(screen.queryByTestId(`monster-defense-${monsterId}`)).not.toBeInTheDocument();
  });

  it('Orc Marauder : minion mineur, ni défense ni capacité', async () => {
    const { card, monsterId } = await openAttackOn(userEvent.setup(), 'OM');
    expect(card).toHaveTextContent('Orc Marauder · minion mineur');
    expect(screen.queryByTestId(`monster-defense-${monsterId}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`monster-skill-${monsterId}`)).not.toBeInTheDocument();
  });
});

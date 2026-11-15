import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCampaignStore } from '@/stores/campaignStore';
import { defaultContent, useGameStore } from '@/stores/gameStore';
import { useTileStore } from '@/stores/tileStore';
import { App } from './App';

beforeEach(() => {
  useGameStore.setState({ game: null, history: [], instructions: [], traces: [], answers: [], error: null, agent: { status: 'ready' }, content: defaultContent(), selectedId: null, placing: null, correctionMode: false, beats: [], script: [] });
  useCampaignStore.setState({ campaign: null, error: null });
  useTileStore.setState({ tiles: [], loaded: true });
});

async function startDemo(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: /Nouvelle partie/ }));
  await user.click(screen.getByRole('button', { name: 'Charger la démo' }));
  await user.click(screen.getByRole('button', { name: '4. Quêtes et deck' }));
  await user.click(screen.getByRole('button', { name: 'Vérifier' }));
  await user.click(screen.getByRole('button', { name: 'Créer la partie' }));
  await user.click(await screen.findByRole('button', { name: 'Démarrer le scénario' }));
}

describe('écran de jeu sobre : plateau, barre d’actions, le reste en dialogues', () => {
  it('par défaut : aucun panneau de détail, aucun dialogue ouvert', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    expect(screen.getByRole('img', { name: 'Plateau de jeu' })).toBeInTheDocument();
    expect(screen.getByTestId('action-dock')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    for (const panel of ['Mode sync', 'Historique', 'Objectifs', 'Héros', /Monstres/]) {
      expect(screen.queryByRole('region', { name: panel })).not.toBeInTheDocument();
    }
  });

  it('la barre d’état tient en une ligne : phase, manche, morts, quêtes, pièces', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    const bar = screen.getByLabelText('État de la partie');
    expect(bar).toHaveTextContent('Tour de guilde');
    expect(bar).toHaveTextContent('Manche 1');
    expect(bar).toHaveTextContent('☠ 0/3');
    expect(bar).toHaveTextContent('⚑ 0/2');
    expect(bar).toHaveTextContent('🪙 0');
  });

  it('le menu s’ouvre à la demande, change de section et se ferme avec Échap', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    const menu = screen.getByRole('dialog', { name: 'Menu de la partie' });
    expect(within(menu).getByRole('region', { name: 'Héros' })).toBeInTheDocument();
    await user.click(within(menu).getByRole('button', { name: 'Journal' }));
    expect(within(menu).getByRole('list', { name: 'Journal des événements' })).toBeInTheDocument();
    // Les corrections se font directement sur le plateau (bouton Sync) : plus d'onglet dédié.
    expect(within(menu).queryByRole('button', { name: 'Corrections' })).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('l’attaque s’ouvre à la place des cartes héros et se ferme sans rien résoudre', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    useGameStore.setState((st) => ({ game: { ...st.game!, monsters: st.game!.monsters.map((m) => (m.id === 'goblin1' ? { ...m, position: { x: 1, y: 6 } } : m)) } }));
    fireEvent.click(screen.getByTestId('token-h3'));
    fireEvent.click(screen.getByTestId('token-h3'));
    fireEvent.click(screen.getByTestId('menu-ranged'));
    fireEvent.click(screen.getByTestId('token-goblin1'));
    const panel = await screen.findByTestId('attack-panel');
    expect(within(panel).getByRole('region', { name: 'Zazu attaque' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hero-roster')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('attack-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('hero-roster')).toBeInTheDocument();
    expect(useGameStore.getState().game!.heroTurn.h3?.attacked ?? false).toBe(false);
  });

  it('la saisie des dés matériels est un dialogue, pas un bloc de la page', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    useGameStore.getState().setSettings({ cardMode: 'physical' });
    await user.click(screen.getByRole('button', { name: /Repérer Grom/ }));
    await user.click(screen.getByRole('button', { name: 'Activer sans agir' }));
    await user.click(screen.getByRole('button', { name: 'Fin de tour' }));
    const dialog = screen.getByRole('dialog', { name: 'Résultat des dés' });
    expect(within(dialog).getByRole('group', { name: 'Saisie requise' })).toBeInTheDocument();
  });

  it('les héros sont des cartes à côté du plateau, avec leurs points de vie en cœurs', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    const heroes = screen.getByTestId('hero-roster');
    expect(within(heroes).getAllByRole('button', { name: /Repérer/ })).toHaveLength(3);
    expect(within(heroes).getAllByRole('button', { name: /^Soigner / })).toHaveLength(3);
    expect(within(heroes).getAllByRole('button', { name: /^Blesser / })).toHaveLength(3);
    expect(within(heroes).getByRole('button', { name: /Repérer Grom/ })).toHaveTextContent('❤❤❤❤');
  });
});

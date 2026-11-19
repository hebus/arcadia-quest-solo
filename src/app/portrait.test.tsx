import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCampaignStore } from '@/stores/campaignStore';
import { defaultContent, useGameStore } from '@/stores/gameStore';
import { useTileStore } from '@/stores/tileStore';
import { App } from './App';

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
  useGameStore.setState({ game: null, history: [], instructions: [], traces: [], answers: [], error: null, agent: { status: 'ready' }, content: defaultContent(), selectedId: null, placing: null, correctionMode: false, beats: [], script: [] });
  useCampaignStore.setState({ campaign: null, error: null });
  useTileStore.setState({ tiles: [], loaded: true });
});
afterEach(() => vi.unstubAllGlobals());

describe('mode portrait : barre d’onglets et tiroirs', () => {
  it('les héros et les objectifs sont dans des tiroirs, pas sous le plateau', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Nouvelle partie/ }));
    await user.click(screen.getByRole('button', { name: 'Charger la démo' }));
    await user.click(screen.getByRole('button', { name: '4. Quêtes et deck' }));
    await user.click(screen.getByRole('button', { name: 'Vérifier' }));
    await user.click(screen.getByRole('button', { name: 'Créer la partie' }));
    await user.click(await screen.findByRole('button', { name: 'Démarrer le scénario' }));

    expect(screen.getByTestId('portrait-dock')).toBeInTheDocument();
    expect(screen.queryByTestId('hero-roster')).not.toBeInTheDocument();

    const dock = within(screen.getByTestId('portrait-dock'));
    await user.click(dock.getByRole('button', { name: /Héros/ }));
    const drawer = screen.getByRole('dialog', { name: 'Héros' });
    expect(within(drawer).getByTestId('hero-roster')).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Fermer : Héros' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(dock.getByRole('button', { name: /Scénario/ }));
    expect(within(screen.getByRole('dialog')).getByRole('region', { name: 'Objectifs' })).toBeInTheDocument();
  });
});

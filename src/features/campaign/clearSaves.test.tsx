import 'fake-indexeddb/auto';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { createCampaign } from '@/engine/campaign';
import { getDb } from '@/infrastructure/persistence/db';
import { Repository } from '@/infrastructure/persistence/repository';
import { useCampaignStore } from '@/stores/campaignStore';
import { defaultContent, useGameStore } from '@/stores/gameStore';
import { useTileStore } from '@/stores/tileStore';
import { demoGame } from '@/tests/fixtures/demo';

const TILE = { id: 't1', name: 'T1', crop: { l: 0, t: 0, r: 0, b: 0 }, imageRotation: 0 as const, interior: [], walls: [], openedWalls: [], doors: [] };

beforeEach(async () => {
  const db = getDb();
  await Promise.all([db.sessions.clear(), db.snapshots.clear(), db.campaigns.clear(), db.backups.clear(), db.prefs.clear(), db.tiles.clear()]);
  useGameStore.setState({ game: null, history: [], instructions: [], traces: [], answers: [], error: null, agent: { status: 'ready' }, content: defaultContent(), selectedId: null, placing: null, correctionMode: false, beats: [], script: [] });
  const camp = createCampaign({ id: 'c1', name: 'Ma campagne', contentVersion: 'v', heroIds: ['a', 'b', 'c'] });
  useCampaignStore.setState({ campaign: camp, error: null });
  useTileStore.setState({ tiles: [TILE], loaded: true });
  const r = new Repository();
  await r.saveSession(demoGame(), 'c1');
  await r.saveCampaign(camp);
  await r.saveTile(TILE);
});

describe('effacer toutes les sauvegardes (accueil)', () => {
  it('demande confirmation ; annuler ne supprime rien', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText(/demo-scenario/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Effacer toutes les sauvegardes/ }));
    const dialog = screen.getByRole('dialog', { name: 'Effacer les sauvegardes' });
    expect(dialog).toHaveTextContent(/définitivement effacées/);
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await getDb().sessions.count()).toBe(1);
    expect(screen.getByText(/demo-scenario/)).toBeInTheDocument();
  });

  it('confirmer efface parties, campagnes et mémoire de l’application ; les tuiles restent par défaut', async () => {
    const user = userEvent.setup();
    useGameStore.setState({ game: demoGame() });
    render(<App />);
    await screen.findByText(/demo-scenario/);
    await user.click(screen.getByRole('button', { name: /Effacer toutes les sauvegardes/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tout effacer' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Toutes les sauvegardes ont été effacées');
    expect(screen.getByText(/Aucune partie sauvegardée/)).toBeInTheDocument();
    await waitFor(async () => expect(await getDb().sessions.count()).toBe(0));
    expect(await getDb().campaigns.count()).toBe(0);
    expect(useGameStore.getState().game).toBeNull();
    expect(useCampaignStore.getState().campaign).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reprendre la partie en cours' })).not.toBeInTheDocument();
    // Tuiles conservées sauf demande contraire.
    expect(await getDb().tiles.count()).toBe(1);
    expect(useTileStore.getState().tiles).toHaveLength(1);
  });

  it('la case « tuiles importées » les efface aussi', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(/demo-scenario/);
    await user.click(screen.getByRole('button', { name: /Effacer toutes les sauvegardes/ }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('checkbox', { name: /bibliothèque de tuiles/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Tout effacer' }));
    await screen.findByRole('status');
    expect(await getDb().tiles.count()).toBe(0);
    expect(useTileStore.getState().tiles).toEqual([]);
  });
});

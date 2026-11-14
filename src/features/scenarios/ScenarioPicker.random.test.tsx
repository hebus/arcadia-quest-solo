import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { scenarioOfGame } from '@/game-data/original';
import { useCampaignStore } from '@/stores/campaignStore';
import { defaultContent, useGameStore } from '@/stores/gameStore';
import { useTileStore } from '@/stores/tileStore';

beforeEach(() => {
  useGameStore.setState({ game: null, history: [], instructions: [], traces: [], answers: [], error: null, agent: { status: 'ready' }, content: defaultContent(), selectedId: null, placing: null, correctionMode: false, beats: [], script: [] });
  useCampaignStore.setState({ campaign: null, error: null });
  useTileStore.setState({ tiles: [], loaded: true });
});

async function openRandomMode(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
  return screen.getByTestId('random-mode');
}

describe('mode aléatoire', () => {
  it('on donne le nombre de tuiles, un scénario est généré et son briefing s’affiche', async () => {
    const user = userEvent.setup();
    const card = await openRandomMode(user);
    expect(within(card).getByText(/Scénario aléatoire/)).toBeInTheDocument();
    fireEvent.change(within(card).getByLabelText('Nombre de tuiles'), { target: { value: '5' } });
    await user.click(within(card).getByRole('button', { name: 'Générer un scénario' }));
    expect(screen.getByRole('heading', { name: /Scénario aléatoire · 5 tuiles/ })).toBeInTheDocument();
    // L'aperçu porte le numéro des 5 tuiles tirées, et le bouton des tuiles du briefing est là.
    const preview = screen.getByRole('img', { name: 'Aperçu du scénario' });
    expect(preview.querySelectorAll('[data-testid^="tile-label-"]')).toHaveLength(5);
    expect(screen.getByRole('button', { name: /Voir les tuiles/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Commencer l’aventure/ })).toBeEnabled();
  });

  it('le nombre de tuiles reste entre 1 et 9', async () => {
    const user = userEvent.setup();
    const card = await openRandomMode(user);
    const input = within(card).getByLabelText('Nombre de tuiles') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '25' } });
    expect(input.value).toBe('9');
    fireEvent.change(input, { target: { value: '0' } });
    expect(input.value).toBe('1');
    await user.click(within(card).getByRole('button', { name: 'Générer un scénario' }));
    expect(screen.getByRole('heading', { name: /Scénario aléatoire · 1 tuile$/ })).toBeInTheDocument();
  });

  it('« Autre tirage » génère un autre scénario avec le même nombre de tuiles', async () => {
    const user = userEvent.setup();
    const card = await openRandomMode(user);
    fireEvent.change(within(card).getByLabelText('Nombre de tuiles'), { target: { value: '6' } });
    await user.click(within(card).getByRole('button', { name: 'Générer un scénario' }));
    const labels = () => Array.from(screen.getByRole('img', { name: 'Aperçu du scénario' }).querySelectorAll('[data-testid^="tile-label-"]')).map((n) => n.textContent);
    const seen = new Set<string>([labels().join()]);
    for (let i = 0; i < 6; i++) {
      await user.click(screen.getByRole('button', { name: /Autre tirage/ }));
      expect(labels()).toHaveLength(6);
      seen.add(labels().join());
    }
    expect(seen.size).toBeGreaterThan(1); // les tirages diffèrent
  });

  it('un scénario classique n’a pas de bouton « Autre tirage »', async () => {
    const user = userEvent.setup();
    await openRandomMode(user);
    await user.click(screen.getByRole('button', { name: /Voir le briefing : Les Braises/ }));
    expect(screen.queryByRole('button', { name: /Autre tirage/ })).not.toBeInTheDocument();
  });

  it('la partie garde le scénario généré : script, quêtes et histoire se retrouvent à la reprise', async () => {
    const user = userEvent.setup();
    const card = await openRandomMode(user);
    fireEvent.change(within(card).getByLabelText('Nombre de tuiles'), { target: { value: '4' } });
    await user.click(within(card).getByRole('button', { name: 'Générer un scénario' }));
    await user.click(screen.getByRole('button', { name: /Commencer l’aventure/ }));
    const g = useGameStore.getState().game!;
    expect(g.scenarioId).toMatch(/^aleatoire-\d+$/);
    expect(g.generatedScenario).toBeTruthy();
    expect(g.tileLayout!.placements).toHaveLength(4);
    expect(useGameStore.getState().script.length).toBe(2);
    // Reprise : le scénario n'est pas dans les données livrées, il est relu depuis la partie.
    const def = scenarioOfGame(g)!;
    expect(def.generated).toBe(true);
    expect(def.story.win.length).toBeGreaterThan(0);
    act(() => useGameStore.getState().loadGame(g));
    expect(useGameStore.getState().script).toHaveLength(2);
    // Un identifiant inconnu sans définition gardée : pas de scénario.
    expect(scenarioOfGame({ scenarioId: 'inconnu' })).toBeUndefined();
  });
});

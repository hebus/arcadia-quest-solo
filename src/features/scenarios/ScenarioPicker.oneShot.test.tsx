import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { useCampaignStore } from '@/stores/campaignStore';
import { defaultContent, useGameStore } from '@/stores/gameStore';
import { useTileStore } from '@/stores/tileStore';

beforeEach(() => {
  useGameStore.setState({ game: null, history: [], instructions: [], traces: [], answers: [], error: null, agent: { status: 'ready' }, content: defaultContent(), selectedId: null, placing: null, correctionMode: false, beats: [], script: [] });
  useCampaignStore.setState({ campaign: null, error: null });
  useTileStore.setState({ tiles: [], loaded: true });
});

describe('scénarios one shot : choix de la difficulté au briefing', () => {
  it('la liste annonce les one shots, et le briefing change de niveau avec la difficulté', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
    expect(screen.getAllByText(/One shot · difficulté au choix/).length).toBe(5);
    await user.click(screen.getByRole('button', { name: /Voir le briefing : Le Quartier des Voleurs/ }));
    const summary = () => screen.getByTestId('difficulty-summary').textContent ?? '';
    expect(summary()).toContain('Niveau des monstres : 1'); // conseillée : facile
    await user.selectOptions(screen.getByRole('combobox', { name: 'Difficulté' }), 'legendary');
    expect(summary()).toContain('Niveau des monstres : 6');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Difficulté' }), 'hard');
    expect(summary()).toContain('Niveau des monstres : 4-5');
    await user.click(screen.getByRole('button', { name: /Commencer l’aventure/ }));
    const g = useGameStore.getState().game!;
    expect(g.monsterCardSet).toBe('4-5');
    expect(g.difficulty).toBe('hard');
    expect(useGameStore.getState().script.length).toBeGreaterThan(2);
  });

  it('un scénario classique n’affiche pas de niveau de monstres', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
    await user.click(screen.getByRole('button', { name: /Voir le briefing : Les Braises/ }));
    expect(screen.queryByTestId('difficulty-summary')).not.toBeInTheDocument();
  });
});

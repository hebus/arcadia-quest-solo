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

/** Zazu (défense 2) quitte la case où le gobelin la menace : réaction Guard, le gobelin touche toujours 2 fois. */
async function guardPrompt(user: ReturnType<typeof userEvent.setup>) {
  await startDemo(user);
  useGameStore.setState((s) => ({
    content: { ...s.content, attackDie: [{ symbol: 'sword', melee: true, ranged: false, crit: false, save: false }] },
    game: {
      ...s.game!,
      heroes: s.game!.heroes.map((h) => ({ ...h, defense: 2 })),
      monsters: s.game!.monsters.map((m) => (m.id === 'goblin1' ? { ...m, position: { x: 1, y: 6 } } : m)),
    },
  }));
  fireEvent.click(screen.getByTestId('token-h3'));
  fireEvent.click(screen.getByTestId('cell-0-7'));
  await user.click(screen.getByRole('button', { name: /Continuer : lancer mes dés/ })); // l'annonce d'abord, puis les dés
  return screen.getByRole('region', { name: 'Jet de défense' });
}

describe('jet de défense : le joueur indique ses boucliers', () => {
  it('chaque touche du monstre est une épée ; chaque bouclier touché en barre une', async () => {
    const user = userEvent.setup();
    const dialog = await guardPrompt(user);
    const hits = () => within(dialog).getAllByTestId('monster-hit');
    expect(hits()).toHaveLength(2);
    expect(hits().every((h) => h.getAttribute('data-cancelled') === 'false')).toBe(true);
    expect(dialog).toHaveTextContent('2 blessures');

    await user.click(within(dialog).getByRole('button', { name: 'Boucliers, dé 1' }));
    expect(hits().filter((h) => h.getAttribute('data-cancelled') === 'true')).toHaveLength(1);
    expect(dialog).toHaveTextContent('1 blessure');

    await user.click(within(dialog).getByRole('button', { name: 'Boucliers, dé 2' }));
    expect(hits().every((h) => h.getAttribute('data-cancelled') === 'true')).toBe(true);
    expect(dialog).toHaveTextContent('Aucune blessure');
  });

  it('valider applique exactement touches − boucliers en blessures au héros', async () => {
    const user = userEvent.setup();
    const dialog = await guardPrompt(user);
    await user.click(within(dialog).getByRole('button', { name: 'Boucliers, dé 1' })); // 2 touches, 1 bouclier
    await user.click(within(dialog).getByRole('button', { name: 'Valider' }));
    expect(screen.queryByRole('region', { name: 'Jet de défense' })).not.toBeInTheDocument();
    expect(useGameStore.getState().game!.heroes[2]!.wounds).toBe(1);
  });

  it('sans aucun bouclier, toutes les touches blessent', async () => {
    const user = userEvent.setup();
    const dialog = await guardPrompt(user);
    await user.click(within(dialog).getByRole('button', { name: 'Valider' }));
    expect(useGameStore.getState().game!.heroes[2]!.wounds).toBe(2);
  });

  it('une partie démarre avec le jet de défense du joueur, modifiable ensuite dans les paramètres', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    expect(useGameStore.getState().game!.settings.defenseRoll).toBe('physical');
    useGameStore.getState().setSettings({ defenseRoll: 'digital' });
    expect(useGameStore.getState().game!.settings.defenseRoll).toBe('digital');
  });

  it('avant le dialogue de dés, le plateau montre qui attaque qui ; le dialogue attend la confirmation', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    useGameStore.setState((st) => ({
      content: { ...st.content, attackDie: [{ symbol: 'sword', melee: true, ranged: false, crit: false, save: false }] },
      game: {
        ...st.game!,
        heroes: st.game!.heroes.map((h) => ({ ...h, defense: 2 })),
        monsters: st.game!.monsters.map((m) => (m.id === 'goblin1' ? { ...m, position: { x: 1, y: 6 } } : m)),
      },
    }));
    fireEvent.click(screen.getByTestId('token-h3'));
    fireEvent.click(screen.getByTestId('cell-0-7'));

    // Annonce : pas encore de dialogue de dés, mais l'attaque est montrée sur le plateau.
    expect(screen.queryByRole('region', { name: 'Jet de défense' })).not.toBeInTheDocument();
    const card = screen.getByTestId('attack-announcement');
    expect(card).toHaveTextContent('Goblin');
    expect(card).toHaveTextContent('attaque');
    expect(card).toHaveTextContent('Zazu');
    const overlay = screen.getByTestId('instruction-overlay');
    expect(overlay.querySelector('circle[stroke="#f59e0b"]')).not.toBeNull(); // anneau de l'attaquant
    expect(overlay.querySelector('circle[stroke="#ef4444"]')).not.toBeNull(); // anneau de la cible
    expect(screen.getByTestId('instruction-arrow')).toHaveAttribute('stroke', '#ef4444'); // flèche d'attaque
    // Rien n'est joué tant que le joueur n'a pas vu : la partie n'est pas modifiée.
    expect(useGameStore.getState().game!.heroes[2]!.wounds).toBe(0);

    await user.click(within(card).getByRole('button', { name: /Continuer/ }));
    expect(screen.queryByTestId('attack-announcement')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Jet de défense' })).toBeInTheDocument();
    expect(screen.queryByTestId('instruction-arrow')).not.toBeInTheDocument();
  });

  it('toucher la cible sur le plateau confirme aussi l’annonce', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    useGameStore.setState((st) => ({
      content: { ...st.content, attackDie: [{ symbol: 'sword', melee: true, ranged: false, crit: false, save: false }] },
      game: {
        ...st.game!,
        heroes: st.game!.heroes.map((h) => ({ ...h, defense: 2 })),
        monsters: st.game!.monsters.map((m) => (m.id === 'goblin1' ? { ...m, position: { x: 1, y: 6 } } : m)),
      },
    }));
    fireEvent.click(screen.getByTestId('token-h3'));
    fireEvent.click(screen.getByTestId('cell-0-7'));
    expect(screen.getByTestId('attack-announcement')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cell-1-7')); // la case de Zazu, la cible
    expect(screen.queryByTestId('attack-announcement')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Jet de défense' })).toBeInTheDocument();
  });

  it('pendant l’annonce, aucun pion ne se glisse et une autre case ne valide rien', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    useGameStore.setState((st) => ({
      content: { ...st.content, attackDie: [{ symbol: 'sword', melee: true, ranged: false, crit: false, save: false }] },
      game: {
        ...st.game!,
        heroes: st.game!.heroes.map((h) => ({ ...h, defense: 2 })),
        monsters: st.game!.monsters.map((m) => (m.id === 'goblin1' ? { ...m, position: { x: 1, y: 6 } } : m)),
      },
    }));
    fireEvent.click(screen.getByTestId('token-h3'));
    fireEvent.click(screen.getByTestId('cell-0-7'));
    fireEvent.click(screen.getByTestId('cell-7-0')); // case sans rapport
    expect(screen.getByTestId('attack-announcement')).toBeInTheDocument();
  });

  it('une case de bouclier par touche : le joueur peut annuler toutes les touches même avec moins de dés de défense', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    // Zazu n'a qu'1 dé de défense, mais le gobelin touche 2 fois : un critique peut donner 2 boucliers.
    useGameStore.setState((st) => ({
      content: { ...st.content, attackDie: [{ symbol: 'sword', melee: true, ranged: false, crit: false, save: false }] },
      game: {
        ...st.game!,
        heroes: st.game!.heroes.map((h) => ({ ...h, defense: 1 })),
        monsters: st.game!.monsters.map((m) => (m.id === 'goblin1' ? { ...m, position: { x: 1, y: 6 } } : m)),
      },
    }));
    fireEvent.click(screen.getByTestId('token-h3'));
    fireEvent.click(screen.getByTestId('cell-0-7'));
    await user.click(screen.getByRole('button', { name: /Continuer : lancer mes dés/ }));
    const dialog = screen.getByRole('region', { name: 'Jet de défense' });
    expect(dialog).toHaveTextContent('Lancez vos 1 dé de défense');
    const shields = within(dialog).getAllByRole('button', { name: /Boucliers, dé \d/ });
    expect(shields).toHaveLength(2); // une case par touche, pas par dé lancé
    await user.click(within(dialog).getByRole('button', { name: 'Boucliers, dé 2' }));
    expect(dialog).toHaveTextContent('Aucune blessure');
    await user.click(within(dialog).getByRole('button', { name: 'Valider' }));
    expect(useGameStore.getState().game!.heroes[2]!.wounds).toBe(0);
  });

  it('jamais plus de cases de bouclier que de touches : les boucliers en trop ne servent à rien', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    useGameStore.setState((st) => ({
      content: { ...st.content, attackDie: [{ symbol: 'sword', melee: true, ranged: false, crit: false, save: false }] },
      game: {
        ...st.game!,
        heroes: st.game!.heroes.map((h) => ({ ...h, defense: 5 })),
        monsters: st.game!.monsters.map((m) => (m.id === 'goblin1' ? { ...m, position: { x: 1, y: 6 } } : m)),
      },
    }));
    fireEvent.click(screen.getByTestId('token-h3'));
    fireEvent.click(screen.getByTestId('cell-0-7'));
    await user.click(screen.getByRole('button', { name: /Continuer : lancer mes dés/ }));
    const dialog = screen.getByRole('region', { name: 'Jet de défense' });
    expect(within(dialog).getAllByRole('button', { name: /Boucliers, dé \d/ })).toHaveLength(2);
  });
});


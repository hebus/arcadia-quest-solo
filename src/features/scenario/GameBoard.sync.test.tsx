import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '@/stores/gameStore';
import { useTileStore } from '@/stores/tileStore';
import { skillContent, skillGame } from '@/tests/fixtures/skillGame';
import { GameBoard } from './GameBoard';

/** Maya (h2) en (2,4) ; un monstre collé à elle en (3,4) et un autre loin, en (6,0). */
beforeEach(() => {
  useTileStore.setState({ tiles: [], loaded: true });
  const g = skillGame([
    { id: 'P1', definitionId: 'plain', position: { x: 3, y: 4 } },
    { id: 'P2', definitionId: 'plain', position: { x: 6, y: 0 } },
  ]);
  useGameStore.setState({ game: g, content: skillContent, history: [], instructions: [], answers: [], beats: [], script: [], selectedId: null, placing: null, correctionMode: false, error: null, agent: { status: 'ready' } });
});

describe('plateau : mode sync', () => {
  it('le bouton Sync est toujours visible et bascule le mode, sans rien dans le menu', () => {
    render(<GameBoard />);
    const toggle = screen.getByTestId('sync-toggle');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('sync-panel')).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(useGameStore.getState().correctionMode).toBe(true);
    expect(screen.getByTestId('sync-panel')).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(useGameStore.getState().correctionMode).toBe(false);
  });

  it('toucher un monstre en mode sync règle ses blessures', () => {
    render(<GameBoard />);
    fireEvent.click(screen.getByTestId('sync-toggle'));
    fireEvent.click(screen.getByTestId('token-P1'));
    const panel = screen.getByTestId('sync-monster');
    fireEvent.click(within(panel).getByRole('button', { name: 'Blessures de P1 : plus' }));
    expect(useGameStore.getState().game!.monsters.find((m) => m.id === 'P1')!.wounds).toBe(1);
    fireEvent.click(within(panel).getByRole('button', { name: 'Blessures de P1 : moins' }));
    expect(useGameStore.getState().game!.monsters.find((m) => m.id === 'P1')!.wounds).toBe(0);
  });

  it('un monstre part au cimetière depuis le plateau, sans déclencher de riposte', () => {
    render(<GameBoard />);
    fireEvent.click(screen.getByTestId('sync-toggle'));
    fireEvent.click(screen.getByTestId('token-P1'));
    fireEvent.click(screen.getByRole('button', { name: /Cimetière/ }));
    const g = useGameStore.getState().game!;
    expect(g.monsters.find((m) => m.id === 'P1')!.status).toBe('removed');
    expect(g.heroes.every((h) => h.wounds === 0)).toBe(true);
    expect(screen.queryByTestId('token-P1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sync-monster')).not.toBeInTheDocument();
  });

  it('une porte se retourne depuis le plateau en mode sync', () => {
    const g = useGameStore.getState().game!;
    const door = { id: 'D1', a: { x: 4, y: 0 }, b: { x: 5, y: 0 }, open: false };
    useGameStore.setState({ game: { ...g, board: { ...g.board, doors: [door] } } });
    render(<GameBoard />);
    fireEvent.click(screen.getByTestId('sync-toggle'));
    fireEvent.click(screen.getByTestId('door-hit-D1'));
    expect(useGameStore.getState().game!.board.doors[0]!.open).toBe(true);
  });
});

describe('plateau : réglages du pion touché en mode sync', () => {
  const withRoster = () => render(<GameBoard roster={<ul data-testid="roster-stub" />} />);

  it('sans pion touché, les cartes héros restent ; en touchant un héros, ses réglages les remplacent', () => {
    withRoster();
    fireEvent.click(screen.getByTestId('sync-toggle'));
    expect(screen.getByTestId('roster-stub')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('token-h2'));
    expect(screen.queryByTestId('roster-stub')).not.toBeInTheDocument();
    const hero = screen.getByTestId('sync-hero');
    fireEvent.click(within(hero).getByRole('button', { name: 'Blessures de Maya : plus' }));
    expect(useGameStore.getState().game!.heroes[1]!.wounds).toBe(1);
    fireEvent.click(within(hero).getByRole('button', { name: /Étourdi/ }));
    expect(useGameStore.getState().game!.heroes[1]!.stunned).toBe(true);
    fireEvent.click(within(hero).getByRole('button', { name: 'Fermer' }));
    expect(screen.getByTestId('roster-stub')).toBeInTheDocument();
  });

  it('en touchant un monstre, on règle ses blessures, sa garde et on l’envoie au cimetière', () => {
    withRoster();
    fireEvent.click(screen.getByTestId('sync-toggle'));
    fireEvent.click(screen.getByTestId('token-P1'));
    expect(screen.queryByTestId('roster-stub')).not.toBeInTheDocument();
    // Caractéristiques en icônes : vie, mouvement, dés d'attaque…
    const stats = screen.getByTestId('monster-stats');
    for (const label of ['Points de vie : 3/3', 'Mouvement : 1', 'Dés d’attaque : 3']) expect(within(stats).getByLabelText(label)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Garde/ }));
    expect(useGameStore.getState().game!.monsters.find((m) => m.id === 'P1')!.isGuard).toBe(true);
  });
});

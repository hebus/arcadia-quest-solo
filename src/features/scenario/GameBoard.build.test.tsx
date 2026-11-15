import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createScenarioGame } from '@/engine/scenario/definition';
import { startScenario } from '@/engine/turn/machine';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES } from '@/game-data/original';
import { TERRAIN_ESSAI } from '@/game-data/original/scenarios/terrain-essai';
import { useGameStore } from '@/stores/gameStore';
import { useTileStore } from '@/stores/tileStore';
import { GameBoard } from './GameBoard';

beforeEach(() => {
  useTileStore.setState({ tiles: [], loaded: true });
  const g = startScenario(createScenarioGame(TERRAIN_ESSAI, { sessionId: 's', difficulty: 'easy', seed: 1, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT));
  useGameStore.setState({ game: g, content: ORIGINAL_CONTENT, history: [], instructions: [], answers: [], beats: [], script: [], selectedId: null, placing: null, correctionMode: false, error: null, agent: { status: 'ready' } });
});

const board = () => useGameStore.getState().game!.board;

describe('terrain d’essai : construire le plateau depuis le jeu', () => {
  it('la bande « Construire » est visible et propose murs, portes, bâtiments, salles et cases bloquées', () => {
    render(<GameBoard />);
    const strip = screen.getByTestId('build-strip');
    for (const name of [/Mur/, /Porte/, /Bâtiment/, /Salle/, /Case bloquée/]) expect(screen.getByRole('button', { name })).toBeInTheDocument();
    expect(strip).toBeInTheDocument();
  });

  it('mur et porte se posent en touchant une arête du plateau', () => {
    render(<GameBoard />);
    fireEvent.click(screen.getByRole('button', { name: /Mur/ }));
    fireEvent.click(screen.getByTestId('edge-1,1-2,1'));
    expect(board().walls).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Porte/ }));
    fireEvent.click(screen.getByTestId('edge-1,3-1,4'));
    expect(board().doors).toHaveLength(1);
    expect(board().doors[0]).toMatchObject({ open: false });
  });

  it('bâtiment, salle et case bloquée se posent en touchant une case', () => {
    render(<GameBoard />);
    fireEvent.click(screen.getByRole('button', { name: /Bâtiment/ }));
    fireEvent.click(screen.getByTestId('cell-2-2'));
    expect(board().interior).toEqual([{ x: 2, y: 2 }]);
    fireEvent.click(screen.getByRole('button', { name: /Salle/ }));
    fireEvent.click(screen.getByTestId('cell-4-4'));
    expect(board().rooms).toEqual([{ x: 4, y: 4 }]);
    fireEvent.click(screen.getByRole('button', { name: /Case bloquée/ }));
    fireEvent.click(screen.getByTestId('cell-5-4'));
    expect(board().holes).toContainEqual({ x: 5, y: 4 });
  });
});

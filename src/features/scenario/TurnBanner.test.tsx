import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BANNER_MS, TurnBanner, turnSide } from './TurnBanner';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('bandeau de tour sur le plateau', () => {
  it('à qui est le tour : héros en tour de guilde, monstres pendant le Monster Turn, personne sinon', () => {
    expect(turnSide('GUILD_TURN')).toBe('heroes');
    for (const p of ['MONSTER_TURN_SPAWN', 'MONSTER_TURN_ACTIVATION_1', 'MONSTER_TURN_ACTIVATION_2'] as const) expect(turnSide(p)).toBe('monsters');
    // Le moteur calcule le tour des monstres d'un coup : tant que ses étapes ne sont pas jouées, c'est encore leur tour.
    expect(turnSide('GUILD_TURN', true)).toBe('monsters');
    for (const p of ['SCENARIO_SETUP', 'SCENARIO_WON', 'SCENARIO_LOST'] as const) expect(turnSide(p)).toBeNull();
  });

  it('affiche « Tour des héros », puis « Tour des monstres » au changement de camp, et s’efface seul', () => {
    const { rerender } = render(<TurnBanner side="heroes" />);
    expect(screen.getByTestId('turn-banner')).toHaveTextContent('Tour des héros');
    act(() => void vi.advanceTimersByTime(BANNER_MS + 10));
    expect(screen.queryByTestId('turn-banner')).not.toBeInTheDocument();

    rerender(<TurnBanner side="monsters" />);
    expect(screen.getByTestId('turn-banner')).toHaveTextContent('Tour des monstres');
    expect(screen.getByTestId('turn-banner')).toHaveAttribute('data-side', 'monsters');
    act(() => void vi.advanceTimersByTime(BANNER_MS + 10));
    expect(screen.queryByTestId('turn-banner')).not.toBeInTheDocument();
  });

  it('les étapes d’un même tour ne le réaffichent pas ; il ne capte aucun toucher', () => {
    const { rerender } = render(<TurnBanner side="monsters" />);
    act(() => void vi.advanceTimersByTime(BANNER_MS + 10));
    rerender(<TurnBanner side="monsters" />);
    rerender(<TurnBanner side="monsters" />);
    expect(screen.queryByTestId('turn-banner')).not.toBeInTheDocument();
    rerender(<TurnBanner side="heroes" />);
    expect(screen.getByTestId('turn-banner').className).toContain('pointer-events-none');
  });

  it('rien en mise en place ni en fin de partie', () => {
    render(<TurnBanner side={null} />);
    expect(screen.queryByTestId('turn-banner')).not.toBeInTheDocument();
  });
});

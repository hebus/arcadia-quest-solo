import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { CorrectionsPanel } from '@/features/scenario/CorrectionsPanel';
import { useGameStore } from '@/stores/gameStore';
import { skillContent, skillGame } from '@/tests/fixtures/skillGame';
import { HeroRoster } from './ActionDock';

beforeEach(() => {
  useGameStore.setState({ game: skillGame([{ id: 'P1', definitionId: 'plain', position: { x: 6, y: 2 } }]), content: skillContent, history: [], instructions: [], selectedId: null, error: null, agent: { status: 'ready' } });
});

describe('héros étourdi', () => {
  it('sans héros étourdi, aucun badge', () => {
    render(<HeroRoster />);
    expect(screen.queryByText(/étourdi/)).not.toBeInTheDocument();
  });

  it('le badge suit l’état du héros', () => {
    const g = useGameStore.getState().game!;
    useGameStore.setState({ game: { ...g, heroes: g.heroes.map((h) => (h.id === 'h2' ? { ...h, stunned: true } : h)) } });
    render(<HeroRoster />);
    const cards = screen.getAllByRole('button');
    expect(within(cards[1]!).getByText(/étourdi/)).toBeInTheDocument(); // Maya
    expect(within(cards[0]!).queryByText(/étourdi/)).not.toBeInTheDocument();
    expect(within(cards[2]!).queryByText(/étourdi/)).not.toBeInTheDocument();
  });

  it('un héros mort n’affiche pas de badge', () => {
    const g = useGameStore.getState().game!;
    useGameStore.setState({ game: { ...g, heroes: g.heroes.map((h) => (h.id === 'h2' ? { ...h, stunned: true, dead: true } : h)) } });
    render(<HeroRoster />);
    expect(screen.queryByText(/étourdi/)).not.toBeInTheDocument();
  });

  it('le panneau de corrections permet de retirer (ou poser) l’étourdissement', async () => {
    const user = userEvent.setup();
    const g = useGameStore.getState().game!;
    useGameStore.setState({ game: { ...g, heroes: g.heroes.map((h) => (h.id === 'h1' ? { ...h, stunned: true } : h)) } });
    render(<CorrectionsPanel />);
    await user.selectOptions(screen.getByLabelText('Quoi'), 'hero-stunned');
    // Case « étourdi » décochée : la correction retire l'étourdissement de Grom.
    await user.click(screen.getByRole('button', { name: 'Appliquer la correction' }));
    expect(useGameStore.getState().game!.heroes[0]!.stunned).toBeUndefined();
    // Case cochée : elle le pose sur Maya.
    await user.selectOptions(screen.getByLabelText('Cible'), 'h2');
    await user.click(screen.getByRole('checkbox', { name: /étourdi/ }));
    await user.click(screen.getByRole('button', { name: 'Appliquer la correction' }));
    expect(useGameStore.getState().game!.heroes[1]!.stunned).toBe(true);
  });
});

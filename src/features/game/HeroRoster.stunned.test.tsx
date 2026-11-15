import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
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
    const cards = screen.getAllByRole('button', { name: /Repérer/ });
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

  it('la fiche du héros permet de retirer (ou poser) l’étourdissement', async () => {
    const user = userEvent.setup();
    const g = useGameStore.getState().game!;
    useGameStore.setState({ game: { ...g, heroes: g.heroes.map((h) => (h.id === 'h1' ? { ...h, stunned: true } : h)) } });
    render(<HeroRoster />);
    await user.click(screen.getByRole('button', { name: /Retirer l’étourdissement de Grom/ }));
    expect(useGameStore.getState().game!.heroes[0]!.stunned).toBeUndefined();
    await user.click(screen.getByRole('button', { name: /Étourdir Maya/ }));
    expect(useGameStore.getState().game!.heroes[1]!.stunned).toBe(true);
  });

  it('la fiche du héros permet de le soigner ou de le blesser, jusqu’à sa mise hors combat', async () => {
    const user = userEvent.setup();
    const g = useGameStore.getState().game!;
    const life = g.heroes[0]!.life;
    useGameStore.setState({ game: { ...g, heroes: g.heroes.map((h) => (h.id === 'h1' ? { ...h, wounds: 2 } : h)) } });
    render(<HeroRoster />);
    await user.click(screen.getByRole('button', { name: 'Soigner Grom' }));
    expect(useGameStore.getState().game!.heroes[0]!.wounds).toBe(1);
    await user.click(screen.getByRole('button', { name: 'Blesser Grom' }));
    expect(useGameStore.getState().game!.heroes[0]!.wounds).toBe(2);
    for (let i = 2; i < life; i++) await user.click(screen.getByRole('button', { name: 'Blesser Grom' }));
    const grom = useGameStore.getState().game!.heroes[0]!;
    expect(grom.dead).toBe(true);
    expect(screen.getByRole('button', { name: 'Ressusciter Grom' })).toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InputAnswer, InputRequest } from '@/engine/oracle';
import { useGameStore } from '@/stores/gameStore';
import { InputPrompt } from './MonsterTurnScreen';

const provide = vi.fn<(a: InputAnswer) => void>();
beforeEach(() => {
  provide.mockClear();
  useGameStore.setState({ provideAnswer: provide });
});

const attack = (over: Partial<Extract<InputRequest, { kind: 'attack-result' }>> = {}): InputRequest => ({ kind: 'attack-result', purpose: 'Minotaur attaque Grom', attackDice: 4, defenseDice: 1, ...over });
const defense = (over: Partial<Extract<InputRequest, { kind: 'defense-result' }>> = {}): InputRequest => ({ kind: 'defense-result', purpose: 'Minotaur attaque Grom', hits: 3, defenseDice: 2, targetName: 'Grom', ...over });

describe('saisie des dés d’un monstre à compétence', () => {
  it('Minotaur, dés matériels : un compteur de critiques, envoyé avec le résultat', async () => {
    const user = userEvent.setup();
    render(<InputPrompt request={attack({ critWounds: true })} />);
    expect(screen.getByText(/Chaque critique de ce monstre donne une blessure supplémentaire/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Coups, dé 1' }));
    await user.click(screen.getByRole('button', { name: 'Coups, dé 2' }));
    await user.click(screen.getByRole('button', { name: 'Coups, dé 3' }));
    await user.click(screen.getByRole('button', { name: 'Critiques, dé 1' }));
    await user.click(screen.getByRole('button', { name: 'Sauvegardes, dé 1' }));
    await user.click(screen.getByRole('button', { name: 'Valider' }));
    expect(provide).toHaveBeenCalledWith({ kind: 'attack-result', hits: 3, saves: 1, crits: 1 });
  });

  it('les critiques ne dépassent pas les coups', () => {
    render(<InputPrompt request={attack({ critWounds: true })} />);
    // Aucun coup saisi : pas de case de critique à toucher.
    expect(screen.queryByRole('button', { name: 'Critiques, dé 1' })).not.toBeInTheDocument();
  });

  it('monstre ordinaire, dés matériels : pas de compteur de critiques, réponse sans `crits`', async () => {
    const user = userEvent.setup();
    render(<InputPrompt request={attack()} />);
    expect(screen.queryByRole('group', { name: 'Critiques' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Coups, dé 1' }));
    await user.click(screen.getByRole('button', { name: 'Valider' }));
    expect(provide).toHaveBeenCalledWith({ kind: 'attack-result', hits: 1, saves: 0 });
  });

  it('défense lancée par le joueur : les blessures supplémentaires de critique sont annoncées et ajoutées au total', async () => {
    const user = userEvent.setup();
    render(<InputPrompt request={defense({ extraWounds: 2 })} />);
    expect(screen.getByTestId('extra-wounds')).toHaveTextContent('2 blessures supplémentaires');
    expect(screen.getByText(/5 blessures/)).toBeInTheDocument(); // 3 touches + 2 de critique, sans bouclier
    await user.click(screen.getByRole('button', { name: 'Boucliers, dé 1' }));
    await user.click(screen.getByRole('button', { name: 'Boucliers, dé 2' }));
    expect(screen.getByText(/3 blessures/)).toBeInTheDocument(); // 3 − 2 + 2 : les blessures de critique ne se parent pas
    await user.click(screen.getByRole('button', { name: 'Valider' }));
    expect(provide).toHaveBeenCalledWith({ kind: 'defense-result', saves: 2 });
  });

  it('défense sans critique de compétence : aucun message de blessure supplémentaire', () => {
    render(<InputPrompt request={defense()} />);
    expect(screen.queryByTestId('extra-wounds')).not.toBeInTheDocument();
    expect(screen.getByText(/3 blessures/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Boucliers, dé 1' }));
    expect(screen.getByText(/2 blessures/)).toBeInTheDocument();
  });
});

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_ATTACK_DIE, DEFAULT_DEFENSE_DIE, describeDie, dieFace, nextFaceKind } from '@/game-data/dice';
import { defaultContent, useGameStore } from '@/stores/gameStore';
import { SettingsScreen } from './SettingsScreen';

beforeEach(() => useGameStore.setState({ game: null, content: defaultContent() }));
const panel = () => screen.getByRole('region', { name: 'Faces des dés' });

describe('paramètres : les dés sont dessinés', () => {
  it('un dé noir et un dé blanc, de six faces chacun, avec leur contenu', () => {
    render(<SettingsScreen />);
    const black = within(panel()).getByTestId('die-black');
    const white = within(panel()).getByTestId('die-white');
    expect(within(black).getAllByRole('button')).toHaveLength(6);
    expect(within(white).getAllByRole('button')).toHaveLength(6);
    expect(within(black).getByTestId('black-summary')).toHaveTextContent('3 épées · 2 arcs · 1 critique');
    expect(within(white).getByTestId('white-summary')).toHaveTextContent('1 bouclier · 1 critique · 4 faces vides');
    expect(black).toHaveTextContent('Mêlée : une épée ou un critique touche');
    expect(white).toHaveTextContent('Un bouclier ou un critique annule une touche');
  });

  it('plus aucune case à cocher ni champ de symbole dans le panneau des dés', () => {
    render(<SettingsScreen />);
    expect(within(panel()).queryAllByRole('checkbox')).toHaveLength(0);
    expect(within(panel()).queryAllByRole('textbox')).toHaveLength(0);
  });

  it('dé blanc : une seule face bouclier, une seule face critique, quatre faces vides', () => {
    render(<SettingsScreen />);
    const kinds = [1, 2, 3, 4, 5, 6].map((i) => screen.getByTestId(`white-face-${i}`).getAttribute('data-face'));
    expect(kinds.filter((k) => k === 'shield')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'crit')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'blank')).toHaveLength(4);
  });

  it('chaque face montre son symbole et son nom', () => {
    render(<SettingsScreen />);
    const first = screen.getByTestId('black-face-1');
    expect(first).toHaveAttribute('data-face', 'sword');
    expect(first).toHaveTextContent('⚔');
    expect(first).toHaveTextContent('épée');
    expect(screen.getByTestId('black-face-6')).toHaveTextContent('critique');
    expect(screen.getByTestId('white-face-1')).toHaveTextContent('bouclier');
    expect(screen.getByTestId('white-face-4')).toHaveTextContent('face vide');
  });

  it('toucher une face du dé noir la change : épée, arc, critique, puis de nouveau épée', () => {
    render(<SettingsScreen />);
    const face = screen.getByRole('button', { name: /Dé de combat \(noir\), face 1 : épée/ });
    fireEvent.click(face);
    expect(useGameStore.getState().content.attackDie[0]).toMatchObject({ symbol: 'bow', melee: false, ranged: true, crit: false });
    fireEvent.click(screen.getByRole('button', { name: /Dé de combat \(noir\), face 1 : arc/ }));
    expect(useGameStore.getState().content.attackDie[0]).toMatchObject({ symbol: 'crit', melee: true, ranged: true, crit: true });
    fireEvent.click(screen.getByRole('button', { name: /Dé de combat \(noir\), face 1 : critique/ }));
    expect(useGameStore.getState().content.attackDie[0]).toMatchObject({ symbol: 'sword', melee: true, ranged: false, crit: false });
    // Les autres faces ne bougent pas.
    expect(useGameStore.getState().content.attackDie.slice(1)).toEqual(DEFAULT_ATTACK_DIE.slice(1));
  });

  it('toucher une face du dé blanc : bouclier, critique, face vide, puis de nouveau bouclier', () => {
    render(<SettingsScreen />);
    fireEvent.click(screen.getByTestId('white-face-1'));
    expect(useGameStore.getState().content.defenseDie[0]).toMatchObject({ symbol: 'crit', crit: true, save: true });
    fireEvent.click(screen.getByTestId('white-face-1'));
    expect(useGameStore.getState().content.defenseDie[0]).toMatchObject({ symbol: 'blank', crit: false, save: false });
    fireEvent.click(screen.getByTestId('white-face-1'));
    expect(useGameStore.getState().content.defenseDie[0]).toMatchObject({ symbol: 'shield', save: true });
    expect(screen.getByTestId('white-summary')).toHaveTextContent('1 bouclier · 1 critique · 4 faces vides');
  });

  it('le résumé suit les changements, et « Valeurs par défaut » remet les dés du jeu', () => {
    render(<SettingsScreen />);
    fireEvent.click(screen.getByTestId('black-face-1')); // épée → arc
    expect(screen.getByTestId('black-summary')).toHaveTextContent('2 épées · 3 arcs · 1 critique');
    fireEvent.click(screen.getByRole('button', { name: 'Valeurs par défaut' }));
    expect(useGameStore.getState().content.attackDie).toEqual(DEFAULT_ATTACK_DIE);
    expect(useGameStore.getState().content.defenseDie).toEqual(DEFAULT_DEFENSE_DIE);
    expect(screen.getByTestId('black-summary')).toHaveTextContent('3 épées · 2 arcs · 1 critique');
  });
});

describe('faces de dé : règles de réussite', () => {
  it('une face ne se règle plus par cases à cocher : son type fixe ses effets', () => {
    expect(dieFace('sword', false)).toMatchObject({ melee: true, ranged: false, crit: false, save: false });
    expect(dieFace('bow', false)).toMatchObject({ melee: false, ranged: true });
    expect(dieFace('crit', false)).toMatchObject({ melee: true, ranged: true, crit: true });
    expect(dieFace('shield', true)).toMatchObject({ save: true, crit: false });
    expect(dieFace('crit', true)).toMatchObject({ save: true, crit: true });
    expect(dieFace('blank', true)).toMatchObject({ save: false, crit: false });
  });

  it('une face au symbole inconnu (ancienne donnée) devient la première face possible', () => {
    expect(nextFaceKind('A', false)).toBe('sword');
    expect(nextFaceKind('A', true)).toBe('shield');
    expect(describeDie([dieFace('sword', false), { symbol: 'A', melee: true, ranged: false, crit: false, save: false }], false)).toBe('1 épée · 1 autre');
  });
});

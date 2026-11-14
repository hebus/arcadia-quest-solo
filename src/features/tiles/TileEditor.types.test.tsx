import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { parse } from '@/engine/domain/validate';
import { TileDefSchema, effectiveWalls } from '@/engine/tiles';
import { useTileStore } from '@/stores/tileStore';
import { TileEditor } from './TileEditor';

beforeEach(() => useTileStore.setState({ tiles: [parse(TileDefSchema, { id: '4A', name: '4A' })], loaded: true }));
const tile = () => useTileStore.getState().tiles[0]!;

describe('éditeur de tuile : types de cases salle et bloquée', () => {
  it('une salle fonctionne comme un bâtiment : contour muré, portes possibles', async () => {
    const user = userEvent.setup();
    render(<TileEditor />);
    await user.click(screen.getByRole('button', { name: 'Face 4A' }));
    await user.click(screen.getByRole('button', { name: 'Salles' }));
    fireEvent.click(screen.getByTestId('cell-0-0'));
    fireEvent.click(screen.getByTestId('cell-1-0'));
    expect(tile().rooms).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
    expect(effectiveWalls(tile())).toHaveLength(6); // salle de 2 cases : 6 arêtes de contour
    expect(screen.getByText(/salle 1 \(2 cases\)/)).toBeInTheDocument();
    // Porte sur le contour de la salle.
    await user.click(screen.getByRole('button', { name: 'Portes' }));
    fireEvent.click(screen.getByTestId('edge-1,0-2,0'));
    expect(tile().doors).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Salles' }));
    fireEvent.click(screen.getByTestId('cell-1-0')); // retoucher : retour en rue, la porte qui n'a plus de mur disparaît
    expect(tile().rooms).toEqual([{ x: 0, y: 0 }]);
    expect(tile().doors).toHaveLength(0);
  });

  it('une case n’a qu’un type ; une case bloquée reste touchable et ne peut pas être un départ', async () => {
    const user = userEvent.setup();
    render(<TileEditor />);
    await user.click(screen.getByRole('button', { name: 'Face 4A' }));
    await user.click(screen.getByRole('button', { name: 'Salles' }));
    fireEvent.click(screen.getByTestId('cell-1-0'));
    await user.click(screen.getByRole('button', { name: 'Cases bloquées' }));
    fireEvent.click(screen.getByTestId('cell-1-0')); // remplace le type « salle »
    expect(tile().blocked).toEqual([{ x: 1, y: 0 }]);
    expect(tile().rooms).toEqual([]);
    expect(screen.getByTestId('blocked-1-0')).toBeInTheDocument();
    // Départ des héros : refusé sur une case bloquée, accepté ailleurs.
    await user.click(screen.getByRole('button', { name: 'Départ des héros' }));
    fireEvent.click(screen.getByTestId('cell-1-0'));
    expect(tile().heroStart).toEqual([]);
    expect(screen.getByRole('alert')).toHaveTextContent(/case bloquée/);
    fireEvent.click(screen.getByTestId('cell-2-2'));
    expect(tile().heroStart).toEqual([{ x: 2, y: 2 }]);
    // Bloquer une case de départ la retire de la zone ; retoucher une case bloquée la débloque.
    await user.click(screen.getByRole('button', { name: 'Cases bloquées' }));
    fireEvent.click(screen.getByTestId('cell-2-2'));
    expect(tile().heroStart).toEqual([]);
    expect(tile().blocked).toHaveLength(2);
    fireEvent.click(screen.getByTestId('cell-2-2'));
    fireEvent.click(screen.getByTestId('cell-1-0'));
    expect(tile().blocked).toEqual([]);
  });

  it('un bâtiment, une salle et une case bloquée s’excluent ; le résumé de la face les compte', async () => {
    const user = userEvent.setup();
    render(<TileEditor />);
    await user.click(screen.getByRole('button', { name: 'Face 4A' }));
    await user.click(screen.getByRole('button', { name: 'Bâtiments' }));
    fireEvent.click(screen.getByTestId('cell-0-0'));
    await user.click(screen.getByRole('button', { name: 'Salles' }));
    fireEvent.click(screen.getByTestId('cell-0-0')); // le bâtiment devient une salle
    expect(tile().interior).toEqual([]);
    expect(tile().rooms).toEqual([{ x: 0, y: 0 }]);
    await user.click(screen.getByRole('button', { name: 'Cases bloquées' }));
    fireEvent.click(screen.getByTestId('cell-2-0'));
    expect(screen.getByRole('button', { name: 'Face 4A' })).toHaveTextContent('0 bât. · 0 dép. · 1 salle · 1 bloquée');
  });
});

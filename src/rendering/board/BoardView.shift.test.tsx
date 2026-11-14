import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BoardView } from './BoardView';

describe('numéro d’une tuile décalée', () => {
  const board = { width: 7, height: 3, holes: [{ x: 3, y: 0 }, { x: 3, y: 1 }, { x: 3, y: 2 }], walls: [], doors: [], portals: [] };

  it('le numéro suit le décalage : il reste au centre de la tuile, pas de son emplacement', () => {
    render(<BoardView board={board} tileLabels={[{ tx: 0, ty: 0, label: '1A' }, { tx: 1, ty: 0, dx: 1, label: '2A' }]} />);
    const x = (id: string) => Number(screen.getByTestId(id).getAttribute('x'));
    expect(x('tile-number-0-0')).toBe(84); // centre de la case du milieu de la 1re tuile (colonne 1)
    // 2e tuile : emplacement colonne 3, décalée d'une case : ses cases vont de la colonne 4 à 6, centre en 5,5 cases → 5×56 + 28 = 308.
    expect(x('tile-number-1-0')).toBe((3 + 1 + 1.5) * 56);
  });

  it('un décalage vers le haut ou le bas déplace aussi le numéro verticalement', () => {
    render(<BoardView board={{ ...board, height: 5 }} tileLabels={[{ tx: 0, ty: 0, dy: 2, label: '1A' }]} />);
    const y = Number(screen.getByTestId('tile-number-0-0').getAttribute('y'));
    const fontSize = Number(screen.getByTestId('tile-number-0-0').getAttribute('font-size'));
    expect(y - 0.36 * fontSize).toBeCloseTo((2 + 1.5) * 56, 5);
  });
});

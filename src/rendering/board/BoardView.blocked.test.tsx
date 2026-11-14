import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BoardView } from './BoardView';

describe('cases bloquées sur le plateau', () => {
  it('une case bloquée est dessinée mais n’est pas touchable', () => {
    const board = { width: 3, height: 1, holes: [{ x: 1, y: 0 }], blocked: [{ x: 1, y: 0 }], walls: [], doors: [], portals: [] };
    render(<BoardView board={board} onCell={() => undefined} />);
    expect(screen.getByTestId('blocked-1-0')).toBeInTheDocument();
    expect(screen.queryByTestId('cell-1-0')).not.toBeInTheDocument();
    expect(screen.getByTestId('cell-0-0')).toBeInTheDocument();
  });

  it('une case absente (hors tuile) n’est pas dessinée', () => {
    const board = { width: 3, height: 1, holes: [{ x: 1, y: 0 }], walls: [], doors: [], portals: [] };
    render(<BoardView board={board} />);
    expect(screen.queryByTestId('blocked-1-0')).not.toBeInTheDocument();
  });
});

describe('numéro des tuiles sur le plateau', () => {
  const board = { width: 6, height: 3, holes: [], walls: [], doors: [], portals: [] };

  it('affiche le numéro de chaque tuile au centre de la tuile, sans orientation', () => {
    render(<BoardView board={board} tileLabels={[{ tx: 0, ty: 0, label: '3B' }, { tx: 1, ty: 0, label: '7A' }]} />);
    const a = screen.getByTestId('tile-label-0-0');
    const b = screen.getByTestId('tile-label-1-0');
    expect(a).toHaveTextContent('3B');
    expect(b).toHaveTextContent('7A');
    expect(a).not.toHaveTextContent(/°|↻|↺/);
    // Le chiffre est centré sur la case du milieu de la tuile : 3 cases de 56 de côté, soit 84 depuis son coin (centre de la 2e case) ;
    // la 2e tuile est décalée de 168. La ligne de base est abaissée de la demi-hauteur des chiffres pour que le chiffre soit centré.
    const num = (id: string) => screen.getByTestId(id);
    expect(num('tile-number-0-0')).toHaveTextContent('3');
    expect(num('tile-face-0-0')).toHaveTextContent('B');
    expect(Number(num('tile-number-0-0').getAttribute('x'))).toBe(84);
    expect(num('tile-number-0-0')).toHaveAttribute('text-anchor', 'middle');
    const baseline = Number(num('tile-number-0-0').getAttribute('y'));
    const fontSize = Number(num('tile-number-0-0').getAttribute('font-size'));
    expect(baseline - 0.36 * fontSize).toBeCloseTo(84, 5); // le centre du chiffre est le centre de la case
    expect(Number(num('tile-number-1-0').getAttribute('x'))).toBe(168 + 84);
    // La face ne décale pas le chiffre : elle est posée à sa droite, sur la même ligne de base.
    expect(Number(num('tile-face-0-0').getAttribute('x'))).toBeGreaterThan(84);
    expect(num('tile-face-0-0').getAttribute('y')).toBe(String(baseline));
  });

  it('le numéro ne capte aucun toucher : les cases dessous restent jouables', () => {
    render(<BoardView board={board} onCell={() => undefined} tileLabels={[{ tx: 0, ty: 0, label: '3B' }]} />);
    expect(screen.getByTestId('tile-label-0-0')).toHaveAttribute('pointer-events', 'none');
    expect(screen.getByTestId('cell-1-1')).toBeInTheDocument();
  });

  it('sans numéros fournis, rien n’est affiché', () => {
    render(<BoardView board={board} />);
    expect(screen.queryByTestId('tile-label-0-0')).not.toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { DiceTally, Stepper } from './Tally';

function Dice({ n }: { n: number }) {
  const [v, setV] = useState(0);
  return (
    <>
      <DiceTally label="Coups" dice={n} value={v} onChange={setV} glyph="⚔" />
      <output data-testid="val">{v}</output>
    </>
  );
}

describe('saisie tactile des dés', () => {
  it('un bouton par dé ; toucher le dé n°i compte i réussites', () => {
    render(<Dice n={4} />);
    expect(screen.getAllByRole('button')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Coups, dé 3' }));
    expect(screen.getByTestId('val')).toHaveTextContent('3');
    expect(screen.getByRole('button', { name: 'Coups, dé 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Coups, dé 4' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('retoucher le dernier dé actif le retire', () => {
    render(<Dice n={3} />);
    fireEvent.click(screen.getByRole('button', { name: 'Coups, dé 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Coups, dé 2' }));
    expect(screen.getByTestId('val')).toHaveTextContent('1');
  });

  it('aucun dé : pas de bouton', () => {
    render(<Dice n={0} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('Stepper respecte min et max', () => {
    let v = 1;
    const { rerender } = render(<Stepper label="N" value={v} onChange={(n) => (v = n)} min={1} max={2} />);
    expect(screen.getByRole('button', { name: 'N : moins' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'N : plus' }));
    expect(v).toBe(2);
    rerender(<Stepper label="N" value={2} onChange={() => undefined} min={1} max={2} />);
    expect(screen.getByRole('button', { name: 'N : plus' })).toBeDisabled();
  });
});

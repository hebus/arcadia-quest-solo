import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { parse } from '@/engine/domain/validate';
import { TileDefSchema, type BoardExtras, type TileDef } from '@/engine/tiles';
import { BoardSetup } from './BoardSetup';

const tile: TileDef = parse(TileDefSchema, { id: '1A', name: '1A', interior: [{ x: 1, y: 1 }], doors: [[{ x: 1, y: 1 }, { x: 0, y: 1 }]] });

function setup(extras: Partial<Required<BoardExtras>> = {}) {
  const setExtras = vi.fn();
  render(
    <BoardSetup
      tilesLib={[tile]}
      layout={{ tilesW: 1, tilesH: 1, placements: [{ tileId: '1A', tx: 0, ty: 0, rotation: 0 }] }}
      setLayout={() => undefined}
      extras={{ walls: [], doors: [], portals: [], doorStates: {}, specialDoorId: null, ...extras }}
      setExtras={setExtras}
      spawns={[]}
      setSpawns={() => undefined}
      heroes={[]}
      setHeroes={() => undefined}
      defs={[]}
      insts={[]}
      setInsts={() => undefined}
      onOpenLibrary={() => undefined}
    />,
  );
  return setExtras;
}

describe('pions porte à la mise en place', () => {
  it('le compteur indique les pions porte posés sur 22', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Porte' }));
    expect(screen.getByRole('status')).toHaveTextContent('Pions porte posés : 1 / 22');
    expect(screen.getByRole('status')).toHaveTextContent('porte spéciale violette : non posée');
  });

  it('l’outil « Porte spéciale » marque une porte, puis retire la marque', () => {
    const setExtras = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Porte spéciale' }));
    fireEvent.click(screen.getByTestId('edge-0,1-1,1'));
    expect(setExtras).toHaveBeenCalledWith(expect.objectContaining({ specialDoorId: expect.stringMatching(/^d:/) }));
  });

  it('la porte spéciale est violette, et un second toucher retire la marque', () => {
    const id = 'd:0,1|1,1';
    const setExtras = setup({ specialDoorId: id });
    expect(screen.getByTestId(`door-${id}`)).toHaveAttribute('data-special', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Porte spéciale' }));
    expect(screen.getByRole('status')).toHaveTextContent('porte spéciale violette : posée');
    fireEvent.click(screen.getByTestId('edge-0,1-1,1'));
    expect(setExtras).toHaveBeenCalledWith(expect.objectContaining({ specialDoorId: null }));
  });

  it('retirer la porte spéciale (pion rendu) lui retire aussi la marque', () => {
    const id = 'd:0,1|1,1';
    const setExtras = setup({ specialDoorId: id, doorStates: { [id]: 'open' } });
    fireEvent.click(screen.getByRole('button', { name: 'Porte' }));
    fireEvent.click(screen.getByTestId('edge-0,1-1,1')); // ouverte → retirée
    expect(setExtras).toHaveBeenCalledWith(expect.objectContaining({ specialDoorId: null, doorStates: { [id]: 'none' } }));
  });
});

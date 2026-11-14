import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { parse } from '@/engine/domain/validate';
import { TileDefSchema, type TileDef } from '@/engine/tiles';
import { BoardSetup } from './BoardSetup';

const tile = (id: string): TileDef => parse(TileDefSchema, { id, name: id });

function setup(placed: string[]) {
  const setLayout = vi.fn();
  render(
    <BoardSetup
      tilesLib={['1A', '1B', '2A', '2B'].map(tile)}
      layout={{ tilesW: 2, tilesH: 1, placements: placed.map((tileId, i) => ({ tileId, tx: i, ty: 0, rotation: 0 as const })) }}
      setLayout={setLayout}
      extras={{ walls: [], doors: [], portals: [], doorStates: {} }}
      setExtras={() => undefined}
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
  return setLayout;
}

describe('choix des tuiles : 9 tuiles doubles faces', () => {
  it('une tuile déjà posée n’est plus proposée, ni sur l’une ni sur l’autre de ses faces', () => {
    setup(['1A']);
    fireEvent.click(screen.getByRole('button', { name: 'Emplacement 2,1' }));
    const select = screen.getByRole('combobox', { name: 'Tuile' });
    const option = (name: RegExp) => within(select).getByRole('option', { name }) as HTMLOptionElement;
    expect(option(/^1A/).disabled).toBe(true);
    expect(option(/^1B/).disabled).toBe(true); // l'autre face de la tuile 1
    expect(option(/^2A/).disabled).toBe(false);
    expect(option(/^2B/).disabled).toBe(false);
  });

  it('sur l’emplacement de 1A, on peut retourner la tuile : 1B est proposée', () => {
    const setLayout = setup(['1A']);
    fireEvent.click(screen.getByRole('button', { name: 'Emplacement 1,1' }));
    const select = screen.getByRole('combobox', { name: 'Tuile' });
    expect((within(select).getByRole('option', { name: /^1B/ }) as HTMLOptionElement).disabled).toBe(false);
    fireEvent.change(select, { target: { value: '1B' } });
    expect(setLayout).toHaveBeenCalledWith(expect.objectContaining({ placements: [expect.objectContaining({ tileId: '1B' })] }));
  });
});

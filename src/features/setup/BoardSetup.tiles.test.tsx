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
      tilesLib={['A1', 'A2', 'B1', 'B2'].map(tile)}
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
    setup(['A1']);
    fireEvent.click(screen.getByRole('button', { name: 'Emplacement 2,1' }));
    const select = screen.getByRole('combobox', { name: 'Tuile' });
    const option = (name: RegExp) => within(select).getByRole('option', { name }) as HTMLOptionElement;
    expect(option(/^A1/).disabled).toBe(true);
    expect(option(/^A2/).disabled).toBe(true); // l'autre face de A
    expect(option(/^B1/).disabled).toBe(false);
    expect(option(/^B2/).disabled).toBe(false);
  });

  it('sur l’emplacement de A1, on peut retourner la tuile : A2 est proposée', () => {
    const setLayout = setup(['A1']);
    fireEvent.click(screen.getByRole('button', { name: 'Emplacement 1,1' }));
    const select = screen.getByRole('combobox', { name: 'Tuile' });
    expect((within(select).getByRole('option', { name: /^A2/ }) as HTMLOptionElement).disabled).toBe(false);
    fireEvent.change(select, { target: { value: 'A2' } });
    expect(setLayout).toHaveBeenCalledWith(expect.objectContaining({ placements: [expect.objectContaining({ tileId: 'A2' })] }));
  });
});

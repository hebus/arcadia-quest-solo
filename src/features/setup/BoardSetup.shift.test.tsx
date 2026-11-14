import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { parse } from '@/engine/domain/validate';
import { TileDefSchema, type TileLayout } from '@/engine/tiles';
import { BoardSetup } from './BoardSetup';

function setup(layout: TileLayout) {
  const setLayout = vi.fn();
  render(
    <BoardSetup
      tilesLib={['1A', '2A'].map((id) => parse(TileDefSchema, { id, name: id }))}
      layout={layout}
      setLayout={setLayout}
      extras={{ walls: [], doors: [], portals: [], doorStates: {}, specialDoorId: null }}
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
const layout = (dx?: number, dy?: number): TileLayout => ({
  tilesW: 2,
  tilesH: 1,
  placements: [
    { tileId: '1A', tx: 0, ty: 0, rotation: 0 },
    { tileId: '2A', tx: 1, ty: 0, rotation: 0, ...(dx ? { dx } : {}), ...(dy ? { dy } : {}) },
  ],
});
const lastPlacements = (fn: ReturnType<typeof vi.fn>) => (fn.mock.calls.at(-1)![0] as TileLayout).placements;

describe('décalage d’une tuile à la mise en place', () => {
  it('une tuile se décale d’une case vers la droite, la gauche, le bas ou le haut', () => {
    const setLayout = setup(layout());
    fireEvent.click(screen.getByRole('button', { name: 'Emplacement 2,1' }));
    for (const [name, expected] of [
      ['Décaler vers la droite', { dx: 1 }],
      ['Décaler vers la gauche', { dx: -1 }],
      ['Décaler vers le bas', { dy: 1 }],
      ['Décaler vers le haut', { dy: -1 }],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name }));
      expect(lastPlacements(setLayout).find((p) => p.tileId === '2A')).toMatchObject(expected);
    }
    // L'autre tuile ne bouge pas.
    expect(lastPlacements(setLayout).find((p) => p.tileId === '1A')).toEqual({ tileId: '1A', tx: 0, ty: 0, rotation: 0 });
  });

  it('le décalage courant est indiqué et « Recaler » le supprime', () => {
    const setLayout = setup(layout(2, -1));
    fireEvent.click(screen.getByRole('button', { name: 'Emplacement 2,1' }));
    expect(screen.getByTestId('shift-info')).toHaveTextContent('2 cases à droite, 1 case en haut');
    fireEvent.click(screen.getByRole('button', { name: 'Recaler' }));
    const placed = lastPlacements(setLayout).find((p) => p.tileId === '2A')!;
    expect(placed.dx).toBeUndefined();
    expect(placed.dy).toBeUndefined();
  });

  it('sans décalage, aucune indication ; tourner la tuile garde son décalage', () => {
    setup(layout());
    fireEvent.click(screen.getByRole('button', { name: 'Emplacement 2,1' }));
    expect(screen.queryByTestId('shift-info')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Recaler' })).not.toBeInTheDocument();
  });

  it('tourner une tuile décalée conserve le décalage', () => {
    const setLayout = setup(layout(1, 0));
    fireEvent.click(screen.getByRole('button', { name: 'Emplacement 2,1' }));
    fireEvent.click(screen.getByRole('button', { name: '↻ Tourner' }));
    expect(lastPlacements(setLayout).find((p) => p.tileId === '2A')).toMatchObject({ rotation: 90, dx: 1 });
  });
});

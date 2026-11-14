import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Board } from '@/engine/domain/schemas';
import { overlayFor } from '@/rendering/instructions/overlay';
import type { GameState } from '@/engine/domain/schemas';
import { BoardView } from './BoardView';

const board: Board = { width: 4, height: 4, holes: [], walls: [], doors: [], portals: [], interior: [{ x: 3, y: 3 }] };
const C = 56;
const tokens = [{ id: 'm1', kind: 'monster' as const, label: 'GO', at: { x: 3, y: 0 } }];

/** jsdom n'implémente pas la géométrie SVG : on fournit une conversion écran → plateau pilotée par le test. */
function mockSvgGeometry(container: HTMLElement) {
  const svg = container.querySelector('svg')! as unknown as Record<string, unknown>;
  const pos = { x: 0, y: 0 };
  svg.getScreenCTM = () => ({ inverse: () => ({}) });
  svg.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform: () => ({ ...pos }) });
  return (cell: { x: number; y: number }) => {
    pos.x = cell.x * C + C / 2;
    pos.y = cell.y * C + C / 2;
  };
}

describe('BoardView', () => {
  it('dessine l’art généré pour la rue et l’intérieur sans scan de tuile', () => {
    const { container } = render(<BoardView board={board} />);
    expect(container.querySelectorAll('g[transform^="translate"]').length).toBeGreaterThanOrEqual(16);
    expect(screen.getByTestId('interior-3-3')).toBeInTheDocument();
  });

  it('glisser un pion sur une case appelle onTokenMove avec cette case', () => {
    const onTokenMove = vi.fn();
    const { container } = render(<BoardView board={board} tokens={tokens} canDrag={() => true} onTokenMove={onTokenMove} />);
    const at = mockSvgGeometry(container);
    const svg = container.querySelector('svg')!;
    at({ x: 3, y: 0 });
    fireEvent.pointerDown(screen.getByTestId('token-m1'));
    at({ x: 1, y: 2 });
    fireEvent.pointerMove(svg);
    expect(screen.getByTestId('dragged-token')).toBeInTheDocument();
    fireEvent.pointerUp(svg);
    expect(onTokenMove).toHaveBeenCalledWith('m1', { x: 1, y: 2 });
  });

  it('un simple tap n’est pas un glisser : pas de déplacement, le clic passe', () => {
    const onTokenMove = vi.fn();
    const onToken = vi.fn();
    const { container } = render(<BoardView board={board} tokens={tokens} canDrag={() => true} onTokenMove={onTokenMove} onToken={onToken} />);
    const at = mockSvgGeometry(container);
    at({ x: 3, y: 0 });
    fireEvent.pointerDown(screen.getByTestId('token-m1'));
    fireEvent.pointerUp(container.querySelector('svg')!);
    fireEvent.click(screen.getByTestId('token-m1'));
    expect(onTokenMove).not.toHaveBeenCalled();
    expect(onToken).toHaveBeenCalledWith('m1');
  });

  it('un pion non déplaçable ne se glisse pas', () => {
    const onTokenMove = vi.fn();
    const { container } = render(<BoardView board={board} tokens={tokens} canDrag={() => false} onTokenMove={onTokenMove} />);
    const at = mockSvgGeometry(container);
    at({ x: 3, y: 0 });
    fireEvent.pointerDown(screen.getByTestId('token-m1'));
    at({ x: 0, y: 0 });
    fireEvent.pointerMove(container.querySelector('svg')!);
    fireEvent.pointerUp(container.querySelector('svg')!);
    expect(onTokenMove).not.toHaveBeenCalled();
  });

  it('surcouche d’étape : pion montré au départ, fantôme à l’arrivée, flèche ; pion d’une pose masqué', () => {
    const g = { heroes: [], monsters: [{ id: 'm1', definitionId: 'goblin', position: { x: 3, y: 0 } }], pets: [], mounts: [] } as unknown as GameState;
    const overlay = overlayFor({ type: 'move', actorId: 'm1', path: [{ x: 0, y: 0 }, { x: 3, y: 0 }], doorIds: [] }, g);
    render(<BoardView board={board} tokens={tokens} overlay={overlay} />);
    expect(screen.getByTestId('ghost-m1')).toBeInTheDocument();
    expect(screen.getByTestId('instruction-arrow')).toBeInTheDocument();
    // Le pion apparaît à sa case de départ (0,0), pas à son arrivée (3,0).
    const circle = screen.getByTestId('token-m1').querySelector('circle')!;
    expect(Number(circle.getAttribute('cx'))).toBeLessThan(C);

    const place = overlayFor({ type: 'place', actorId: 'm1', at: { x: 3, y: 0 } }, g);
    const { container } = render(<BoardView board={board} tokens={tokens} overlay={place} />);
    expect(container.querySelector('[data-testid="token-m1"]')).toBeNull();
  });

  it('les monstres affichent leur type d’attaque et leurs dés en pastille', () => {
    render(
      <BoardView
        board={board}
        tokens={[
          { id: 'm1', kind: 'monster', label: 'GO', at: { x: 3, y: 0 }, attack: { type: 'melee', dice: 2 } },
          { id: 'm2', kind: 'monster', label: 'AR', at: { x: 1, y: 1 }, attack: { type: 'ranged', dice: 3 } },
          { id: 'h1', kind: 'hero', label: 'GR', at: { x: 0, y: 0 } },
        ]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Mêlée, 2 dés' })).toHaveTextContent('⚔2');
    expect(screen.getByRole('img', { name: 'Distance, 3 dés' })).toHaveTextContent('🏹3');
    expect(screen.queryByTestId('attack-badge-h1')).not.toBeInTheDocument(); // pas de pastille sur un héros
  });

  it('les objectifs portent leur icône sur leur case ; accompli = coché', () => {
    render(
      <BoardView
        board={board}
        objectives={[
          { id: 'cle', at: { x: 1, y: 1 }, icon: 'key', title: 'Reprendre la clé', done: false },
          { id: 'brasero', at: { x: 2, y: 2 }, icon: 'flame', title: 'Éteindre le brasero', done: true },
        ]}
      />,
    );
    const open = screen.getByTestId('objective-cle');
    expect(open).toHaveAttribute('data-done', 'false');
    expect(open.querySelector('svg')).toHaveAttribute('data-icon', 'key');
    const done = screen.getByTestId('objective-brasero');
    expect(done).toHaveAttribute('data-done', 'true');
    expect(done.querySelector('svg')).toHaveAttribute('data-icon', 'flame');
    expect(done.querySelector('path[stroke="#34d399"]')).not.toBeNull(); // coche verte
    expect(open.querySelector('path[stroke="#34d399"]')).toBeNull();
  });

  it('les objectifs restent visibles : dessinés au-dessus des pions, fantômes et lignes de visée', () => {
    const g = { heroes: [], monsters: [{ id: 'm1', definitionId: 'goblin', position: { x: 1, y: 1 } }], pets: [], mounts: [] } as unknown as GameState;
    const overlay = overlayFor({ type: 'place', actorId: 'm1', at: { x: 1, y: 1 } }, g);
    render(
      <BoardView
        board={board}
        tokens={[
          { id: 'h1', kind: 'hero', label: 'GR', at: { x: 1, y: 1 } }, // un pion se tient sur la case de l'objectif
          { id: 'm2', kind: 'monster', label: 'GO', at: { x: 3, y: 3 } },
        ]}
        overlay={overlay}
        lines={[{ from: { x: 1, y: 1 }, to: { x: 3, y: 3 }, tone: 'clear' }]}
        objectives={[{ id: 'cle', at: { x: 1, y: 1 }, icon: 'key', title: 'Reprendre la clé', done: false }]}
      />,
    );
    const objective = screen.getByTestId('objective-cle');
    const above = (el: Element) => Boolean(el.compareDocumentPosition(objective) & Node.DOCUMENT_POSITION_FOLLOWING);
    // L'objectif vient après (donc au-dessus de) chaque élément qui pourrait le cacher.
    expect(above(screen.getByTestId('token-h1'))).toBe(true);
    expect(above(screen.getByTestId('token-m2'))).toBe(true);
    expect(above(screen.getByTestId('ghost-m1'))).toBe(true);
    expect(above(screen.getByTestId('sight-line'))).toBe(true);
    expect(above(screen.getByTestId('instruction-overlay'))).toBe(true);
    // Sans interaction : il ne bloque aucun clic sur le pion en dessous.
    expect(objective).toHaveAttribute('pointer-events', 'none');
  });
});


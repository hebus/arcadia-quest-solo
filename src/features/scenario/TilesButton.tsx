import { useMemo, useState } from 'react';
import { Button } from '@/components/ui';
import { Modal } from '@/components/Modal';
import type { Board, TileLayout } from '@/engine/domain/schemas';
import { BoardView } from '@/rendering/board/BoardView';
import { allTiles } from '@/features/setup/builtinTiles';
import { useTileStore } from '@/stores/tileStore';

/** Les tuiles du plateau en réduit : le plateau assemblé, sans pion, avec le numéro de chaque tuile. */
function TilesPreview({ board, layout }: { board: Board; layout: TileLayout }) {
  const library = useTileStore((s) => s.tiles);
  const byId = useMemo(() => Object.fromEntries(allTiles(library).map((t) => [t.id, t])), [library]);
  const placed = layout.placements.flatMap((pl) => (byId[pl.tileId] ? [{ def: byId[pl.tileId]!, placement: pl }] : []));
  return (
    <div className="space-y-2">
      <BoardView label="Tuiles du plateau (réduit)" board={board} tiles={placed} tileLabels={layout.placements.map((pl) => ({ tx: pl.tx, ty: pl.ty, dx: pl.dx, dy: pl.dy, label: pl.tileId }))} showCoords={false} />
      <p className="text-sm text-stone-400">Chaque tuile est double face : dans ce scénario, une seule de ses deux faces est utilisée.</p>
    </div>
  );
}

/** Bouton du briefing : ouvre, dans un dialogue, les tuiles du plateau en réduit, pour aider à construire le plateau sur la table. */
export function TilesButton({ board, layout }: { board: Board; layout: TileLayout }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        ▦ Voir les tuiles
      </Button>
      {open && (
        <Modal title="Tuiles du plateau" size="sm" onClose={() => setOpen(false)}>
          <TilesPreview board={board} layout={layout} />
        </Modal>
      )}
    </>
  );
}

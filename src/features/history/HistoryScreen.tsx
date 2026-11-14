import { Button, Panel } from '@/components/ui';
import { useGameStore } from '@/stores/gameStore';

export function HistoryScreen() {
  const g = useGameStore((s) => s.game)!;
  const history = useGameStore((s) => s.history);
  const undo = useGameStore((s) => s.undo);
  const last = history[history.length - 1];
  return (
    <Panel
      title="Historique"
      actions={
        <Button
          disabled={!last}
          onClick={() => {
            if (window.confirm(`Annuler « ${last?.label} » ? Les actions physiques déjà réalisées ne sont PAS annulées : remettez le plateau en état à la main.`)) undo();
          }}
        >
          Annuler : {last?.label ?? 'rien à annuler'}
        </Button>
      }
    >
      <ol className="max-h-[60vh] space-y-1 overflow-auto text-sm" aria-label="Journal des événements">
        {[...g.events].reverse().map((e) => (
          <li key={e.seq} className="rounded bg-stone-800 px-2 py-1">
            <span className="text-stone-400">
              #{e.seq} · manche {e.round} ·{' '}
            </span>
            {e.message}
          </li>
        ))}
        {g.events.length === 0 && <li className="text-stone-400">Aucun événement.</li>}
      </ol>
    </Panel>
  );
}

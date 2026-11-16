import { Button } from '@/components/ui';
import { MiniPawn } from '@/components/MiniPawn';
import type { VisualAction } from '@/engine/visual';
import { actorInfo } from '@/rendering/instructions/overlay';
import { useGameStore, type TrackedInstruction } from '@/stores/gameStore';

const ICON: Record<VisualAction['type'], string> = { place: '⤓', move: '➜', remove: '✕', attack: '⚔', door: '🚪', 'spawn-point': '✦', activate: '◉' };
const VERB: Record<VisualAction['type'], string> = {
  place: 'Poser',
  move: 'Déplacer',
  remove: 'Retirer',
  attack: 'Attaque',
  door: 'Ouvrir la porte',
  activate: 'Monstre activé',
  'spawn-point': 'Jeton Spawn',
};

function StepVisual({ step }: { step: TrackedInstruction }) {
  const g = useGameStore((s) => s.game)!;
  const v = step.visual;
  if (!v) return <p className="truncate text-base">{step.label ?? step.text}</p>;
  const actorId = v.type === 'attack' ? v.attackerId : v.type === 'spawn-point' || v.type === 'door' ? undefined : v.actorId;
  const actor = actorId ? actorInfo(g, actorId) : undefined;
  const target = v.type === 'attack' ? actorInfo(g, v.targetId) : undefined;
  return (
    <div className="flex min-w-0 items-center gap-2" data-testid="instruction-step">
      <span className="text-2xl text-amber-400" aria-hidden="true">
        {ICON[v.type]}
      </span>
      {actor && <MiniPawn kind={actor.kind} label={actor.label} size={32} />}
      {target && (
        <>
          <span className="text-xl text-red-400" aria-hidden="true">
            ➜
          </span>
          <MiniPawn kind={target.kind} label={target.label} size={32} />
          <span className="text-xl" aria-label={`${v.type === 'attack' ? v.wounds : 0} blessure(s)`}>
            {v.type === 'attack' && v.wounds > 0 ? '🩸'.repeat(Math.min(v.wounds, 6)) : '🛡'}
          </span>
        </>
      )}
      <span className="truncate text-base font-medium">{step.label ?? VERB[v.type]}</span>
    </div>
  );
}

/**
 * Lecteur d'étapes : une action physique à la fois, montrée sur le plateau (fantôme, flèche, croix, porte).
 * Chaque étape se valide en glissant la figurine sur sa cible, ou d'un tap sur « Fait ».
 */
export function InstructionPlayer() {
  const instructions = useGameStore((s) => s.instructions);
  const confirm = useGameStore((s) => s.confirmInstruction);
  const confirmAll = useGameStore((s) => s.confirmAll);
  if (instructions.length === 0) return null;
  const left = instructions.filter((i) => !i.confirmed);
  const current = left[0];
  const index = instructions.length - left.length + 1;
  if (!current) return null;
  const groups = [...new Set(instructions.flatMap((i) => (i.group ? [i.group] : [])))];
  return (
    <div className="w-full">
    <section aria-label={`Sur la table : étape ${index}/${instructions.length}`} className="flex h-12 w-full items-center gap-3 overflow-hidden rounded-xl border border-amber-500 bg-stone-800 px-2">
      {groups.length > 0 && (
        <ol className="flex shrink-0 items-center gap-1.5" aria-label="Déroulement de la phase des monstres">
          {groups.map((g) => {
            const done = instructions.filter((i) => i.group === g).every((i) => i.confirmed);
            const here = current.group === g && !done;
            // Simple pastille (le libellé reste lisible au survol et pour les lecteurs d'écran) ; seule l'activation en cours pulse.
            return (
              <li
                key={g}
                title={g}
                aria-current={here ? 'step' : undefined}
                className={`size-3 overflow-hidden rounded-full text-[0px] ${here ? 'aq-pulse bg-amber-400' : done ? 'bg-emerald-600' : 'bg-stone-600'}`}
              >
                {g}
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <StepVisual step={current} />
        <span className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" onClick={() => confirm(current.id)}>
            Fait
          </Button>
          {left.length > 1 && (
            <Button variant="ghost" onClick={confirmAll}>
              Tout confirmer
            </Button>
          )}
        </span>
      </div>
    </section>
    <p className="mt-1 text-sm text-stone-400">
      {index}/{instructions.length} · touchez la case
    </p>
    </div>
  );
}

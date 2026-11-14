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
  if (!v) return <p className="whitespace-pre-line text-lg">{step.label ?? step.text}</p>;
  const actorId = v.type === 'attack' ? v.attackerId : v.type === 'spawn-point' || v.type === 'door' ? undefined : v.actorId;
  const actor = actorId ? actorInfo(g, actorId) : undefined;
  const target = v.type === 'attack' ? actorInfo(g, v.targetId) : undefined;
  return (
    <div className="flex items-center gap-4" data-testid="instruction-step">
      <span className="text-4xl text-amber-400" aria-hidden="true">
        {ICON[v.type]}
      </span>
      {actor && <MiniPawn kind={actor.kind} label={actor.label} />}
      {target && (
        <>
          <span className="text-2xl text-red-400" aria-hidden="true">
            ➜
          </span>
          <MiniPawn kind={target.kind} label={target.label} />
          <span className="text-2xl" aria-label={`${v.type === 'attack' ? v.wounds : 0} blessure(s)`}>
            {v.type === 'attack' && v.wounds > 0 ? '🩸'.repeat(Math.min(v.wounds, 6)) : '🛡'}
          </span>
        </>
      )}
      <span className="text-lg font-medium">{step.label ?? VERB[v.type]}</span>
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
    <section aria-label={`Sur la table : étape ${index}/${instructions.length}`} className="rounded-xl border border-amber-500 bg-stone-800 p-2">
      {groups.length > 0 && (
        <ol className="mb-2 flex flex-wrap gap-1 text-xs" aria-label="Déroulement de la phase des monstres">
          {groups.map((g) => {
            const done = instructions.filter((i) => i.group === g).every((i) => i.confirmed);
            const here = current.group === g;
            return (
              <li key={g} aria-current={here ? 'step' : undefined} className={`rounded-full px-2 py-0.5 ${here ? 'bg-amber-400 font-semibold text-stone-900' : done ? 'bg-emerald-800 text-emerald-100' : 'bg-stone-700 text-stone-300'}`}>
                {done && !here ? '✔ ' : ''}
                {g}
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StepVisual step={current} />
        <span className="flex items-center gap-2">
          <span className="text-sm text-stone-300">
            {index}/{instructions.length} · touchez la case
          </span>
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
      <ol className="mt-2 flex gap-1" aria-label="Progression">
        {instructions.map((i) => (
          <li key={i.id} className={`h-1.5 flex-1 rounded ${i.confirmed ? 'bg-emerald-600' : i === current ? 'bg-amber-400' : 'bg-stone-600'}`} />
        ))}
      </ol>
    </section>
  );
}

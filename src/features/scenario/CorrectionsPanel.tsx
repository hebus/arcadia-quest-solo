import { useState } from 'react';
import { Button, Panel, inputClass } from '@/components/ui';
import type { Correction } from '@/engine/corrections';
import { useGameStore } from '@/stores/gameStore';

type Kind = Correction['kind'];

const KINDS: { kind: Kind; label: string }[] = [
  { kind: 'hero-wounds', label: 'Blessures d\'un héros' },
  { kind: 'hero-dead', label: 'Mort / résurrection d\'un héros' },
  { kind: 'hero-stunned', label: 'Héros étourdi ou non' },
  { kind: 'monster-status', label: 'Monstre : plateau / Spawn Tile / boîte' },
  { kind: 'monster-wounds', label: 'Blessures d\'un monstre' },
  { kind: 'monster-guard', label: 'Garde ou non' },
  { kind: 'door', label: 'État d\'une porte' },
  { kind: 'quest', label: 'Quête accomplie' },
  { kind: 'deaths', label: 'Compteur de morts' },
  { kind: 'coins', label: 'Pièces' },
];

/** Correction manuelle de l'état logique ou physique ; toujours historisée (plan §4.3 G). */
export function CorrectionsPanel() {
  const g = useGameStore((s) => s.game)!;
  const correct = useGameStore((s) => s.correct);
  const [kind, setKind] = useState<Kind>('hero-wounds');
  const startPlacing = useGameStore((s) => s.startPlacing);
  const correctionMode = useGameStore((s) => s.correctionMode);
  const setCorrectionMode = useGameStore((s) => s.setCorrectionMode);
  const [target, setTarget] = useState('');
  const [n, setN] = useState(0);
  const [flag, setFlag] = useState(false);
  const [status, setStatus] = useState<'board' | 'spawn-tile' | 'box' | 'removed'>('board');

  const targets: string[] =
    kind.startsWith('hero')
      ? g.heroes.map((h) => h.id)
      : kind.startsWith('monster')
        ? g.monsters.map((m) => m.id)
        : kind === 'door'
          ? g.board.doors.map((d) => d.id)
          : kind === 'quest'
            ? g.quests.map((q) => q.id)
            : [];
  const needsTarget = targets.length > 0;
  const id = target || targets[0] || '';

  /** Corrections qui remettent une figurine sur le plateau : la case se touche sur le plateau, elle ne se saisit pas. */
  const needsCell = (kind === 'hero-dead' && !flag) || (kind === 'monster-status' && status === 'board');

  const build = (at?: { x: number; y: number }): Correction | null => {
    switch (kind) {
      case 'hero-position': return { kind, heroId: id, to: at ?? null };
      case 'hero-wounds': return { kind, heroId: id, wounds: n };
      case 'hero-dead': return { kind, heroId: id, dead: flag, at };
      case 'hero-stunned': return { kind, heroId: id, stunned: flag };
      case 'monster-position': return { kind, monsterId: id, to: at! };
      case 'monster-status': return { kind, monsterId: id, status, at };
      case 'monster-wounds': return { kind, monsterId: id, wounds: n };
      case 'monster-guard': return { kind, monsterId: id, isGuard: flag };
      case 'door': return { kind, doorId: id, open: flag };
      case 'quest': return { kind, questId: id, done: flag };
      case 'deaths': return { kind, deaths: n };
      case 'coins': return { kind, coins: n };
    }
  };

  const usesNum = ['hero-wounds', 'monster-wounds', 'deaths', 'coins'].includes(kind);
  const usesFlag = ['hero-dead', 'hero-stunned', 'monster-guard', 'door', 'quest'].includes(kind);
  const flagLabel = { 'hero-dead': 'mort', 'hero-stunned': 'étourdi', 'monster-guard': 'garde', door: 'ouverte', quest: 'accomplie' }[kind as 'door'] ?? '';

  return (
    <Panel title="Corrections">
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-stone-800 p-2">
        <Button variant={correctionMode ? 'primary' : 'secondary'} aria-pressed={correctionMode} onClick={() => setCorrectionMode(!correctionMode)}>
          {correctionMode ? '✔ Recalage actif' : 'Recaler le plateau avec la table'}
        </Button>
        <span className="text-sm text-stone-300">Positions et portes : glissez les pions, touchez les portes sur le plateau.</span>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label>
          Quoi
          <select className={inputClass} value={kind} onChange={(e) => { setKind(e.target.value as Kind); setTarget(''); }}>
            {KINDS.map((k) => (<option key={k.kind} value={k.kind}>{k.label}</option>))}
          </select>
        </label>
        {needsTarget && (
          <label>
            Cible
            <select className={inputClass} value={id} onChange={(e) => setTarget(e.target.value)}>
              {targets.map((t) => (<option key={t}>{t}</option>))}
            </select>
          </label>
        )}
        {usesNum && (
          <label>Valeur<input className={inputClass} type="number" min={0} value={n} onChange={(e) => setN(Number(e.target.value))} /></label>
        )}
        {kind === 'monster-status' && (
          <label>
            Statut
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="board">plateau</option>
              <option value="spawn-tile">Spawn Tile</option>
              <option value="box">boîte</option>
              <option value="removed">retiré</option>
            </select>
          </label>
        )}
        {usesFlag && (
          <label className="flex items-center gap-2 self-end">
            <input type="checkbox" checked={flag} onChange={(e) => setFlag(e.target.checked)} /> {flagLabel}
          </label>
        )}
      </div>
      <div className="mt-3">
        <Button
          variant="primary"
          onClick={() => {
            if (needsCell) {
              // La case se choisit en touchant le plateau.
              startPlacing({ actorId: id, onPlace: (to) => { const c = build(to); if (c) correct(c); } });
              return;
            }
            const c = build();
            if (c) correct(c);
          }}
        >
          {needsCell ? 'Choisir la case sur le plateau' : 'Appliquer la correction'}
        </Button>
      </div>
    </Panel>
  );
}

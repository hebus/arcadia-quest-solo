import { monsterStats, statsOfMonster } from '@/engine/monsters';
import { MiniPawn } from '@/components/MiniPawn';
import { Stepper } from '@/components/Tally';
import { Button, Panel } from '@/components/ui';
import { DEFAULT_ATTACK_DIE } from '@/game-data/dice';
import { DICE_PRESETS, presetOf } from '@/engine/sandbox';
import { scenarioOfGame } from '@/game-data/original';
import { actorInfo } from '@/rendering/instructions/overlay';
import { useGameStore } from '@/stores/gameStore';
import { CopyLogs } from './CopyLogs';

/** La partie en cours est-elle un terrain d'essai ? */
export function useIsSandbox(): boolean {
  return useGameStore((s) => !!s.game && !!scenarioOfGame(s.game)?.sandbox);
}

/** Bande de raccourcis sous le plateau : placement libre et saut direct au tour des monstres. */
export function SandboxStrip() {
  const g = useGameStore((s) => s.game)!;
  const free = useGameStore((s) => s.correctionMode);
  const setFree = useGameStore((s) => s.setCorrectionMode);
  const skip = useGameStore((s) => s.skipToMonsters);
  return (
    <div data-testid="sandbox-strip" className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-sky-500 bg-sky-950/40 p-2">
      <span className="text-sm text-sky-200">🧪 Terrain d’essai</span>
      <Button variant={free ? 'primary' : 'secondary'} aria-pressed={free} onClick={() => setFree(!free)}>
        {free ? '✔ Placement libre' : 'Placement libre'}
      </Button>
      <Button disabled={g.phase !== 'GUILD_TURN'} onClick={skip}>
        ▶ Sauter au tour des monstres
      </Button>
      <CopyLogs />
    </div>
  );
}

/** Outils du terrain d'essai : monstres, blessures, dés, déroulement. */
/** `onPlace` : appelé après le choix d'un type de monstre, pour fermer le menu et laisser toucher le plateau. */
export function SandboxPanel({ onPlace }: { onPlace?: () => void }) {
  const g = useGameStore((s) => s.game)!;
  const content = useGameStore((s) => s.content);
  const add = useGameStore((s) => s.sandboxAddMonster);
  const correct = useGameStore((s) => s.correct);
  const setDice = useGameStore((s) => s.setDice);
  const skip = useGameStore((s) => s.skipToMonsters);
  const restart = useGameStore((s) => s.restart);
  const preset = presetOf(content.attackDie);
  const onBoard = g.monsters.filter((m) => m.status === 'board');

  return (
    <div className="space-y-3">
      <Panel title="Ajouter un monstre">
        <p className="mb-2 text-sm text-stone-400">Choisissez un type, puis touchez une case libre du plateau.</p>
        <div className="flex flex-wrap gap-2">
          {Object.values(content.monsters).filter((m) => monsterStats(m, g.monsterCardSet)).map((m) => (
            <Button key={m.id} onClick={() => { add(m.id); onPlace?.(); }}>
              + {m.name}
            </Button>
          ))}
        </div>
      </Panel>

      <Panel title={`Monstres en place (${onBoard.length})`}>
        {onBoard.length === 0 && <p className="text-stone-400">Aucun monstre sur le plateau.</p>}
        <ul className="space-y-2">
          {onBoard.map((m) => {
            const stats = statsOfMonster(content, g, m);
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-stone-800 p-2">
                <MiniPawn kind="monster" label={actorInfo(g, m.id).label} size={32} />
                <span className="min-w-24">
                  <strong>{m.id}</strong>
                  {stats && <span className="block text-xs text-stone-400">{stats.attackType === 'melee' ? '⚔' : '🏹'}{stats.attackDice} · ❤{stats.life} · ☠{stats.overkill} · ➜{stats.movement}</span>}
                </span>
                <Stepper label={`Blessures de ${m.id}`} value={m.wounds} onChange={(n) => correct({ kind: 'monster-wounds', monsterId: m.id, wounds: n })} />
                <Button aria-pressed={m.isGuard} variant={m.isGuard ? 'primary' : 'secondary'} onClick={() => correct({ kind: 'monster-guard', monsterId: m.id, isGuard: !m.isGuard })}>
                  Garde
                </Button>
                <Button variant="danger" aria-label={`Retirer ${m.id}`} onClick={() => correct({ kind: 'monster-status', monsterId: m.id, status: 'removed' })}>
                  Retirer
                </Button>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="Héros">
        <ul className="space-y-2">
          {g.heroes.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-stone-800 p-2">
              <MiniPawn kind="hero" label={actorInfo(g, h.id).label} size={32} dead={h.dead} />
              <strong className="min-w-16">{h.name}</strong>
              <Stepper label={`Blessures de ${h.name}`} value={h.wounds} onChange={(n) => correct({ kind: 'hero-wounds', heroId: h.id, wounds: n })} />
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Dés des monstres">
        <p className="mb-2 text-sm text-stone-400">« Toujours » fixe le jeton Spawn de référence (S1 : épée+épée, S2 : arc+arc), donc quel monstre agit, et si ses attaques touchent : la situation se rejoue à l’identique.</p>
        <div role="group" aria-label="Dés des monstres" className="flex flex-wrap gap-2">
          {DICE_PRESETS.map((p) => (
            <Button key={p.id} variant={preset.id === p.id ? 'primary' : 'secondary'} aria-pressed={preset.id === p.id} onClick={() => setDice(p.faces ?? DEFAULT_ATTACK_DIE, content.defenseDie)}>
              {p.label}
            </Button>
          ))}
        </div>
      </Panel>

      <Panel title="Déroulement">
        <div className="flex flex-wrap gap-2">
          <Button disabled={g.phase !== 'GUILD_TURN'} onClick={skip}>
            ▶ Sauter au tour des monstres
          </Button>
          <Button variant="danger" onClick={restart}>
            ↺ Remettre la disposition de départ
          </Button>
        </div>
      </Panel>
    </div>
  );
}

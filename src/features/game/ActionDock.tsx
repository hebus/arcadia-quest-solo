import { Button } from '@/components/ui';
import { MiniPawn } from '@/components/MiniPawn';
import { HERO_MOVEMENT, mpLeft } from '@/engine/combat/heroMove';
import { blockedByOtherHero, isTerminal } from '@/engine/state';
import { useAttackAnnouncement } from '@/features/game/announce';
import { actorInfo } from '@/rendering/instructions/overlay';
import { usePortrait } from '@/hooks/usePortrait';
import { SandboxStrip, useIsSandbox } from './SandboxPanel';
import { useGameStore } from '@/stores/gameStore';

/** Les héros à côté du plateau : une carte par héros (pion, cœurs). Toucher une carte sélectionne le héros. */
export function HeroRoster({ stacked = false }: { stacked?: boolean }) {
  const g = useGameStore((s) => s.game)!;
  const selectedId = useGameStore((s) => s.selectedId);
  const select = useGameStore((s) => s.select);
  const guild = g.phase === 'GUILD_TURN';
  const correct = useGameStore((st) => st.correct);
  const startPlacing = useGameStore((st) => st.startPlacing);
  /** Santé et état du héros, modifiables à tout moment (soins, pouvoirs…) : la table fait foi. */
  const setWounds = (id: string, wounds: number, life: number) => {
    correct({ kind: 'hero-wounds', heroId: id, wounds: Math.max(0, Math.min(life, wounds)) });
    if (wounds >= life) correct({ kind: 'hero-dead', heroId: id, dead: true });
  };
  const btn = 'flex min-h-9 min-w-9 items-center justify-center rounded-lg border-2 border-stone-600 bg-stone-900 px-1.5 text-base font-bold transition-colors hover:bg-stone-800 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400';
  return (
    <ul className={stacked ? 'flex flex-col gap-3' : 'flex flex-nowrap gap-1 landscape:flex-wrap landscape:gap-2'} aria-label="Héros" data-testid="hero-roster">
      {g.heroes.map((h) => {
        const on = selectedId === h.id;
        const blocked = guild && blockedByOtherHero(g, h.id);
        return (
          <li key={h.id} className={stacked ? 'flex min-w-0 flex-row-reverse items-center justify-between gap-2' : 'flex min-w-0 max-w-[21rem] flex-1 flex-col gap-1 landscape:w-[21rem] landscape:flex-none'}>
            <div className="flex justify-end gap-1">
            <div className="flex shrink-0 gap-1" role="group" aria-label={`Santé de ${h.name}`}>
              {h.dead ? (
                <button type="button" className={btn} title="Ressusciter : touchez ensuite sa case sur le plateau" aria-label={`Ressusciter ${h.name}`} onClick={() => startPlacing({ actorId: h.id, onPlace: (at) => correct({ kind: 'hero-dead', heroId: h.id, dead: false, at }) })}>
                  ✚
                </button>
              ) : (
                <>
                  <button type="button" className={btn} title="Soigner d’un cœur" aria-label={`Soigner ${h.name}`} disabled={h.wounds <= 0} onClick={() => setWounds(h.id, h.wounds - 1, h.life)}>
                    ❤+
                  </button>
                  <button type="button" className={btn} title="Une blessure de plus" aria-label={`Blesser ${h.name}`} onClick={() => setWounds(h.id, h.wounds + 1, h.life)}>
                    🖤
                  </button>
                </>
              )}
            </div>
            {!h.dead && (
              <button
                type="button"
                className={`${btn} ${h.stunned ? 'border-violet-400 bg-violet-900' : ''}`}
                title={h.stunned ? 'Retirer le jeton Étourdi' : 'Poser un jeton Étourdi'}
                aria-label={`${h.stunned ? 'Retirer l’étourdissement de' : 'Étourdir'} ${h.name}`}
                aria-pressed={!!h.stunned}
                onClick={() => correct({ kind: 'hero-stunned', heroId: h.id, stunned: !h.stunned })}
              >
                💫
              </button>
            )}
            </div>
            <button
              type="button"
              aria-label={`Repérer ${h.name} sur le plateau`}
              aria-pressed={on}
              disabled={h.dead || blocked}
              onClick={() => select(on ? null : h.id)}
              className={`flex min-w-0 flex-1 items-center gap-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50 ${stacked ? `py-1 ${on ? 'text-amber-300' : ''}` : `rounded-xl border-2 px-2 py-1 ${on ? 'border-amber-400 bg-stone-800' : 'border-stone-700 bg-stone-900'}`}`}
            >
              <span className="portrait:hidden"><MiniPawn kind="hero" label={actorInfo(g, h.id).label} size={32} dead={h.dead} /></span>
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 leading-tight">
                <span className="font-medium">
                  {h.name}
                  {h.stunned && !h.dead && (
                    <span className="ml-1 rounded-full bg-violet-800 px-1.5 text-xs font-semibold text-violet-100" title="Jeton Étourdi posé sur la figurine">
                      💫 étourdi
                    </span>
                  )}
                </span>
                <span className="text-sm" title="Points de vie">
                  {'❤'.repeat(Math.max(0, h.life - h.wounds))}
                  {'🖤'.repeat(Math.min(h.life, h.wounds))}
                </span>
              </span>
              {g.activatedHeroIds.includes(h.id) && (
                <span className="text-amber-300" title="Activé ce tour" aria-hidden="true">
                  ●
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Annonce « qui attaque qui » : même emplacement et mêmes dimensions que le bloc d'activation des monstres, au-dessus du plateau. */
export function AttackAnnouncement({ announcement }: { announcement: NonNullable<ReturnType<typeof useAttackAnnouncement>> }) {
  const g = useGameStore((s) => s.game)!;
  const content = useGameStore((s) => s.content);
  const nameOf = (id: string): string => {
    const m = g.monsters.find((x) => x.id === id);
    return m ? (content.monsters[m.definitionId]?.name ?? m.definitionId) : actorInfo(g, id).name;
  };
  const attacker = actorInfo(g, announcement.attackerId);
  const target = actorInfo(g, announcement.targetId);
  return (
    <section aria-label="Attaque du monstre" data-testid="attack-announcement" className="flex h-12 w-full items-center justify-between gap-3 overflow-hidden rounded-xl border-2 border-red-500 bg-stone-800 px-2">
      <div className="flex min-w-0 items-center gap-2">
        <MiniPawn kind={attacker.kind} label={attacker.label} size={32} />
        <span className="text-xl text-red-400" aria-hidden="true">
          ⚔ ➜
        </span>
        <MiniPawn kind={target.kind} label={target.label} size={32} />
        {/* Les pions et les icônes suffisent à l'écran ; le texte reste pour les lecteurs d'écran. */}
        <p className="sr-only">
          <strong>{nameOf(announcement.attackerId)}</strong> attaque <strong>{nameOf(announcement.targetId)}</strong>
        </p>
      </div>
      <Button variant="primary" className="min-h-9! py-1! shrink-0 text-2xl! leading-none" aria-label="Continuer : lancer mes dés" title="Continuer : lancer mes dés" onClick={announcement.acknowledge}>
        <span aria-hidden="true">🎲</span>
      </Button>
    </section>
  );
}

/**
 * Actions de l'étape en cours : un seul groupe de boutons, ou la carte de l'étape physique à valider.
 * Tout le reste (détails, journal, corrections, décisions de l'agent) est dans le menu.
 */
export function ActionPanel({ onDecisions, onResult }: { onDecisions: () => void; onResult: () => void }) {
  const g = useGameStore((s) => s.game)!;
  const st = useGameStore();
  const pendingSteps = st.instructions.some((i) => !i.confirmed);
  const selected = g.heroes.find((h) => h.id === st.selectedId && !h.dead) ?? null;
  const guild = g.phase === 'GUILD_TURN';
  const ended = isTerminal(g.phase);
  const announcement = useAttackAnnouncement();
  const sandbox = useIsSandbox();
  // En portrait, la fiche du héros porte déjà ses PM : ni ligne de PM ni « Activer sans agir ».
  const portrait = usePortrait();

  // Un monstre attaque : l'annonce est affichée au-dessus du plateau (voir GameBoard), le dock attend.
  if (announcement) return null;

  return (
    <div className="space-y-2" data-testid="action-dock">
      {sandbox && !portrait && <SandboxStrip />}

      {!pendingSteps && (
        <div className="flex flex-col items-stretch gap-2">
          {g.phase === 'SCENARIO_SETUP' && (
            <>
              <span className="text-sm text-stone-300">Le plateau de la table correspond à l’écran ?</span>
              <Button variant="primary" onClick={st.begin}>
                Démarrer le scénario
              </Button>
            </>
          )}

          {guild && (
            <>
              {selected && !portrait && (
                <span className="rounded-lg bg-stone-800 px-3 py-2 text-sm">
                  {selected.name} : {mpLeft(g, selected.id)}/{HERO_MOVEMENT} PM
                </span>
              )}
              {selected && !portrait && !g.activatedHeroIds.includes(selected.id) && !blockedByOtherHero(g, selected.id) && (
                <Button variant="ghost" onClick={() => st.activateHero(selected.id)}>
                  Activer sans agir
                </Button>
              )}
            </>
          )}

          {g.phase === 'MONSTER_TURN_SPAWN' && (
            <Button variant="primary" disabled={st.agent.status === 'awaiting-input'} onClick={st.startMonsterTurn}>
              Lancer le Monster Turn
            </Button>
          )}

          {st.agent.status === 'awaiting-input' && (
            <>
              <span className="text-sm text-amber-300">En attente de votre saisie…</span>
              <Button onClick={st.abortMonsterTurn}>Arrêter</Button>
            </>
          )}

          {ended && (
            <Button variant="primary" onClick={onResult}>
              Voir le résultat et la phase d&apos;amélioration
            </Button>
          )}
        </div>
      )}

      {st.traces.length > 0 && (
        <Button variant="ghost" className="w-full" onClick={onDecisions}>
          Décisions de l&apos;agent ({st.traces.length})
        </Button>
      )}
    </div>
  );
}

import { Button } from '@/components/ui';
import { MiniPawn } from '@/components/MiniPawn';
import { HERO_MOVEMENT, mpLeft } from '@/engine/combat/heroMove';
import { blockedByOtherHero, isTerminal } from '@/engine/state';
import { InstructionPlayer } from '@/features/instructions/InstructionPlayer';
import { useAttackAnnouncement } from '@/features/game/announce';
import { actorInfo } from '@/rendering/instructions/overlay';
import { SandboxStrip, useIsSandbox } from './SandboxPanel';
import { useGameStore } from '@/stores/gameStore';

/** Les héros à côté du plateau : une carte par héros (pion, cœurs). Toucher une carte sélectionne le héros. */
export function HeroRoster() {
  const g = useGameStore((s) => s.game)!;
  const selectedId = useGameStore((s) => s.selectedId);
  const select = useGameStore((s) => s.select);
  const guild = g.phase === 'GUILD_TURN';
  return (
    <ul className="flex flex-wrap gap-2 lg:flex-col" aria-label="Héros" data-testid="hero-roster">
      {g.heroes.map((h) => {
        const on = selectedId === h.id;
        const blocked = guild && blockedByOtherHero(g, h.id);
        return (
          <li key={h.id} className="lg:w-full">
            <button
              type="button"
              aria-label={`Repérer ${h.name} sur le plateau`}
              aria-pressed={on}
              disabled={h.dead || blocked}
              onClick={() => select(on ? null : h.id)}
              className={`flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50 ${on ? 'border-amber-400 bg-stone-800' : 'border-stone-700 bg-stone-900'}`}
            >
              <MiniPawn kind="hero" label={actorInfo(g, h.id).label} size={40} dead={h.dead} />
              <span className="flex-1 leading-tight">
                <span className="block font-medium">
                  {h.name}
                  {h.stunned && !h.dead && (
                    <span className="ml-2 rounded-full bg-violet-800 px-2 py-0.5 text-xs font-semibold text-violet-100" title="Jeton Étourdi posé sur la figurine">
                      💫 étourdi
                    </span>
                  )}
                </span>
                <span className="block text-sm" title="Points de vie">
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

  // Un monstre attaque : le plateau le montre ; on le confirme ici avant d'ouvrir le dialogue de dés.
  if (announcement) {
    const nameOf = (id: string): string => {
      const m = g.monsters.find((x) => x.id === id);
      return m ? (st.content.monsters[m.definitionId]?.name ?? m.definitionId) : actorInfo(g, id).name;
    };
    const attacker = actorInfo(g, announcement.attackerId);
    const target = actorInfo(g, announcement.targetId);
    return (
      <section aria-label="Attaque du monstre" data-testid="attack-announcement" className="space-y-3 rounded-xl border-2 border-red-500 bg-stone-800 p-3">
        <div className="flex items-center justify-center gap-3">
          <MiniPawn kind={attacker.kind} label={attacker.label} size={46} />
          <span className="text-3xl text-red-400" aria-hidden="true">
            ⚔ ➜
          </span>
          <MiniPawn kind={target.kind} label={target.label} size={46} />
        </div>
        <p className="text-center text-lg">
          <strong>{nameOf(announcement.attackerId)}</strong> attaque <strong>{nameOf(announcement.targetId)}</strong>
        </p>
        <Button variant="primary" className="w-full" onClick={announcement.acknowledge}>
          Continuer : lancer mes dés
        </Button>
      </section>
    );
  }

  return (
    <div className="space-y-2" data-testid="action-dock">
      {sandbox && <SandboxStrip />}
      {pendingSteps && <InstructionPlayer />}

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
              {selected && (
                <span className="rounded-lg bg-stone-800 px-3 py-2 text-sm">
                  {selected.name} : {mpLeft(g, selected.id)}/{HERO_MOVEMENT} PM
                </span>
              )}
              <Button disabled={g.activatedHeroIds.length > 0} onClick={st.restWithPlacement}>
                Se reposer
              </Button>
              {selected && !g.activatedHeroIds.includes(selected.id) && !blockedByOtherHero(g, selected.id) && (
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

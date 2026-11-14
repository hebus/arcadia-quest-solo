import { useEffect, useState } from 'react';
import type { GameState } from '@/engine/domain/schemas';

export type TurnSide = 'heroes' | 'monsters';

/**
 * À qui est le tour : les monstres pendant leur tour, y compris tant que leurs étapes ne sont pas toutes jouées sur la table
 * (le moteur calcule le tour d'un coup, la phase repasse donc au tour de guilde avant que la table ait suivi) ; les héros
 * ensuite ; personne en mise en place ou en fin de partie.
 */
export function turnSide(phase: GameState['phase'], monsterStepsPending = false): TurnSide | null {
  if (phase.startsWith('MONSTER_TURN')) return 'monsters';
  if (phase === 'GUILD_TURN') return monsterStepsPending ? 'monsters' : 'heroes';
  return null;
}

const LABEL: Record<TurnSide, { text: string; icon: string; className: string }> = {
  heroes: { text: 'Tour des héros', icon: '🛡', className: 'border-sky-300 bg-sky-800/90 text-sky-50' },
  monsters: { text: 'Tour des monstres', icon: '👹', className: 'border-red-300 bg-red-900/90 text-red-50' },
};

/** Durée d'affichage, alignée sur l'animation `aq-banner` (index.css). */
export const BANNER_MS = 2200;

/**
 * Bandeau posé en travers du plateau quand le tour passe aux héros ou aux monstres. Il s'efface seul et ne capte aucun
 * toucher : les cases dessous restent jouables.
 */
export function TurnBanner({ side }: { side: TurnSide | null }) {
  const [prev, setPrev] = useState(side);
  const [shown, setShown] = useState<TurnSide | null>(side);
  // Changement de camp : on réaffiche le bandeau (ajustement d'état pendant le rendu, sans effet).
  if (side !== prev) {
    setPrev(side);
    setShown(side);
  }
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(null), BANNER_MS);
    return () => clearTimeout(t);
  }, [shown]);
  if (!shown) return null;
  const l = LABEL[shown];
  return (
    <div data-testid="turn-banner" data-side={shown} aria-live="polite" className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2">
      <div key={shown} className={`aq-banner mx-auto flex w-full items-center justify-center gap-3 border-y-4 py-3 text-2xl font-bold tracking-wide shadow-lg sm:text-3xl ${l.className}`}>
        <span aria-hidden="true">{l.icon}</span>
        {l.text}
      </div>
    </div>
  );
}

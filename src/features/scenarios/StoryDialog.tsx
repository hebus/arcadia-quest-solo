import { Button } from '@/components/ui';
import { useGameStore } from '@/stores/gameStore';

const TONE = {
  story: { border: 'border-amber-500', accent: 'text-amber-300', icon: '📜' },
  quest: { border: 'border-emerald-500', accent: 'text-emerald-300', icon: '⚑' },
  danger: { border: 'border-red-500', accent: 'text-red-300', icon: '⚠' },
  reward: { border: 'border-yellow-400', accent: 'text-yellow-300', icon: '🎁' },
} as const;

/** Moment de récit du maître de jeu : texte d'ambiance, quête accomplie ou danger. S'affiche avant les actions à jouer sur la table. */
export function StoryDialog() {
  const beat = useGameStore((s) => s.beats[0]);
  const more = useGameStore((s) => s.beats.length - 1);
  const dismiss = useGameStore((s) => s.dismissBeat);
  if (!beat) return null;
  const tone = TONE[beat.tone];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="presentation">
      <div role="dialog" aria-modal="true" aria-label={beat.title ?? 'Récit'} className={`w-full max-w-xl rounded-2xl border-2 ${tone.border} bg-stone-900 p-6 shadow-2xl`}>
        <p className={`mb-2 flex items-center gap-2 text-sm uppercase tracking-wide ${tone.accent}`}>
          <span aria-hidden="true">{tone.icon}</span>
          {beat.tone === 'quest' ? 'Quête accomplie' : beat.tone === 'danger' ? 'Danger' : beat.tone === 'reward' ? 'Carte Récompense' : 'Récit'}
        </p>
        {beat.title && <h2 className={`mb-3 text-2xl font-semibold ${tone.accent}`}>{beat.title}</h2>}
        <p className="text-lg italic leading-relaxed text-stone-100">{beat.text}</p>
        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm text-stone-400">{more > 0 ? `${more} autre(s) à suivre` : ''}</span>
          <Button variant="primary" onClick={dismiss} autoFocus>
            Continuer
          </Button>
        </div>
      </div>
    </div>
  );
}

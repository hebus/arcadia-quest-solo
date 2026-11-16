import { Button } from '@/components/ui';

/**
 * Dés à toucher : un bouton par dé lancé sur la table, on touche ceux qui ont réussi.
 * Les dés étant interchangeables, seul le nombre compte (toucher le dé n°i remplit jusqu'à lui).
 */
export function DiceTally({ label, dice, value, onChange, glyph, onAddDie, tone }: { label: string; dice: number; value: number; onChange: (n: number) => void; glyph: string; onAddDie?: () => void; /** Petit dé dessiné : noir (dé de combat) ou blanc (dé de défense). Sans tonalité : grosse case neutre. */ tone?: 'black' | 'white' }) {
  if (dice === 0) return <p className="text-sm text-stone-400">{label} : aucun dé</p>;
  return (
    <div role="group" aria-label={label} className="space-y-1">
      <p className="text-sm text-stone-300">{label}</p>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: dice }, (_, i) => {
          const on = i < value;
          return (
            <button
              key={i}
              type="button"
              aria-pressed={on}
              aria-label={`${label}, dé ${i + 1}`}
              onClick={() => onChange(i + 1 === value ? i : i + 1)}
              className={`flex items-center justify-center border-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${
                tone
                  ? `size-11 rounded-lg text-xl shadow-inner ${tone === 'white' ? 'bg-stone-50 text-stone-900' : 'bg-stone-950 text-stone-50'} ${on ? 'border-amber-300 ring-2 ring-amber-300' : 'border-stone-500 opacity-40'}`
                  : `size-14 rounded-xl text-2xl ${on ? 'border-amber-300 bg-amber-700 text-white' : 'border-stone-600 bg-stone-800 text-stone-500'}`
              }`}
            >
              {glyph}
            </button>
          );
        })}
        {onAddDie && (
          <button
            type="button"
            aria-label={`${label} : ajouter un dé`}
            onClick={onAddDie}
            className="flex size-14 items-center justify-center rounded-xl border-2 border-dashed border-stone-500 text-lg text-stone-300 hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            + dé
          </button>
        )}
      </div>
    </div>
  );
}

/** Compteur à gros boutons ± pour un nombre sans borne connue (ex. coups après relances et effets). */
export function Stepper({ label, value, onChange, min = 0, max }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div role="group" aria-label={label} className="space-y-1">
      <p className="text-sm text-stone-300">{label}</p>
      <div className="flex items-center gap-2">
        <Button aria-label={`${label} : moins`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          −
        </Button>
        <output aria-label={`${label} : valeur`} className="min-w-12 text-center text-2xl font-bold">
          {value}
        </output>
        <Button aria-label={`${label} : plus`} disabled={max !== undefined && value >= max} onClick={() => onChange(value + 1)}>
          +
        </Button>
      </div>
    </div>
  );
}

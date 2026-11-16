import type { DieFaceDef } from '@/engine/domain/schemas';
import { FACE_LABEL, describeDie, nextFaceKind, dieFace, type FaceKind } from '@/game-data/dice';

export const GLYPH: Record<FaceKind, string> = { sword: '⚔', bow: '🏹', crit: '✸', shield: '🛡', blank: '' };

/** Une face de dé en petit : noire (dé de combat) ou blanche (dé de défense), pour comparer avec les résultats saisis. */
export function FaceTile({ symbol, color = 'black' }: { symbol: string; color?: 'black' | 'white' }) {
  const known = symbol in FACE_LABEL;
  const label = known ? FACE_LABEL[symbol as FaceKind].one : symbol;
  return (
    <span role="img" aria-label={label} data-testid="face-tile" data-face={symbol} className={`flex size-9 items-center justify-center rounded-lg border-2 text-lg shadow-inner ${color === 'white' ? 'border-stone-300 bg-stone-50 text-stone-900' : 'border-stone-500 bg-stone-950 text-stone-50'}`}>
      {known ? GLYPH[symbol as FaceKind] : '?'}
    </span>
  );
}

/**
 * Un dé dessiné : ses six faces, noires (dé de combat) ou blanches (dé de défense). Toucher une face la change en la face
 * suivante possible du dé. Dessous, le contenu du dé et la règle de réussite.
 */
export function Die({ title, color, faces, onChange, rule }: { title: string; color: 'black' | 'white'; faces: DieFaceDef[]; onChange: (faces: DieFaceDef[]) => void; rule: string }) {
  const defense = color === 'white';
  const tile = defense ? 'border-stone-300 bg-stone-50 text-stone-900 hover:bg-white' : 'border-stone-500 bg-stone-950 text-stone-50 hover:bg-black';
  return (
    <figure className="space-y-2" data-testid={`die-${color}`}>
      <figcaption className="text-lg font-medium">
        <span aria-hidden="true">{defense ? '⬜' : '⬛'} </span>
        {title}
      </figcaption>
      <div className="inline-grid grid-cols-3 gap-2 rounded-2xl border border-stone-600 bg-stone-800 p-3" role="group" aria-label={`${title} : les six faces`}>
        {faces.map((f, i) => {
          const known = f.symbol in FACE_LABEL;
          const label = known ? FACE_LABEL[f.symbol as FaceKind].one : f.symbol;
          return (
            <button
              key={i}
              type="button"
              data-testid={`${color}-face-${i + 1}`}
              data-face={f.symbol}
              aria-label={`${title}, face ${i + 1} : ${label} (toucher pour changer)`}
              onClick={() => onChange(faces.map((x, j) => (j === i ? dieFace(nextFaceKind(x.symbol, defense), defense) : x)))}
              className={`flex h-20 w-20 flex-col items-center justify-center rounded-xl border-2 text-4xl shadow-inner transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${tile}`}
            >
              <span aria-hidden="true">{known ? GLYPH[f.symbol as FaceKind] : '?'}</span>
              <span className="text-xs font-medium">{label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-sm text-stone-200" data-testid={`${color}-summary`}>{describeDie(faces, defense)}</p>
      <p className="text-sm text-stone-400">{rule}</p>
    </figure>
  );
}

import type { ActorKind } from '@/rendering/instructions/overlay';

const KIND_COLOR: Record<ActorKind, string> = { hero: '#2563eb', monster: '#b91c1c', pet: '#16a34a', mount: '#9333ea' };

/** Figurine miniature, identique aux pions du plateau : on reconnaît l'acteur sans lire de nom ni de coordonnée. */
export function MiniPawn({ kind, label, size = 44, dead = false }: { kind: ActorKind; label: string; size?: number; dead?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true" opacity={dead ? 0.4 : 1}>
      <circle cx="22" cy="22" r="18" fill={KIND_COLOR[kind]} stroke="#fff" strokeWidth="2" />
      <text x="22" y="27" fontSize="15" fontWeight="bold" textAnchor="middle" fill="#fff">
        {label}
      </text>
      {dead && <path d="M10 10 L34 34 M34 10 L10 34" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />}
    </svg>
  );
}

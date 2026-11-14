/** Icônes d'objectifs : dessinées en SVG (identiques sur tous les navigateurs), une par nature d'objectif. */
export const OBJECTIVE_ICONS = ['key', 'flame', 'skull', 'flag', 'chest', 'gem'] as const;
export type ObjectiveIconName = (typeof OBJECTIVE_ICONS)[number];

export const ICON_LABEL: Record<ObjectiveIconName, string> = {
  key: 'Clé',
  flame: 'Flamme',
  skull: 'Crâne',
  flag: 'Drapeau',
  chest: 'Coffre',
  gem: 'Gemme',
};

const DRAW: Record<ObjectiveIconName, (c: string, bg: string) => React.ReactNode> = {
  key: (c) => (
    <>
      <circle cx="8" cy="8" r="4.2" fill="none" stroke={c} strokeWidth="2.4" />
      <path d="M11.2 11.2 L20 20 M16.2 16.2 L19.4 13 M18.6 18.6 L21.6 15.6" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" />
    </>
  ),
  flame: (c) => <path d="M12 2 C12.6 6 8 8 8 13.5 a4 4 0 0 0 8 0 C16 10.5 14.2 9.5 14 6.5 C13 7.4 12.2 5 12 2 Z" fill={c} />,
  skull: (c, bg) => (
    <>
      <path d="M12 3 a8 8 0 0 0 -8 8 c0 3 1.2 4.2 3 5 v3.5 h10 V16 c1.8 -0.8 3 -2 3 -5 a8 8 0 0 0 -8 -8 Z" fill={c} />
      <circle cx="9" cy="11" r="2" fill={bg} />
      <circle cx="15" cy="11" r="2" fill={bg} />
      <path d="M10.5 17 v2.5 M13.5 17 v2.5" stroke={bg} strokeWidth="1.2" />
    </>
  ),
  flag: (c) => (
    <>
      <path d="M6 3 V21" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M6.5 4 H19 L15.5 8 L19 12 H6.5 Z" fill={c} />
    </>
  ),
  chest: (c, bg) => (
    <>
      <path d="M3.5 11 a8.5 6 0 0 1 17 0 Z" fill={c} />
      <rect x="3.5" y="11" width="17" height="9" rx="1.2" fill={c} />
      <rect x="10.5" y="11.5" width="3" height="4.2" rx="0.8" fill={bg} />
      <path d="M3.5 11 H20.5" stroke={bg} strokeWidth="1" />
    </>
  ),
  gem: (c, bg) => (
    <>
      <path d="M12 3 L20 9 L12 21 L4 9 Z" fill={c} />
      <path d="M4 9 H20 M9 9 L12 3 L15 9 L12 21 Z" fill="none" stroke={bg} strokeWidth="1" />
    </>
  ),
};

export const isObjectiveIcon = (v: unknown): v is ObjectiveIconName => OBJECTIVE_ICONS.includes(v as ObjectiveIconName);

/** Icône d'un objectif ; sans icône connue, un drapeau. */
export function ObjectiveIcon({ icon, size = 24, color = '#fbbf24', background = '#1c1917', title }: { icon?: string | undefined; size?: number; color?: string; background?: string; title?: string }) {
  const name: ObjectiveIconName = isObjectiveIcon(icon) ? icon : 'flag';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={title ?? ICON_LABEL[name]} data-icon={name}>
      {DRAW[name](color, background)}
    </svg>
  );
}

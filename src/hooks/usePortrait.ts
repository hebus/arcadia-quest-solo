import { useEffect, useState } from 'react';

const QUERY = '(orientation: portrait) and (max-width: 820px)';

const media = (): MediaQueryList | null => (typeof window === 'undefined' || !window.matchMedia ? null : window.matchMedia(QUERY));

/** Vrai sur un écran étroit en portrait (téléphone) : l'interface passe en tiroirs. Faux sans matchMedia (tests). */
export function usePortrait(): boolean {
  const [on, setOn] = useState(() => media()?.matches ?? false);
  useEffect(() => {
    const m = media();
    if (!m) return;
    const update = () => setOn(m.matches);
    update();
    m.addEventListener('change', update);
    return () => m.removeEventListener('change', update);
  }, []);
  return on;
}

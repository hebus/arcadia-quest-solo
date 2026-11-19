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

const COMPACT_LANDSCAPE = '(orientation: landscape) and (pointer: coarse) and (max-width: 1400px)';

/**
 * Interface compacte (fiche dans la rangée du plateau, tiroirs) : en portrait étroit, barre d'onglets en bas ;
 * sur tablette tactile en paysage, barre d'onglets sur le bord droit. Souris et grands écrans gardent la vue complète.
 */
export function useCompactLayout(): { compact: boolean; side: 'bottom' | 'right' } {
  const portrait = usePortrait();
  const [landscape, setLandscape] = useState(() => (typeof window === 'undefined' || !window.matchMedia ? false : window.matchMedia(COMPACT_LANDSCAPE).matches));
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const m = window.matchMedia(COMPACT_LANDSCAPE);
    const update = () => setLandscape(m.matches);
    update();
    m.addEventListener('change', update);
    return () => m.removeEventListener('change', update);
  }, []);
  return { compact: portrait || landscape, side: portrait ? 'bottom' : 'right' };
}

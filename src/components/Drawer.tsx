import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Tiroir du bas (mode portrait) : monte depuis la barre d'onglets, laisse le plateau visible au-dessus,
 * se ferme avec Échap, la croix ou un toucher sur le fond.
 */
export function Drawer({ title, onClose, children, side = 'bottom' }: { title: string; onClose: () => void; children: ReactNode; /** Bord d'où monte le tiroir : le bas (portrait) ou le côté droit, à gauche de la barre d'onglets (paysage). */ side?: 'bottom' | 'right' }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // Portail sur le body, comme la barre d'onglets : le tiroir se cale sur la fenêtre et prend toute sa largeur.
  return createPortal(
    <div className={`fixed inset-0 z-40 flex w-full bg-black/50 ${side === 'right' ? 'items-center justify-end' : 'items-end'}`} role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`flex min-w-0 flex-col border-amber-600/70 bg-stone-900 shadow-2xl shadow-black ${side === 'right' ? 'mr-[calc(5.5rem+env(safe-area-inset-right))] h-[calc(100dvh-1rem)] w-[min(30rem,65vw)] rounded-2xl border-2 pb-3' : 'max-h-[78dvh] w-full rounded-t-2xl border-x border-t-2 pb-[4.5rem]'}`}>
        <div className="flex items-center justify-between px-4 pt-3">
          <h2 className="text-lg font-semibold text-amber-300">{title}</h2>
          <button type="button" aria-label={`Fermer : ${title}`} onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-amber-600 text-lg text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400">
            ✕
          </button>
        </div>
        <div className="min-w-0 overflow-y-auto overflow-x-hidden px-4 py-3">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

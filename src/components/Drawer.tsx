import { useEffect, type ReactNode } from 'react';

/**
 * Tiroir du bas (mode portrait) : monte depuis la barre d'onglets, laisse le plateau visible au-dessus,
 * se ferme avec Échap, la croix ou un toucher sur le fond.
 */
export function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/50" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[78dvh] w-full flex-col rounded-t-2xl border-x border-t-2 border-amber-600/70 bg-stone-900 pb-[4.5rem] shadow-2xl shadow-black">
        <div className="flex items-center justify-between px-4 pt-3">
          <h2 className="text-lg font-semibold text-amber-300">{title}</h2>
          <button type="button" aria-label={`Fermer : ${title}`} onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-amber-600 text-lg text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-3">{children}</div>
      </div>
    </div>
  );
}

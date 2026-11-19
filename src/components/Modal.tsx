import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui';

const WIDTH = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl' } as const;

/**
 * Dialogue modal : fond assombri, Échap pour fermer, contenu défilant. Sert à sortir de l'écran de jeu tout ce qui
 * n'est pas indispensable à chaque geste (attaque, saisies de dés, menu).
 */
export function Modal({ title, onClose, size = 'md', children }: { title: string; onClose?: () => void; size?: keyof typeof WIDTH; children: ReactNode }) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // Portail sur le body : le dialogue passe au-dessus de la barre d'onglets et des tiroirs, même ouvert depuis l'un d'eux.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()} role="presentation">
      <div role="dialog" aria-modal="true" aria-label={title} className={`flex max-h-[88dvh] w-full ${WIDTH[size]} flex-col rounded-2xl border border-stone-600 bg-stone-900 shadow-2xl`}>
        {onClose && (
          <div className="flex justify-end px-2 pt-2">
            <Button variant="ghost" aria-label={`Fermer : ${title}`} onClick={onClose}>
              ✕
            </Button>
          </div>
        )}
        <div className="overflow-auto p-4 pt-1">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

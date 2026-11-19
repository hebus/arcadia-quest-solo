import { createPortal } from 'react-dom';

/** Barre d'onglets fixe en bas de l'écran (mode portrait) : chaque onglet ouvre un tiroir ; retoucher l'onglet ouvert le referme. */
export function TabDock<T extends string>({ label, tabs, open, onOpen }: { label: string; tabs: { id: T; label: string; icon: string }[]; open: T | null; onOpen: (t: T | null) => void }) {
  // Portail sur le body : la barre se cale sur la fenêtre, quel que soit l'ancêtre (iOS Safari gère mal les éléments fixes sous un conteneur à overflow masqué).
  return createPortal(
    <nav aria-label={label} data-testid="portrait-dock" className="fixed bottom-0 left-0 right-0 w-full z-50 grid grid-cols-4 gap-1 border-t-2 border-amber-700/70 bg-stone-950/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
      {tabs.map((t) => (
        <button key={t.id} type="button" aria-pressed={open === t.id} onClick={() => onOpen(open === t.id ? null : t.id)} className={`flex min-h-14 flex-col items-center justify-center rounded-lg border-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${open === t.id ? 'border-amber-400 bg-amber-900/60 text-amber-200' : 'border-transparent text-stone-200'}`}>
          <span className="text-xl leading-none" aria-hidden="true">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>,
    document.body,
  );
}

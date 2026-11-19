import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const variants: Record<Variant, string> = {
  primary: 'bg-amber-700 text-white hover:bg-amber-600 disabled:bg-stone-600',
  secondary: 'bg-stone-700 text-stone-100 hover:bg-stone-600 disabled:opacity-50',
  danger: 'bg-red-700 text-white hover:bg-red-600 disabled:opacity-50',
  ghost: 'bg-transparent text-stone-200 hover:bg-stone-800 disabled:opacity-50',
};

/** Zones tactiles généreuses (≥ 44 px) pour la tablette en paysage. */
export function Button({
  variant = 'secondary',
  className = '',
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...p}
      className={`min-h-11 rounded-lg px-4 py-2 text-base font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${variants[variant]} ${className}`}
    />
  );
}

export function Panel({ title, children, actions, bare = false }: { title: string; children: ReactNode; actions?: ReactNode; /** Sans cadre, fond ni marge : pour un panneau déjà logé dans un tiroir. */ bare?: boolean }) {
  return (
    <section className={bare ? '' : 'rounded-xl border border-stone-700 bg-stone-900 p-4'} aria-label={title}>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-amber-300">{title}</h2>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'bad' | 'warn' }) {
  const tones = {
    neutral: 'bg-stone-700 text-stone-100',
    good: 'bg-emerald-800 text-emerald-100',
    bad: 'bg-red-800 text-red-100',
    warn: 'bg-amber-800 text-amber-100',
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-sm ${tones[tone]}`}>{children}</span>;
}

export function ErrorBanner({ message, onClose }: { message: string | null; onClose: () => void }) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-red-600 bg-red-950 p-3 text-red-100">
      <p className="whitespace-pre-line">{message}</p>
      <Button variant="ghost" onClick={onClose} aria-label="Fermer le message d'erreur">
        ✕
      </Button>
    </div>
  );
}

export const inputClass =
  'min-h-11 w-full rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-stone-100 placeholder:text-stone-400';

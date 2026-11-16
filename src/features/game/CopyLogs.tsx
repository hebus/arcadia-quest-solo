import { useState } from 'react';
import { Button } from '@/components/ui';
import { useGameStore } from '@/stores/gameStore';
import { buildDebugReport, copyText } from './debugReport';

/**
 * Copie le rapport de débogage (journal détaillé des actions et état complet) pour l'analyser dans une conversation.
 * Disponible dans tous les scénarios (menu de la partie) comme dans le terrain d'essai.
 */
export function CopyLogs() {
  const logCount = useGameStore((s) => s.actionLog.length);
  const [copied, setCopied] = useState<string | null>(null);
  /** Texte à copier à la main quand le presse-papiers est refusé par le navigateur. */
  const [manual, setManual] = useState<string | null>(null);
  const copyLogs = async () => {
    const text = buildDebugReport();
    const ok = await copyText(text);
    setManual(ok ? null : text);
    setCopied(ok ? `Logs copiés (${Math.ceil(text.length / 1024)} Ko, ${logCount} action${logCount > 1 ? 's' : ''})` : 'Copie refusée : sélectionnez le texte ci-dessous');
  };
  return (
    <>
      <Button onClick={() => void copyLogs()} title="Copie le journal détaillé des actions et l’état complet, à coller dans la conversation pour analyser un défaut">
        📋 Copier les logs
      </Button>
      {copied && <span role="status" className="text-sm text-sky-200">{copied}</span>}
      {manual && <textarea readOnly aria-label="Logs à copier" className="h-32 w-full rounded-lg border border-stone-600 bg-stone-950 p-2 font-mono text-xs" value={manual} onFocus={(e) => e.currentTarget.select()} />}
    </>
  );
}

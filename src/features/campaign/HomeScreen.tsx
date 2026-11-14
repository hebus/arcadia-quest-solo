import { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/Modal';
import { Button, ErrorBanner, Panel } from '@/components/ui';
import { ImportError, exportBundle, parseBundle } from '@/infrastructure/export/bundle';
import { Repository } from '@/infrastructure/persistence/repository';
import { useCampaignStore } from '@/stores/campaignStore';
import { useGameStore } from '@/stores/gameStore';
import { useTileStore } from '@/stores/tileStore';

type Summary = Awaited<ReturnType<Repository['listSessions']>>[number];

export function HomeScreen({ go }: { go: (s: 'scenarios' | 'setup' | 'game' | 'settings' | 'guide' | 'tiles') => void }) {
  const [sessions, setSessions] = useState<Summary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const loadGame = useGameStore((s) => s.loadGame);
  const game = useGameStore((s) => s.game);
  const camp = useCampaignStore((s) => s.campaign);
  const setCamp = useCampaignStore((s) => s.set);
  const repo = useRef<Repository | null>(null);
  const resetGame = useGameStore((s) => s.reset);
  const [confirmClear, setConfirmClear] = useState(false);
  const [alsoTiles, setAlsoTiles] = useState(false);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    Promise.resolve()
      .then(() => {
        repo.current = new Repository();
        return repo.current.listSessions();
      })
      .then(setSessions)
      .catch(() => setSessions([]));
  }, [game]);

  const resume = async (id: string) => {
    const st = await repo.current?.loadSession(id);
    if (st) {
      loadGame(st);
      go('game');
    }
  };

  /** Efface tout ce qui est sauvegardé sur l'appareil, puis remet l'application à zéro (mémoire comprise). */
  const doClear = async () => {
    try {
      await (repo.current ?? new Repository()).clearAll({ tiles: alsoTiles });
      resetGame();
      setCamp(null);
      if (alsoTiles) useTileStore.setState({ tiles: [], loaded: true });
      setSessions([]);
      setCleared(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setConfirmClear(false);
    setAlsoTiles(false);
  };

  const doExport = () => {
    const json = exportBundle(camp, game ? [game] : []);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `arcadia-quest-solo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (f: File) => {
    try {
      const text = await f.text();
      // Sauvegarde de secours de l'existant avant toute écriture (plan §9.4).
      if (repo.current) await repo.current.backup('avant import', exportBundle(camp, game ? [game] : []));
      const b = parseBundle(text);
      if (b.campaign) {
        setCamp(b.campaign);
        await repo.current?.saveCampaign(b.campaign);
      }
      for (const s of b.sessions) await repo.current?.saveSession(s, b.campaign?.id ?? null);
      setSessions((await repo.current?.listSessions()) ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof ImportError || e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-3">
      <ErrorBanner message={error} onClose={() => setError(null)} />
      <Panel title="Accueil">
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" onClick={() => go('scenarios')}>Jouer un scénario</Button>
          <Button onClick={() => go('setup')}>Nouvelle partie (mise en place libre)</Button>
          {game && <Button onClick={() => go('game')}>Reprendre la partie en cours</Button>}
          <Button onClick={() => go('tiles')}>Bibliothèque de tuiles</Button>
          <Button onClick={() => go('settings')}>Paramètres</Button>
          <Button onClick={() => go('guide')}>Guide et règles</Button>
          <Button onClick={doExport}>Exporter (JSON)</Button>
          <Button onClick={() => file.current?.click()}>Importer (JSON)</Button>
          <Button variant="danger" onClick={() => { setCleared(false); setConfirmClear(true); }}>Effacer toutes les sauvegardes…</Button>
          <input ref={file} type="file" accept="application/json" hidden aria-label="Fichier à importer" onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = ''; }} />
        </div>
        {camp && <p className="mt-3 text-stone-300">Campagne : {camp.name} — {camp.results.length}/6 scénarios joués.</p>}
      </Panel>
      <Panel title="Parties sauvegardées">
        {sessions.length === 0 ? (
          <p className="text-stone-400">Aucune partie sauvegardée sur cet appareil.</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.sessionId} className="flex items-center justify-between gap-2 rounded-lg bg-stone-800 p-2">
                <span>
                  {s.scenarioId} · manche {s.round} · {s.phase} · {new Date(s.updatedAt).toLocaleString('fr-FR')}
                </span>
                <Button onClick={() => void resume(s.sessionId)}>Reprendre</Button>
              </li>
            ))}
          </ul>
        )}
        {cleared && <p role="status" className="mt-2 text-emerald-300">Toutes les sauvegardes ont été effacées.</p>}
        <p className="mt-2 text-sm text-stone-400">Les données restent sur cet appareil ; rien n&apos;est envoyé à un serveur.</p>
      </Panel>
      {confirmClear && (
        <Modal title="Effacer les sauvegardes" size="sm" onClose={() => setConfirmClear(false)}>
          <div className="space-y-3">
            <p>
              Toutes les parties, campagnes et sauvegardes de secours enregistrées sur cet appareil seront <strong>définitivement effacées</strong>, ainsi que vos préférences enregistrées dans la base. Cette action est irréversible.
            </p>
            <p className="text-sm text-stone-300">Pour en garder une copie, exportez d&apos;abord au format JSON.</p>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={alsoTiles} onChange={(e) => setAlsoTiles(e.target.checked)} />
              Effacer aussi la bibliothèque de tuiles importées
            </label>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setConfirmClear(false)}>Annuler</Button>
              <Button variant="danger" onClick={() => void doClear()}>
                Tout effacer
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

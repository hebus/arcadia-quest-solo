import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { chapterProgress, isRunComplete, runInProgress, totalGold } from '@/engine/campaignRun';
import type { ScenarioDefinition } from '@/engine/scenario/definition';
import { CHAPTER_IDS, MEDIUM_IDS, randomChapterIds, useCampaignRunStore } from '@/stores/campaignRunStore';
import { ChapterList } from './CampaignCard';

/**
 * Campagne aléatoire : trois scénarios tirés au hasard (terrain et monstres de plus en plus durs, histoire enchaînée). Elle se
 * présente comme la campagne écrite à la main ; une seule campagne est active à la fois, abandonner l'une pour l'autre demande
 * confirmation quand elle est en cours.
 */
export function RandomCampaignCard({ onPlay }: { onPlay: (scenario: ScenarioDefinition) => void }) {
  const random = useCampaignRunStore((s) => s.random);
  const run = useCampaignRunStore((s) => s.run);
  const loaded = useCampaignRunStore((s) => s.loaded);
  const load = useCampaignRunStore((s) => s.load);
  const drawRandom = useCampaignRunStore((s) => s.drawRandom);
  const redrawRandom = useCampaignRunStore((s) => s.redrawRandom);
  const resetRandom = useCampaignRunStore((s) => s.resetRandom);
  const [confirm, setConfirm] = useState<'replace-hand' | 'new-draw' | 'abandon' | null>(null);
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const ids = randomChapterIds(random);
  const medium = useCampaignRunStore((s) => s.medium);
  const handRunning = runInProgress(run, CHAPTER_IDS);
  const handInProgress = handRunning || runInProgress(medium, MEDIUM_IDS);
  const randomInProgress = !!random && runInProgress(random.run, ids);
  const played = !!random && random.run.attempts.length > 0;
  const progress = chapterProgress(random?.run ?? null, ids);
  const complete = isRunComplete(random?.run ?? null, ids);

  const draw = () => {
    drawRandom();
    setConfirm(null);
  };
  const confirmBar = (message: string, label: string, action: () => void) => (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-amber-300">{message}</span>
      <Button variant="danger" onClick={action}>
        {label}
      </Button>
      <Button variant="ghost" onClick={() => setConfirm(null)}>
        Annuler
      </Button>
    </span>
  );

  return (
    <section aria-label="Campagne aléatoire" data-testid="random-campaign" className="mb-3 rounded-xl border border-amber-700 bg-stone-800 p-4">
      <h3 className="text-xl font-semibold text-amber-300">
        <span aria-hidden="true">🎲 </span>
        {random ? random.campaign.title : 'Campagne aléatoire'} <span className="text-base font-normal text-stone-300">· 3 scénarios tirés au hasard</span>
      </h3>
      {!random ? (
        <div className="mt-2">
          <p className="mb-2 text-sm text-stone-400">Trois chapitres inédits, de plus en plus durs : le terrain grandit, les monstres montent de niveau, l’histoire s’enchaîne jusqu’à l’ultime affrontement.</p>
          {confirm === 'replace-hand' ? (
            confirmBar(handRunning ? 'La campagne « La Chute des Braises » en cours sera abandonnée.' : 'La campagne « Le Siège de Val-Noir » en cours sera abandonnée.', 'Confirmer : abandonner la campagne en cours', draw)
          ) : (
            <Button variant="primary" onClick={() => (handInProgress ? setConfirm('replace-hand') : draw())}>
              Tirer une campagne aléatoire
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className="mt-1 text-stone-300">{random.campaign.tagline}</p>
          <p className="mt-2" data-testid="random-campaign-gold">
            PO de la guilde : <strong className="text-amber-300">{totalGold(random.run)}</strong> <span aria-hidden="true">🪙</span>
          </p>
          <ChapterList
            chapters={progress.map((c) => {
              const chapter = random.campaign.chapters[c.chapter]!;
              return { ...c, title: chapter.scenario.title, bridge: chapter.bridge, scenario: chapter.scenario };
            })}
            onPlay={onPlay}
          />
          {complete && (
            <p role="status" className="mt-2 text-lg font-semibold text-emerald-300">
              Campagne terminée : la guilde a vaincu le dernier chef, avec {totalGold(random.run)} PO au total.
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!played && (
              <Button variant="secondary" onClick={redrawRandom}>
                ↻ Autre tirage
              </Button>
            )}
            {confirm === 'new-draw'
              ? confirmBar('La progression et les PO cumulés seront effacés.', 'Confirmer : tirer une nouvelle campagne', draw)
              : confirm === 'abandon'
                ? confirmBar('La campagne aléatoire et ses PO seront abandonnées.', 'Confirmer : abandonner', () => {
                    resetRandom();
                    setConfirm(null);
                  })
                : played && (
                    <>
                      <Button variant="ghost" onClick={() => (randomInProgress ? setConfirm('new-draw') : draw())}>
                        Tirer une nouvelle campagne
                      </Button>
                      <Button variant="ghost" onClick={() => (randomInProgress ? setConfirm('abandon') : resetRandom())}>
                        Abandonner la campagne aléatoire
                      </Button>
                    </>
                  )}
          </div>
        </>
      )}
    </section>
  );
}

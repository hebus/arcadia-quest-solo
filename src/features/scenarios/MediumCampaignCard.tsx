import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { chapterProgress, isRunComplete, runInProgress, totalGold } from '@/engine/campaignRun';
import type { ScenarioDefinition } from '@/engine/scenario/definition';
import { scenarioById } from '@/game-data/original';
import { CHAPTER_IDS, MEDIUM_CAMPAIGN, MEDIUM_IDS, randomChapterIds, useCampaignRunStore } from '@/stores/campaignRunStore';
import { ChapterList } from './CampaignCard';

/**
 * La campagne moyenne écrite à la main (5 chapitres, entre la petite campagne à 3 et la grande à 6 du livret) : elle se présente comme
 * les autres campagnes et réutilise leur progression (chapitres déverrouillés dans l'ordre, PO cumulés). Une seule campagne est active
 * à la fois ; en abandonner une en cours pour celle-ci demande confirmation.
 */
export function MediumCampaignCard({ onPlay }: { onPlay: (scenario: ScenarioDefinition) => void }) {
  const medium = useCampaignRunStore((s) => s.medium);
  const hand = useCampaignRunStore((s) => s.run);
  const random = useCampaignRunStore((s) => s.random);
  const loaded = useCampaignRunStore((s) => s.loaded);
  const load = useCampaignRunStore((s) => s.load);
  const startMedium = useCampaignRunStore((s) => s.startMedium);
  const resetMedium = useCampaignRunStore((s) => s.resetMedium);
  const [confirm, setConfirm] = useState<'start' | 'reset' | null>(null);
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const otherInProgress = runInProgress(hand, CHAPTER_IDS) || (!!random && runInProgress(random.run, randomChapterIds(random)));
  const progress = chapterProgress(medium, MEDIUM_IDS);
  const complete = isRunComplete(medium, MEDIUM_IDS);
  const confirmBar = (message: string, label: string, action: () => void) => (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-amber-300">{message}</span>
      <Button variant="danger" onClick={() => { action(); setConfirm(null); }}>
        {label}
      </Button>
      <Button variant="ghost" onClick={() => setConfirm(null)}>
        Annuler
      </Button>
    </span>
  );

  return (
    <section aria-label="Campagne moyenne" data-testid="medium-campaign" className="mb-3 rounded-xl border border-amber-700 bg-stone-800 p-4">
      <h3 className="text-xl font-semibold text-amber-300">
        <span aria-hidden="true">🏰 </span>
        {MEDIUM_CAMPAIGN.title} <span className="text-base font-normal text-stone-300">· campagne moyenne en {MEDIUM_IDS.length} chapitres</span>
      </h3>
      <p className="mt-1 text-stone-300">{MEDIUM_CAMPAIGN.tagline}</p>

      {!medium ? (
        <div className="mt-3">
          <p className="mb-2 text-sm text-stone-400">Cinq chapitres écrits à la main, de plus en plus durs : les monstres montent de niveau (1, 2-3, 4-5, puis 6) et les plateaux grandissent. Les PO gagnés se cumulent d’un chapitre à l’autre.</p>
          {confirm === 'start' ? (
            confirmBar('La campagne en cours sera abandonnée.', 'Confirmer : abandonner la campagne en cours', startMedium)
          ) : (
            <Button variant="primary" onClick={() => (otherInProgress ? setConfirm('start') : startMedium())}>
              Commencer la campagne moyenne
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className="mt-2" data-testid="medium-campaign-gold">
            PO de la guilde : <strong className="text-amber-300">{totalGold(medium)}</strong> <span aria-hidden="true">🪙</span>
          </p>
          <ChapterList
            chapters={progress.map((c) => ({ ...c, title: scenarioById(c.scenarioId)?.title ?? c.scenarioId, bridge: MEDIUM_CAMPAIGN.chapters[c.chapter]!.bridge, scenario: scenarioById(c.scenarioId) }))}
            onPlay={onPlay}
          />
          {complete && (
            <p role="status" className="mt-2 text-lg font-semibold text-emerald-300">
              Campagne terminée : la guilde a levé le siège de Val-Noir, avec {totalGold(medium)} PO au total.
            </p>
          )}
          <div className="mt-3">
            {confirm === 'reset' ? (
              confirmBar('La progression et les PO cumulés seront effacés.', 'Confirmer : tout recommencer', () => { resetMedium(); startMedium(); })
            ) : (
              <Button variant="ghost" onClick={() => setConfirm('reset')}>
                Recommencer la campagne moyenne
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

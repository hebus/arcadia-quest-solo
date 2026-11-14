import { useEffect, useState } from 'react';
import { Badge, Button } from '@/components/ui';
import { chapterProgress, isRunComplete, totalGold, type ChapterState } from '@/engine/campaignRun';
import type { ScenarioDefinition } from '@/engine/scenario/definition';
import { scenarioById } from '@/game-data/original';
import { CAMPAIGN, CHAPTER_IDS, useCampaignRunStore } from '@/stores/campaignRunStore';

const LABEL: Record<ChapterState, { text: string; tone: 'good' | 'warn' | 'bad' | 'neutral' }> = {
  locked: { text: 'verrouillé', tone: 'neutral' },
  todo: { text: 'à jouer', tone: 'warn' },
  retry: { text: 'à rejouer (défaite)', tone: 'bad' },
  won: { text: 'terminé', tone: 'good' },
};

/**
 * La petite campagne en tête du choix des scénarios : ses chapitres dans l'ordre, leur état, les PO gagnés par la guilde. Le
 * chapitre suivant se déverrouille quand le précédent est gagné ; la progression est gardée sur l'appareil.
 */
export function CampaignCard({ onPlay }: { onPlay: (scenario: ScenarioDefinition) => void }) {
  const run = useCampaignRunStore((s) => s.run);
  const loaded = useCampaignRunStore((s) => s.loaded);
  const load = useCampaignRunStore((s) => s.load);
  const start = useCampaignRunStore((s) => s.start);
  const reset = useCampaignRunStore((s) => s.reset);
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const progress = chapterProgress(run, CHAPTER_IDS);
  const complete = isRunComplete(run, CHAPTER_IDS);
  return (
    <section aria-label="Campagne" data-testid="campaign" className="mb-3 rounded-xl border border-amber-700 bg-stone-800 p-4">
      <h3 className="text-xl font-semibold text-amber-300">
        <span aria-hidden="true">📜 </span>
        {CAMPAIGN.title} <span className="text-base font-normal text-stone-300">· petite campagne en {CHAPTER_IDS.length} chapitres</span>
      </h3>
      <p className="mt-1 text-stone-300">{CAMPAIGN.tagline}</p>

      {!run ? (
        <div className="mt-3">
          <p className="mb-2 text-sm text-stone-400">Les chapitres se jouent dans l’ordre avec votre guilde ; les pièces d’or (PO) gagnées se cumulent d’un chapitre à l’autre.</p>
          <Button variant="primary" onClick={start}>
            Commencer la campagne
          </Button>
        </div>
      ) : (
        <>
          <p className="mt-2" data-testid="campaign-gold">
            PO de la guilde : <strong className="text-amber-300">{totalGold(run)}</strong> <span aria-hidden="true">🪙</span>
          </p>
          <ol className="mt-2 space-y-2">
            {progress.map((c) => {
              const scenario = scenarioById(c.scenarioId);
              const bridge = CAMPAIGN.chapters[c.chapter]!.bridge;
              const title = scenario?.title ?? c.scenarioId;
              return (
                <li key={c.scenarioId} data-testid={`chapter-${c.chapter + 1}`} data-state={c.state} className={`flex flex-wrap items-center gap-3 rounded-lg bg-stone-900 p-2 ${c.state === 'locked' ? 'opacity-60' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      Chapitre {c.chapter + 1} · {title} <Badge tone={LABEL[c.state].tone}>{LABEL[c.state].text}</Badge>
                    </p>
                    {c.state !== 'locked' && <p className="text-sm text-stone-400">{bridge}</p>}
                    {c.state === 'won' && <p className="text-sm text-emerald-300">+{c.coinsWon} PO</p>}
                  </div>
                  {(c.state === 'todo' || c.state === 'retry') && scenario && (
                    <Button variant="primary" aria-label={`${c.state === 'retry' ? 'Rejouer' : 'Jouer'} le chapitre ${c.chapter + 1} : ${title}`} onClick={() => onPlay(scenario)}>
                      {c.state === 'retry' ? 'Rejouer' : 'Jouer'} le chapitre {c.chapter + 1}
                    </Button>
                  )}
                  {c.state === 'locked' && (
                    <Button disabled aria-label={`Chapitre ${c.chapter + 1} verrouillé : gagnez le chapitre précédent`}>
                      Verrouillé
                    </Button>
                  )}
                </li>
              );
            })}
          </ol>
          {complete && (
            <p role="status" className="mt-2 text-lg font-semibold text-emerald-300">
              Campagne terminée : la guilde a repris Port-Cendre, avec {totalGold(run)} PO au total.
            </p>
          )}
          <div className="mt-3">
            {!confirmReset ? (
              <Button variant="ghost" onClick={() => setConfirmReset(true)}>
                Recommencer la campagne
              </Button>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-amber-300">La progression et les PO cumulés seront effacés.</span>
                <Button
                  variant="danger"
                  onClick={() => {
                    reset();
                    start();
                    setConfirmReset(false);
                  }}
                >
                  Confirmer : tout recommencer
                </Button>
                <Button variant="ghost" onClick={() => setConfirmReset(false)}>
                  Annuler
                </Button>
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}

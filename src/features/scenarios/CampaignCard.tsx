import { useEffect, useState } from 'react';
import { Badge, Button } from '@/components/ui';
import { chapterProgress, isRunComplete, runInProgress, totalGold, type ChapterProgress, type ChapterState } from '@/engine/campaignRun';
import type { ScenarioDefinition } from '@/engine/scenario/definition';
import { scenarioById } from '@/game-data/original';
import { CAMPAIGN, CHAPTER_IDS, MEDIUM_IDS, randomChapterIds, useCampaignRunStore } from '@/stores/campaignRunStore';

export const LABEL: Record<ChapterState, { text: string; tone: 'good' | 'warn' | 'bad' | 'neutral' }> = {
  locked: { text: 'verrouillé', tone: 'neutral' },
  todo: { text: 'à jouer', tone: 'warn' },
  retry: { text: 'à rejouer (défaite)', tone: 'bad' },
  won: { text: 'terminé', tone: 'good' },
};

export type ChapterRow = ChapterProgress & { title: string; bridge: string; scenario: ScenarioDefinition | undefined };

/** Les chapitres d'une campagne (écrite à la main ou aléatoire) : état, résumé, PO gagnés, bouton pour jouer. */
export function ChapterList({ chapters, onPlay }: { chapters: ChapterRow[]; onPlay: (scenario: ScenarioDefinition) => void }) {
  return (
    <ol className="mt-2 space-y-2">
      {chapters.map((c) => (
        <li key={c.scenarioId} data-testid={`chapter-${c.chapter + 1}`} data-state={c.state} className={`flex flex-wrap items-center gap-3 rounded-lg bg-stone-900 p-2 ${c.state === 'locked' ? 'opacity-60' : ''}`}>
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              Chapitre {c.chapter + 1} · {c.title} <Badge tone={LABEL[c.state].tone}>{LABEL[c.state].text}</Badge>
            </p>
            {c.state !== 'locked' && <p className="text-sm text-stone-400">{c.bridge}</p>}
            {c.state === 'won' && <p className="text-sm text-emerald-300">+{c.coinsWon} PO</p>}
          </div>
          {(c.state === 'todo' || c.state === 'retry') && c.scenario && (
            <Button variant="primary" aria-label={`${c.state === 'retry' ? 'Rejouer' : 'Jouer'} le chapitre ${c.chapter + 1} : ${c.title}`} onClick={() => onPlay(c.scenario!)}>
              {c.state === 'retry' ? 'Rejouer' : 'Jouer'} le chapitre {c.chapter + 1}
            </Button>
          )}
          {c.state === 'locked' && (
            <Button disabled aria-label={`Chapitre ${c.chapter + 1} verrouillé : gagnez le chapitre précédent`}>
              Verrouillé
            </Button>
          )}
        </li>
      ))}
    </ol>
  );
}

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
  const random = useCampaignRunStore((s) => s.random);
  const medium = useCampaignRunStore((s) => s.medium);
  const [confirmStart, setConfirmStart] = useState(false);
  const randomInProgress = !!random && runInProgress(random.run, randomChapterIds(random));
  const otherInProgress = randomInProgress || runInProgress(medium, MEDIUM_IDS);
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
          {!confirmStart ? (
            <Button variant="primary" onClick={() => (otherInProgress ? setConfirmStart(true) : start())}>
              Commencer la campagne
            </Button>
          ) : (
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-amber-300">{randomInProgress ? 'La campagne aléatoire en cours sera abandonnée.' : 'La campagne moyenne en cours sera abandonnée.'}</span>
              <Button variant="danger" onClick={() => { start(); setConfirmStart(false); }}>
                {randomInProgress ? 'Confirmer : abandonner la campagne aléatoire' : 'Confirmer : abandonner la campagne moyenne'}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmStart(false)}>
                Annuler
              </Button>
            </span>
          )}
        </div>
      ) : (
        <>
          <p className="mt-2" data-testid="campaign-gold">
            PO de la guilde : <strong className="text-amber-300">{totalGold(run)}</strong> <span aria-hidden="true">🪙</span>
          </p>
          <ChapterList
            chapters={progress.map((c) => ({ ...c, title: scenarioById(c.scenarioId)?.title ?? c.scenarioId, bridge: CAMPAIGN.chapters[c.chapter]!.bridge, scenario: scenarioById(c.scenarioId) }))}
            onPlay={onPlay}
          />
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

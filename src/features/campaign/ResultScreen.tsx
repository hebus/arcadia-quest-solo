import { useEffect, useState } from 'react';
import { Badge, Button, ErrorBanner, Panel, inputClass } from '@/components/ui';
import { monsterCardSetFor, nextRank, upgradeRevealCount } from '@/engine/campaign';
import { defeatThreshold, questsDone } from '@/engine/state';
import { ORIGINAL_REWARDS, scenarioOfGame } from '@/game-data/original';
import { useCampaignStore } from '@/stores/campaignStore';
import { activeCampaignFor, useCampaignRunStore } from '@/stores/campaignRunStore';
import { chapterProgress, isRunComplete, runRewards, totalGold } from '@/engine/campaignRun';
import { rewardById } from '@/engine/rewards';
import { useGameStore } from '@/stores/gameStore';

/** Fin de scénario (plan §4.3 H) puis phase d'amélioration solo (livret solo v1.3 p.7). */
export function ResultScreen({ onLeave, onCampaign }: { onLeave: () => void; onCampaign?: () => void }) {
  const g = useGameStore((s) => s.game)!;
  const camp = useCampaignStore();
  const won = g.phase === 'SCENARIO_WON';
  const [purchases, setPurchases] = useState<{ card: string; cost: number }[]>([]);
  const [discard, setDiscard] = useState('');
  const coinsWon = g.coins + questsDone(g);
  const story = scenarioOfGame(g)?.story;
  const recorded = camp.campaign?.results.some((r) => r.scenarioId === g.scenarioId);
  // Petite campagne : le résultat du chapitre est enregistré dès l'écran de résultat (une partie ne compte qu'une fois).
  const handRun = useCampaignRunStore((s) => s.run);
  const randomRun = useCampaignRunStore((s) => s.random);
  const mediumRun = useCampaignRunStore((s) => s.medium);
  const active = activeCampaignFor({ run: handRun, random: randomRun, medium: mediumRun }, g.scenarioId);
  const recordChapter = useCampaignRunStore((s) => s.record);
  useEffect(() => {
    recordChapter(g);
  }, [g, recordChapter]);
  const run = active?.run ?? null;
  const chapterIds = active?.chapterIds ?? [];
  const chapter = chapterIds.indexOf(g.scenarioId);
  const progress = chapterProgress(run, chapterIds);

  return (
    <div className="space-y-3">
      <ErrorBanner message={camp.error} onClose={() => camp.set(camp.campaign)} />
      <Panel title={won ? 'Victoire !' : 'Défaite'}>
        {story && (
          <div className="mb-3 space-y-2" data-testid="outro">
            {(won ? story.win : story.lose).map((p, i) => (
              <p key={i} className="text-lg italic leading-relaxed text-amber-100">
                {p}
              </p>
            ))}
          </div>
        )}
        <ul className="space-y-1">
          <li>Morts de héros : {g.deaths} (seuil {defeatThreshold(g)})</li>
          <li>Quêtes accomplies : {questsDone(g)} / {g.questsRequired}</li>
          <li>Pièces : {g.coins} (monstres) + {questsDone(g)} (quêtes) = {coinsWon}</li>
          <li>
            Jetons Death : {g.heroes.map((h) => `${h.name} ${h.deaths}`).join(', ')} <Badge>Death Curses à tirer normalement</Badge>
          </li>
          <li>Cartes à révéler à la phase d&apos;amélioration : {upgradeRevealCount(won, coinsWon)}</li>
          {(g.rewards ?? []).length > 0 && (
            <li data-testid="rewards-won">
              Cartes Récompense gagnées :
              <ul className="ml-4 list-disc">
                {(g.rewards ?? []).map((r, i) => {
                  const card = rewardById(ORIGINAL_REWARDS, r.cardId);
                  return (
                    <li key={i}>
                      <strong>{card?.name ?? r.cardId}</strong> ({r.cardId}){card ? ` : ${card.effect}` : ''}
                    </li>
                  );
                })}
              </ul>
            </li>
          )}
        </ul>
      </Panel>
      {active && run && chapter >= 0 && (
        <Panel title={`${active.title} · chapitre ${chapter + 1} sur ${chapterIds.length}`}>
          <p data-testid="chapter-result">
            {won ? 'Chapitre gagné.' : 'Chapitre perdu : la campagne continue, vous pouvez le rejouer.'} PO de la guilde : <strong>{totalGold(run)}</strong> <span aria-hidden="true">🪙</span>
          </p>
          {won && progress[chapter + 1] && progress[chapter + 1]!.state !== 'locked' && <p className="text-sm text-stone-300" data-testid="chapter-unlocked">Chapitre {chapter + 2} débloqué.</p>}
          {runRewards(run).length > 0 && (
            <p className="text-sm text-stone-300" data-testid="run-rewards">
              Récompenses de la campagne : {runRewards(run).map((id) => rewardById(ORIGINAL_REWARDS, id)?.name ?? id).join(', ')}.
            </p>
          )}
          {isRunComplete(run, chapterIds) && <p role="status" className="text-emerald-300">Campagne terminée !</p>}
          {onCampaign && (
            <Button className="mt-2" variant="primary" onClick={onCampaign}>
              Retour à la campagne
            </Button>
          )}
        </Panel>
      )}
      {!camp.campaign && (
        <Panel title="Campagne">
          <p className="mb-2">Aucune campagne liée : le scénario est joué en mode isolé.</p>
          <Button variant="primary" onClick={() => camp.create(`Campagne ${new Date().toLocaleDateString('fr-FR')}`, g.heroes.map((h) => h.id))}>
            Créer une campagne avec ces héros
          </Button>
        </Panel>
      )}
      {camp.campaign && !camp.campaign.pendingUpgrade && !recorded && (
        <Button variant="primary" onClick={() => camp.finish(g)}>
          Enregistrer le résultat dans la campagne
        </Button>
      )}
      {camp.campaign?.pendingUpgrade && (
        <Panel title={`Phase d'amélioration : ${camp.campaign.pendingUpgrade.revealCount} cartes révélées`}>
          <p className="mb-2 text-sm text-stone-400">
            Achetez jusqu&apos;à 3 cartes avec vos {camp.campaign.pendingUpgrade.coinsWon + camp.campaign.savedCoin} pièce(s) ; 1 pièce peut être économisée.
          </p>
          {purchases.map((p, i) => (
            <div key={i} className="mb-2 flex gap-2">
              <input aria-label="Carte achetée" className={inputClass} placeholder="Nom de la carte" value={p.card} onChange={(e) => setPurchases(purchases.map((x, j) => (j === i ? { ...x, card: e.target.value } : x)))} />
              <input aria-label="Coût" className={`${inputClass} w-24`} type="number" min={0} value={p.cost} onChange={(e) => setPurchases(purchases.map((x, j) => (j === i ? { ...x, cost: Number(e.target.value) } : x)))} />
            </div>
          ))}
          <div className="mb-2 flex flex-wrap gap-2">
            <Button disabled={purchases.length >= 3} onClick={() => setPurchases([...purchases, { card: '', cost: 0 }])}>+ Achat</Button>
          </div>
          <label className="block">Cartes à défausser (si plus de 12), séparées par des virgules<input className={inputClass} value={discard} onChange={(e) => setDiscard(e.target.value)} /></label>
          <div className="mt-3">
            <Button variant="primary" onClick={() => camp.upgrade(purchases.filter((p) => p.card), discard.split(',').map((x) => x.trim()).filter(Boolean))}>
              Terminer la phase d&apos;amélioration
            </Button>
          </div>
        </Panel>
      )}
      {camp.campaign && !camp.campaign.pendingUpgrade && (
        <Panel title="Scénario suivant">
          <p>
            Scénario n°{nextRank(camp.campaign)}
            {(() => {
              try { return ` : jeu de cartes Monster « ${monsterCardSetFor(camp.campaign)} »`; } catch { return ' : renseignez le jeu de cartes Monster dans la mise en place'; }
            })()}
            .
          </p>
        </Panel>
      )}
      <Button onClick={onLeave}>Retour à l&apos;accueil</Button>
    </div>
  );
}

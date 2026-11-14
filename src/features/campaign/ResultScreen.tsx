import { useState } from 'react';
import { Badge, Button, ErrorBanner, Panel, inputClass } from '@/components/ui';
import { monsterCardSetFor, nextRank, upgradeRevealCount } from '@/engine/campaign';
import { defeatThreshold, questsDone } from '@/engine/state';
import { scenarioById } from '@/game-data/original';
import { useCampaignStore } from '@/stores/campaignStore';
import { useGameStore } from '@/stores/gameStore';

/** Fin de scénario (plan §4.3 H) puis phase d'amélioration solo (livret solo v1.3 p.7). */
export function ResultScreen({ onLeave }: { onLeave: () => void }) {
  const g = useGameStore((s) => s.game)!;
  const camp = useCampaignStore();
  const won = g.phase === 'SCENARIO_WON';
  const [purchases, setPurchases] = useState<{ card: string; cost: number }[]>([]);
  const [discard, setDiscard] = useState('');
  const coinsWon = g.coins + questsDone(g);
  const story = scenarioById(g.scenarioId)?.story;
  const recorded = camp.campaign?.results.some((r) => r.scenarioId === g.scenarioId);

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
        </ul>
      </Panel>
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

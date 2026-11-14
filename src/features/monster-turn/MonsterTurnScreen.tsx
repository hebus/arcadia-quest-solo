import { useState } from 'react';
import { Button, Panel } from '@/components/ui';
import { DiceTally } from '@/components/Tally';
import type { InputRequest } from '@/engine/oracle';
import { useGameStore } from '@/stores/gameStore';

/** Saisie du résultat physique demandé par l'agent (mode matériel) ; l'agent reprend ensuite seul. */
export function InputPrompt({ request }: { request: InputRequest }) {
  const provide = useGameStore((s) => s.provideAnswer);
  const content = useGameStore((s) => s.content);
  const [hits, setHits] = useState(0);
  const [saves, setSaves] = useState(0);
  const [parried, setParried] = useState(0);
  return (
    <div role="group" aria-label="Saisie requise" className="rounded-lg border border-amber-500 bg-amber-950 p-3">
      <p className="mb-2 font-medium">{request.purpose}</p>
      {request.kind === 'die' && (
        <div className="flex flex-wrap gap-2">
          {request.faces.map((f) => (
            <Button key={f} onClick={() => provide({ kind: 'die', value: f })}>
              {f}
            </Button>
          ))}
        </div>
      )}
      {request.kind === 'card' && (
        <div className="flex flex-wrap gap-2">
          {Object.values(content.monsters).map((m) => (
            <Button key={m.id} onClick={() => provide({ kind: 'card', value: m.id })}>
              {m.name}
            </Button>
          ))}
          <Button onClick={() => provide({ kind: 'card', value: 'wild-pet' })}>Wild Pet</Button>
        </div>
      )}
      {request.kind === 'choice' && (
        <div className="flex flex-wrap gap-2">
          {request.options.map((o) => (
            <Button key={o} onClick={() => provide({ kind: 'choice', value: o })}>
              {o}
            </Button>
          ))}
        </div>
      )}
      {request.kind === 'defense-result' && (
        <div className="space-y-3">
          <p className="text-lg">
            Le monstre touche <strong>{request.targetName}</strong> {request.hits} fois. Lancez vos {request.defenseDice} dé{request.defenseDice > 1 ? 's' : ''} de défense : chaque bouclier obtenu annule une touche.
          </p>
          <p className="text-sm text-stone-400">Un critique ou une relance peut vous donner plus de boucliers que de dés : touchez-en autant que vous en avez obtenu, au plus une par touche.</p>
          <div aria-label="Touches du monstre" role="img" className="flex flex-wrap gap-1 text-3xl">
            {Array.from({ length: request.hits }, (_, i) => (
              <span key={i} data-testid="monster-hit" data-cancelled={i < parried} className={i < parried ? 'text-stone-500 line-through opacity-40' : 'text-red-400'}>
                ⚔
              </span>
            ))}
          </div>
          <DiceTally label="Boucliers" dice={request.hits} value={parried} onChange={setParried} glyph="🛡" />
          <div className="flex items-center justify-between gap-4">
            <span className="text-lg" aria-live="polite">
              {Math.max(0, request.hits - parried) === 0 ? '✔ Aucune blessure' : `${'🩸'.repeat(Math.min(8, request.hits - parried))} ${request.hits - parried} blessure${request.hits - parried > 1 ? 's' : ''}`}
            </span>
            <Button variant="primary" onClick={() => provide({ kind: 'defense-result', saves: parried })}>
              Valider
            </Button>
          </div>
        </div>
      )}
      {request.kind === 'attack-result' && (
        <div className="space-y-3">
          <DiceTally label="Coups" dice={request.attackDice} value={hits} onChange={setHits} glyph="⚔" />
          <DiceTally label="Sauvegardes" dice={Math.max(hits, 0)} value={Math.min(saves, hits)} onChange={setSaves} glyph="🛡" />
          <Button variant="primary" onClick={() => provide({ kind: 'attack-result', hits, saves: Math.min(saves, hits) })}>
            Valider
          </Button>
        </div>
      )}
    </div>
  );
}

/** Décisions de l'agent : suivi et explications, jamais assistant de décision (plan §4.3 F). */
export function DecisionsPanel() {
  const traces = useGameStore((s) => s.traces);
  if (traces.length === 0) return <p className="text-stone-400">Aucune décision pour l&apos;instant : lancez le Monster Turn.</p>;
  return (
    <Panel title="Décisions de l'agent">
      <ul className="space-y-2">
        {traces.map((t) => (
          <li key={t.decisionId}>
            <details className="rounded-lg bg-stone-800 p-2">
              <summary className="cursor-pointer font-medium">{t.summary}</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {t.explanation.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
              {t.rejectedCandidates && t.rejectedCandidates.length > 0 && (
                <p className="mt-2 text-sm text-stone-400">
                  Écartés : {t.rejectedCandidates.map((r) => `${r.entityId} (${r.reason})`).join(' ; ')}
                </p>
              )}
              <p className="mt-2 text-xs text-stone-400">Règles : {t.ruleIds.join(', ')}</p>
            </details>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

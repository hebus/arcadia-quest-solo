import { useState, type ReactNode } from 'react';
import { Drawer } from '@/components/Drawer';
import { MiniPawn } from '@/components/MiniPawn';
import { Badge, Button, Panel } from '@/components/ui';
import { skillLines, statsOfMonster } from '@/engine/monsters';
import { HistoryScreen } from '@/features/history/HistoryScreen';
import { DecisionsPanel } from '@/features/monster-turn/MonsterTurnScreen';
import { QuestsPanel } from '@/features/scenario/Dashboard';
import { actorInfo } from '@/rendering/instructions/overlay';
import { useGameStore } from '@/stores/gameStore';
import { CopyLogs } from './CopyLogs';
import { SandboxPanel, useIsSandbox } from './SandboxPanel';
import { SoundPanel } from './SoundControls';

export type DockTab = 'scenario' | 'heroes' | 'enemies' | 'more';

const TABS: { id: DockTab; label: string; icon: string; title: string }[] = [
  { id: 'scenario', label: 'Scénario', icon: '📜', title: 'Scénario et objectifs' },
  { id: 'heroes', label: 'Héros', icon: '🛡', title: 'Héros' },
  { id: 'enemies', label: 'Ennemis', icon: '💀', title: 'Ennemis' },
  { id: 'more', label: 'Plus', icon: '⋯', title: 'Plus' },
];

/** Carte de la figurine touchée sur le plateau : nom, vie, capacités ; « Voir détails » ouvre le tiroir qui la concerne. */
function SelectionCard({ onDetails }: { onDetails: (t: DockTab) => void }) {
  const g = useGameStore((s) => s.game)!;
  const content = useGameStore((s) => s.content);
  const selectedId = useGameStore((s) => s.selectedId);
  const select = useGameStore((s) => s.select);
  const hero = g.heroes.find((h) => h.id === selectedId);
  const monster = g.monsters.find((m) => m.id === selectedId);
  if (!hero && !monster) return null;
  const info = actorInfo(g, selectedId!);
  const stats = monster ? statsOfMonster(content, g, monster) : undefined;
  const name = hero ? hero.name : (content.monsters[monster!.definitionId]?.name ?? monster!.definitionId);
  const life = hero ? hero.life : stats?.life;
  const wounds = hero ? hero.wounds : monster!.wounds;
  return (
    <section aria-label="Figurine sélectionnée" data-testid="selection-card" className="flex items-center gap-3 rounded-xl border-2 border-amber-700/70 bg-stone-900/95 p-2">
      <MiniPawn kind={info.kind} label={info.label} size={44} dead={hero?.dead} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate font-semibold">{name}</p>
        {life !== undefined && (
          <p className="text-sm">
            PV : {Math.max(0, life - wounds)}/{life} <span aria-hidden="true">{wounds >= life ? '🖤' : '❤'}</span>
          </p>
        )}
        {stats && <p className="truncate text-xs text-stone-300">{skillLines(stats)[0] ?? `${stats.attackDice} dé${stats.attackDice > 1 ? 's' : ''} · ${stats.attackType === 'melee' ? 'mêlée' : 'distance'} · mvt ${stats.movement}`}</p>}
      </div>
      <Button variant="primary" className="shrink-0 px-3! text-sm!" onClick={() => onDetails(hero ? 'heroes' : 'enemies')}>
        Voir détails ›
      </Button>
      <button type="button" aria-label="Fermer la fiche" onClick={() => select(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-amber-600 text-amber-200">
        ✕
      </button>
    </section>
  );
}

function EnemiesPanel() {
  const g = useGameStore((s) => s.game)!;
  const content = useGameStore((s) => s.content);
  const select = useGameStore((s) => s.select);
  const onBoard = g.monsters.filter((m) => m.status === 'board');
  return (
    <Panel title={`Monstres (${onBoard.length} en jeu)`}>
      <ul className="space-y-2">
        {onBoard.map((m) => {
          const stats = statsOfMonster(content, g, m);
          return (
            <li key={m.id}>
              <button type="button" className="flex w-full items-center gap-2 text-left" aria-label={`Repérer ${m.id} sur le plateau`} onClick={() => select(m.id)}>
                <MiniPawn kind="monster" label={actorInfo(g, m.id).label} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{content.monsters[m.definitionId]?.name ?? m.definitionId}</span>
                  {stats && <span className="block text-xs text-stone-300">{skillLines(stats).join(' ') || `${stats.attackDice} dé(s) · mvt ${stats.movement}`}</span>}
                </span>
                {m.isGuard && <Badge tone="warn">garde</Badge>}
                <Badge>{stats ? `${Math.max(0, stats.life - m.wounds)}/${stats.life} PV` : `${m.wounds} bl.`}</Badge>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-sm text-stone-400">
        Spawn Tile : {g.spawnTile.length}/{g.spawnTileCapacity} · Deck : {g.deck.draw.length} · défausse : {g.deck.discard.length}
      </p>
    </Panel>
  );
}

type MoreSection = 'decisions' | 'journal' | 'sound' | 'sandbox';

function MorePanel({ onClose, onHome }: { onClose: () => void; onHome: () => void }) {
  const sandbox = useIsSandbox();
  const [section, setSection] = useState<MoreSection>(sandbox ? 'sandbox' : 'decisions');
  const sections: { id: MoreSection; label: string }[] = [...(sandbox ? [{ id: 'sandbox' as const, label: '🧪 Essai' }] : []), { id: 'decisions', label: 'Décisions' }, { id: 'journal', label: 'Journal' }, { id: 'sound', label: 'Son' }];
  return (
    <>
      <nav aria-label="Sections de Plus" className="mb-3 flex flex-wrap gap-2">
        {sections.map((s) => (
          <Button key={s.id} variant={section === s.id ? 'primary' : 'secondary'} aria-pressed={section === s.id} onClick={() => setSection(s.id)}>
            {s.label}
          </Button>
        ))}
        <CopyLogs />
        <Button variant="ghost" onClick={onHome}>
          ← Accueil
        </Button>
      </nav>
      {section === 'decisions' && <DecisionsPanel />}
      {section === 'journal' && <HistoryScreen />}
      {section === 'sound' && <SoundPanel />}
      {section === 'sandbox' && sandbox && <SandboxPanel onPlace={onClose} />}
    </>
  );
}

/**
 * Mode portrait : la fiche de la figurine touchée et la barre d'onglets restent sous le plateau ;
 * chaque onglet ouvre un tiroir (objectifs, héros, ennemis, le reste) pour ne pas tout comprimer à l'écran.
 */
export function PortraitDock({ heroes, openTab, onOpenTab, onHome }: { onHome: () => void; heroes: ReactNode; openTab: DockTab | null; onOpenTab: (t: DockTab | null) => void }) {
  const tab = TABS.find((t) => t.id === openTab);
  return (
    <>
      <SelectionCard onDetails={onOpenTab} />
      <nav aria-label="Navigation du plateau" data-testid="portrait-dock" className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 gap-1 border-t-2 border-amber-700/70 bg-stone-950/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
        {TABS.map((t) => (
          <button key={t.id} type="button" aria-pressed={openTab === t.id} onClick={() => onOpenTab(openTab === t.id ? null : t.id)} className={`flex min-h-14 flex-col items-center justify-center rounded-lg border-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${openTab === t.id ? 'border-amber-400 bg-amber-900/60 text-amber-200' : 'border-transparent text-stone-200'}`}>
            <span className="text-xl leading-none" aria-hidden="true">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
      {tab && (
        <Drawer title={tab.title} onClose={() => onOpenTab(null)}>
          {tab.id === 'scenario' && <QuestsPanel />}
          {tab.id === 'heroes' && heroes}
          {tab.id === 'enemies' && <EnemiesPanel />}
          {tab.id === 'more' && <MorePanel onClose={() => onOpenTab(null)} onHome={onHome} />}
        </Drawer>
      )}
    </>
  );
}

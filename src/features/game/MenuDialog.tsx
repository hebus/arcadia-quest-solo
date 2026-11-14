import { Button } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { CorrectionsPanel } from '@/features/scenario/CorrectionsPanel';
import { QuestsPanel, TeamPanels } from '@/features/scenario/Dashboard';
import { HistoryScreen } from '@/features/history/HistoryScreen';
import { DecisionsPanel } from '@/features/monster-turn/MonsterTurnScreen';
import { SandboxPanel, useIsSandbox } from './SandboxPanel';
import { SoundPanel } from './SoundControls';

export type MenuTab = 'team' | 'quests' | 'decisions' | 'journal' | 'corrections' | 'sound' | 'sandbox';

const TABS: { id: MenuTab; label: string }[] = [
  { id: 'team', label: 'Équipe' },
  { id: 'quests', label: 'Objectifs' },
  { id: 'decisions', label: 'Décisions' },
  { id: 'journal', label: 'Journal' },
  { id: 'corrections', label: 'Corrections' },
  { id: 'sound', label: 'Son' },
];
const SANDBOX_TAB = { id: 'sandbox' as const, label: '🧪 Terrain d’essai' };

/** Tout ce qui n'est pas nécessaire à chaque geste : consultable à la demande, hors de l'écran de jeu. */
export function MenuDialog({ tab, onTab, onClose }: { tab: MenuTab; onTab: (t: MenuTab) => void; onClose: () => void }) {
  const sandbox = useIsSandbox();
  const tabs = sandbox ? [SANDBOX_TAB, ...TABS] : TABS;
  return (
    <Modal title="Menu de la partie" size="lg" onClose={onClose}>
      <nav aria-label="Sections du menu" className="mb-3 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button key={t.id} variant={tab === t.id ? 'primary' : 'secondary'} aria-pressed={tab === t.id} onClick={() => onTab(t.id)}>
            {t.label}
          </Button>
        ))}
      </nav>
      {tab === 'team' && <TeamPanels />}
      {tab === 'quests' && <QuestsPanel />}
      {tab === 'decisions' && <DecisionsPanel />}
      {tab === 'journal' && <HistoryScreen />}
      {tab === 'corrections' && <CorrectionsPanel />}
      {tab === 'sound' && <SoundPanel />}
      {tab === 'sandbox' && sandbox && <SandboxPanel onPlace={onClose} />}
    </Modal>
  );
}

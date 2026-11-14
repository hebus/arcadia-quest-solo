import { useState } from 'react';
import { Button, ErrorBanner } from '@/components/ui';
import { GuideScreen } from '@/features/campaign/GuideScreen';
import { HomeScreen } from '@/features/campaign/HomeScreen';
import { ResultScreen } from '@/features/campaign/ResultScreen';
import { useGameAudio } from '@/audio/director';
import { useAttackAnnouncement } from '@/features/game/announce';
import { Modal } from '@/components/Modal';
import { ActionPanel, HeroRoster } from '@/features/game/ActionDock';
import { MenuDialog, type MenuTab } from '@/features/game/MenuDialog';
import { InputPrompt } from '@/features/monster-turn/MonsterTurnScreen';
import { StatusBar } from '@/features/scenario/Dashboard';
import { GameBoard } from '@/features/scenario/GameBoard';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { ScenarioPicker } from '@/features/scenarios/ScenarioPicker';
import { StoryDialog } from '@/features/scenarios/StoryDialog';
import { SetupWizard } from '@/features/setup/SetupWizard';
import { TileEditor } from '@/features/tiles/TileEditor';
import { useGameStore } from '@/stores/gameStore';

type Screen = 'home' | 'scenarios' | 'setup' | 'game' | 'settings' | 'guide' | 'tiles';
function GameView({ leave, toCampaign }: { leave: () => void; toCampaign: () => void }) {
  useGameAudio();
  const announcing = useAttackAnnouncement();
  const stepsPending = useGameStore((s) => s.instructions.some((i) => !i.confirmed));
  const g = useGameStore((s) => s.game);
  const error = useGameStore((s) => s.error);
  const clear = useGameStore((s) => s.clearError);
  const agent = useGameStore((s) => s.agent);
  const [menu, setMenu] = useState<MenuTab | null>(null);
  const [result, setResult] = useState(false);
  if (!g) return <p>Aucune partie en cours.</p>;
  const ended = g.phase === 'SCENARIO_WON' || g.phase === 'SCENARIO_LOST';
  if (ended && result) return <ResultScreen onLeave={leave} onCampaign={toCampaign} />;
  return (
    <div className="mx-auto max-w-7xl space-y-2">
      <ErrorBanner message={error} onClose={clear} />
      <StoryDialog />
      <GameBoard
        header={
          <>
            <StatusBar onMenu={() => setMenu('team')} />
            <HeroRoster />
          </>
        }
        footer={<ActionPanel onDecisions={() => setMenu('decisions')} onResult={() => setResult(true)} />}
      />
      {agent.request && agent.status === 'awaiting-input' && !announcing && !stepsPending && (
        <Modal title={agent.request.kind === 'defense-result' ? 'Jet de défense' : 'Résultat des dés'} size="sm">
          <InputPrompt request={agent.request} />
        </Modal>
      )}
      {menu && <MenuDialog tab={menu} onTab={setMenu} onClose={() => setMenu(null)} />}
    </div>
  );
}

export function App() {
  const [screen, setScreen] = useState<Screen>('home');
  return (
    <main className="min-h-screen bg-stone-950 p-4 text-stone-100 md:p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-amber-300">Arcadia Quest Solo Companion</h1>
        {screen !== 'home' && (
          <Button variant="ghost" onClick={() => setScreen('home')}>
            ← Accueil
          </Button>
        )}
      </header>
      {screen === 'home' && <HomeScreen go={setScreen} />}
      {screen === 'scenarios' && <ScenarioPicker onStart={() => setScreen('game')} />}
      {screen === 'setup' && <SetupWizard onDone={() => setScreen('game')} openLibrary={() => setScreen('tiles')} />}
      {screen === 'game' && <GameView leave={() => setScreen('home')} toCampaign={() => setScreen('scenarios')} />}
      {screen === 'settings' && <SettingsScreen />}
      {screen === 'guide' && <GuideScreen />}
      {screen === 'tiles' && (
        <div className="space-y-3">
          <TileEditor />
          <Button onClick={() => setScreen('setup')}>Retour à la mise en place</Button>
        </div>
      )}
    </main>
  );
}

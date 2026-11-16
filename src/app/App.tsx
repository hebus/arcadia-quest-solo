import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, ErrorBanner, Panel } from '@/components/ui';
import { GuideScreen } from '@/features/campaign/GuideScreen';
import { HomeScreen } from '@/features/campaign/HomeScreen';
import { ResultScreen } from '@/features/campaign/ResultScreen';
import { useGameAudio } from '@/audio/director';
import { useAttackAnnouncement } from '@/features/game/announce';
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
  // L'état de la partie se range dans l'en-tête, près du bouton Accueil (sans l'en-tête, il reste en place).
  const [headerSlot] = useState<HTMLElement | null>(() => (typeof document === 'undefined' ? null : document.getElementById('aq-status-slot')));
  if (!g) return <p>Aucune partie en cours.</p>;
  const ended = g.phase === 'SCENARIO_WON' || g.phase === 'SCENARIO_LOST';
  if (ended && result) return <ResultScreen onLeave={leave} onCampaign={toCampaign} />;
  const status = <StatusBar onMenu={() => setMenu('team')} />;
  return (
    <div className="space-y-2">
      <ErrorBanner message={error} onClose={clear} />
      <StoryDialog />
      {headerSlot ? createPortal(status, headerSlot) : status}
      <GameBoard
        roster={<HeroRoster />}
        monsterInput={
          agent.request && agent.status === 'awaiting-input' && !announcing && !stepsPending ? (
            <Panel title={agent.request.kind === 'defense-result' ? 'Jet de défense' : 'Résultat des dés'}>
              <InputPrompt request={agent.request} />
            </Panel>
          ) : undefined
        }
        footer={<ActionPanel onDecisions={() => setMenu('decisions')} onResult={() => setResult(true)} />}
      />
      {menu && <MenuDialog tab={menu} onTab={setMenu} onClose={() => setMenu(null)} />}
    </div>
  );
}

export function App() {
  const [screen, setScreen] = useState<Screen>('home');
  return (
    <main className={`relative bg-stone-950 p-4 text-stone-100 md:p-6 aq-stage ${screen === 'game' ? 'aq-stage-game' : ''}`}>
      <div className="aq-stage-bg" aria-hidden="true" />
      {/* Le titre est dans le fond d'écran : on le garde pour les lecteurs d'écran et le bouton Accueil flotte en haut à droite. */}
      <header className="absolute right-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2">
        <h1 className="sr-only">Arcadia Quest Solo Companion</h1>
        <div id="aq-status-slot" className="flex justify-end" />
        {screen !== 'home' && (
          <Button variant="ghost" onClick={() => setScreen('home')}>
            ← Accueil
          </Button>
        )}
        <div id="aq-header-slot" className="flex flex-col items-end gap-2" />
      </header>
      {/* Sur laptop, le contenu est centré avec des marges ; le plateau de jeu, lui, prend toute la largeur. */}
      <div className="aq-stage-content">
      <div className={screen === 'game' ? 'w-full' : 'mx-auto w-full max-w-6xl'}>
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
      </div>
      </div>
    </main>
  );
}

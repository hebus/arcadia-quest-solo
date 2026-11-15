import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCampaignStore } from '@/stores/campaignStore';
import { useGameStore } from '@/stores/gameStore';
import { useTileStore } from '@/stores/tileStore';
import { testContent } from '@/tests/fixtures/demo';
import { attackTurn } from '@/tests/fixtures/monsterTurn';
import { App } from './App';

const store = () => useGameStore.getState();
const unconfirmed = () => store().instructions.filter((i) => !i.confirmed);

beforeEach(() => {
  useGameStore.setState({ game: attackTurn(), content: testContent, history: [], instructions: [], traces: [], answers: [], error: null, agent: { status: 'ready' }, selectedId: null, placing: null, correctionMode: false, beats: [], script: [], ackedRequestKey: null });
  useCampaignStore.setState({ campaign: null, error: null });
  useTileStore.setState({ tiles: [], loaded: true });
});

describe('phase des monstres : le store montre les étapes avant la saisie', () => {
  it('le lancement affiche des étapes non confirmées et attend la saisie sans les perdre', () => {
    act(() => store().startMonsterTurn());
    expect(store().agent.status).toBe('awaiting-input');
    expect(store().instructions.map((i) => i.visual?.type)).toEqual(['activate', 'move']);
    expect(unconfirmed()).toHaveLength(2);
  });

  it('après la réponse, les étapes déjà confirmées le restent, sans doublon', () => {
    act(() => store().startMonsterTurn());
    const ids = store().instructions.map((i) => i.id);
    act(() => store().confirmAll());
    act(() => store().provideAnswer({ kind: 'defense-result', saves: 0 }));
    const now = store().instructions;
    expect(now.slice(0, ids.length).map((i) => i.id)).toEqual(ids);
    expect(now.slice(0, ids.length).every((i) => i.confirmed)).toBe(true);
    expect(new Set(now.map((i) => i.id)).size).toBe(now.length);
  });

  it('arrêter le Monster Turn vide la liste d’étapes', () => {
    act(() => store().startMonsterTurn());
    act(() => store().abortMonsterTurn());
    expect(store().instructions).toEqual([]);
    expect(store().agent.status).toBe('ready');
  });
});

async function startDemo(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: /Nouvelle partie/ }));
  await user.click(screen.getByRole('button', { name: 'Charger la démo' }));
  await user.click(screen.getByRole('button', { name: '4. Quêtes et deck' }));
  await user.click(screen.getByRole('button', { name: 'Vérifier' }));
  await user.click(screen.getByRole('button', { name: 'Créer la partie' }));
  await user.click(await screen.findByRole('button', { name: 'Démarrer le scénario' }));
  // On remplace la partie par un début de Monster Turn avec défense physique.
  act(() => useGameStore.setState({ game: attackTurn(), content: testContent, instructions: [], traces: [], answers: [], agent: { status: 'ready' }, ackedRequestKey: null }));
}

describe('phase des monstres : ordre à l’écran', () => {
  it('étapes sur la table, puis annonce « qui attaque qui », puis dialogue de dés', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    await user.click(screen.getByRole('button', { name: 'Lancer le Monster Turn' }));

    const dice = () => screen.queryByRole('dialog', { name: 'Jet de défense' });
    const announce = () => screen.queryByTestId('attack-announcement');
    const steps = () => screen.queryByRole('region', { name: /Sur la table : étape/ });

    // 1. Les étapes d'abord : ni annonce ni dés.
    expect(steps()).toBeInTheDocument();
    expect(announce()).not.toBeInTheDocument();
    expect(dice()).not.toBeInTheDocument();
    // Rubriques et badge de phase.
    const rubriques = within(screen.getByRole('list', { name: 'Déroulement de la phase des monstres' }));
    expect(rubriques.getByText('Activation 1')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByLabelText('État de la partie')).toHaveTextContent('Phase des monstres · Activation 1');

    for (let i = 0; i < 2; i++) {
      expect(announce()).not.toBeInTheDocument();
      await user.click(within(steps()!).getByRole('button', { name: 'Fait' }));
    }
    // 2. L'annonce, sans dés.
    expect(steps()).not.toBeInTheDocument();
    expect(screen.getByTestId('attack-announcement')).toHaveTextContent('attaque');
    expect(dice()).not.toBeInTheDocument();
    expect(screen.getByLabelText('État de la partie')).not.toHaveTextContent('Phase des monstres ·');
    // 3. Les dés.
    await user.click(within(announce()!).getByRole('button', { name: /Continuer/ }));
    expect(announce()).not.toBeInTheDocument();
    expect(dice()).toBeInTheDocument();
  });
});

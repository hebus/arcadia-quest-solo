import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCampaignStore } from '@/stores/campaignStore';
import { defaultContent, useGameStore } from '@/stores/gameStore';
import { useTileStore } from '@/stores/tileStore';
import { scenarioToSetup } from '@/engine/scenario/definition';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES } from '@/game-data/original';
import { CAVE_AUX_CENDRES_LEGACY } from '@/tests/fixtures/legacyScenario';
import { App } from './App';

const game = () => useGameStore.getState().game!;

beforeEach(() => {
  useGameStore.setState({ game: null, history: [], instructions: [], traces: [], answers: [], error: null, agent: { status: 'ready' }, content: defaultContent(), selectedId: null, placing: null, correctionMode: false, beats: [], script: [] });
  useCampaignStore.setState({ campaign: null, error: null });
  useTileStore.setState({ tiles: [], loaded: true });
});

async function startScenario(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
  await user.click(screen.getByRole('button', { name: /Voir le briefing : Les Braises/ }));
  await user.click(screen.getByRole('button', { name: /Commencer l’aventure/ }));
  await user.click(await screen.findByRole('button', { name: 'Démarrer le scénario' }));
  // Ces tests portent sur les portes : ils jouent sur l'ancienne géométrie du scénario 1 (plateau écrit à la main).
  act(() => {
    const store = useGameStore.getState();
    store.newGame(scenarioToSetup(CAVE_AUX_CENDRES_LEGACY, { sessionId: 's', difficulty: 'medium', seed: 5, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT), CAVE_AUX_CENDRES_LEGACY.script ?? []);
    store.begin();
  });
  act(() => useGameStore.getState().correct({ kind: 'hero-position', heroId: 'h1', to: { x: 2, y: 6 } })); // au bord de la porte de la remise
}

describe('ouvrir une porte depuis le plateau', () => {
  it('la porte au bord du héros sélectionné est touchable ; l’ouvrir coûte 1 PM sans bouger ni attaquer', async () => {
    const user = userEvent.setup();
    await startScenario(user);
    // Pas de héros sélectionné : aucune porte touchable.
    expect(screen.queryByTestId('door-hit-porte-remise')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('token-h1'));
    fireEvent.click(await screen.findByTestId('door-hit-porte-remise'));
    expect(game().board.doors.find((d) => d.id === 'porte-remise')!.open).toBe(true);
    expect(game().heroes[0]!.position).toEqual({ x: 2, y: 6 });
    expect(game().heroTurn.h1).toMatchObject({ mpLeft: 2, attacked: false });
  });

  it('un héros éloigné de la porte ne peut pas l’ouvrir', async () => {
    const user = userEvent.setup();
    await startScenario(user);
    fireEvent.click(screen.getByTestId('token-h2')); // en (1,8)
    expect(screen.queryByTestId('door-hit-porte-remise')).not.toBeInTheDocument();
    expect(game().board.doors.find((d) => d.id === 'porte-remise')!.open).toBe(false);
  });

  it('l’ouverture ne verrouille pas la suite : le héros peut traverser avec ses points restants', async () => {
    const user = userEvent.setup();
    await startScenario(user);
    fireEvent.click(screen.getByTestId('token-h1'));
    fireEvent.click(await screen.findByTestId('door-hit-porte-remise'));
    // L'étape « porte » du joueur reste à valider, sans bloquer son propre mouvement.
    expect(useGameStore.getState().instructions.some((i) => !i.confirmed && i.visual?.type === 'door')).toBe(true);
    fireEvent.click(screen.getByTestId('cell-2-5'));
    expect(game().heroes[0]!.position).toEqual({ x: 2, y: 5 });
    expect(game().heroTurn.h1!.mpLeft).toBe(1);
  });

  it('une porte ouverte reste touchable : la toucher de nouveau la referme pour 1 PM', async () => {
    const user = userEvent.setup();
    await startScenario(user);
    fireEvent.click(screen.getByTestId('token-h1'));
    fireEvent.click(await screen.findByTestId('door-hit-porte-remise'));
    expect(game().board.doors.find((d) => d.id === 'porte-remise')!.open).toBe(true);
    fireEvent.click(await screen.findByTestId('door-hit-porte-remise'));
    expect(game().board.doors.find((d) => d.id === 'porte-remise')!.open).toBe(false);
    expect(game().heroes[0]!.position).toEqual({ x: 2, y: 6 });
    expect(game().heroTurn.h1).toMatchObject({ mpLeft: 1, attacked: false });
    expect(useGameStore.getState().instructions.map((i) => i.label)).toEqual(['Ouvrir la porte', 'Fermer la porte']);
  });

  it('sans point de mouvement restant, plus aucune porte n’est touchable', async () => {
    const user = userEvent.setup();
    await startScenario(user);
    fireEvent.click(screen.getByTestId('token-h1'));
    act(() => useGameStore.setState((st) => ({ game: { ...st.game!, activatedHeroIds: ['h1'], heroTurn: { h1: { mpLeft: 0, moved: true, attacked: false } } } })));
    expect(screen.queryByTestId('door-hit-porte-remise')).not.toBeInTheDocument();
  });

  it('pendant l’attaque d’un monstre (saisie en attente), aucune porte ne s’ouvre', async () => {
    const user = userEvent.setup();
    await startScenario(user);
    fireEvent.click(screen.getByTestId('token-h1'));
    act(() => useGameStore.setState({ agent: { status: 'awaiting-input', request: { kind: 'die', purpose: 'x', faces: ['a'] } } }));
    expect(screen.queryByTestId('door-hit-porte-remise')).not.toBeInTheDocument();
    act(() => useGameStore.getState().openDoor('h1', 'porte-remise'));
    expect(game().board.doors.find((d) => d.id === 'porte-remise')!.open).toBe(false);
    act(() => useGameStore.getState().closeDoor('h1', 'porte-remise')); // fermer est bloqué aussi
    expect(useGameStore.getState().error).toMatch(/saisie est en cours/);
  });
});

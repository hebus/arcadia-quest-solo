import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { ResultScreen } from '@/features/campaign/ResultScreen';
import { createScenarioGame } from '@/engine/scenario/definition';
import type { GameState } from '@/engine/domain/schemas';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES, scenarioById } from '@/game-data/original';
import { useCampaignStore } from '@/stores/campaignStore';
import { MEDIUM_IDS, useCampaignRunStore } from '@/stores/campaignRunStore';
import { defaultContent, useGameStore } from '@/stores/gameStore';
import { useTileStore } from '@/stores/tileStore';
import { resetTestGuild } from '@/tests/fixtures/guild';

beforeEach(() => {
  useGameStore.setState({ game: null, history: [], instructions: [], traces: [], answers: [], error: null, agent: { status: 'ready' }, content: defaultContent(), selectedId: null, placing: null, correctionMode: false, beats: [], script: [] });
  useCampaignStore.setState({ campaign: null, error: null });
  useTileStore.setState({ tiles: [], loaded: true });
  useCampaignRunStore.setState({ run: null, random: null, medium: null, loaded: true });
  resetTestGuild();
});

const store = () => useCampaignRunStore.getState();
/** Une partie terminée d'un chapitre de la campagne moyenne. */
function finished(n: number, won: boolean, coins = 3): GameState {
  const g = createScenarioGame(scenarioById(MEDIUM_IDS[n]!)!, { sessionId: `m-${n}-${won}-${coins}`, difficulty: 'medium', seed: 1, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT);
  return { ...g, phase: won ? 'SCENARIO_WON' : 'SCENARIO_LOST', coins, quests: g.quests.map((q) => ({ ...q, done: won })) };
}
const play = (g: GameState) => act(() => store().record(g));

async function openPicker(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
  return screen.getByTestId('medium-campaign');
}

describe('la campagne moyenne dans le choix des scénarios', () => {
  it('proposée en plus des autres campagnes : un bouton, sans chapitres', async () => {
    const card = await openPicker(userEvent.setup());
    expect(within(card).getByRole('heading', { name: /Le Siège de Val-Noir/ })).toHaveTextContent('5 chapitres');
    expect(within(card).getByRole('button', { name: 'Commencer la campagne moyenne' })).toBeInTheDocument();
    expect(within(card).queryByTestId('chapter-1')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('campaign')).getByRole('button', { name: 'Commencer la campagne' })).toBeInTheDocument();
    expect(within(screen.getByTestId('random-campaign')).getByRole('button', { name: 'Tirer une campagne aléatoire' })).toBeInTheDocument();
  });

  it('commencer : cinq chapitres, le premier à jouer, les autres verrouillés ; les chapitres suivants ne figurent pas parmi les scénarios seuls', async () => {
    const user = userEvent.setup();
    const card = await openPicker(user);
    await user.click(within(card).getByRole('button', { name: 'Commencer la campagne moyenne' }));
    expect(within(card).getByTestId('medium-campaign-gold')).toHaveTextContent('PO de la guilde : 0');
    expect(within(card).getByTestId('chapter-1')).toHaveAttribute('data-state', 'todo');
    for (const n of [2, 3, 4, 5]) expect(within(card).getByTestId(`chapter-${n}`)).toHaveAttribute('data-state', 'locked');
    expect(within(card).getByTestId('chapter-1')).toHaveTextContent('Le Pont du Guet');
    expect(screen.queryByRole('button', { name: /Voir le briefing : La Halle aux Grains/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Voir le briefing : Le Trône de Val-Noir/ })).not.toBeInTheDocument();
  });

  it('jouer le chapitre 1 ouvre son briefing', async () => {
    const user = userEvent.setup();
    const card = await openPicker(user);
    await user.click(within(card).getByRole('button', { name: 'Commencer la campagne moyenne' }));
    await user.click(within(card).getByRole('button', { name: /Jouer le chapitre 1 : Le Pont du Guet/ }));
    expect(screen.getByText('Le Pont du Guet', { selector: 'h2, h3' })).toBeInTheDocument();
  });

  it('gagner un chapitre déverrouille le suivant et cumule les PO ; une défaite se rejoue', async () => {
    const user = userEvent.setup();
    const card = await openPicker(user);
    await user.click(within(card).getByRole('button', { name: 'Commencer la campagne moyenne' }));
    play(finished(0, true, 4));
    expect(within(card).getByTestId('chapter-1')).toHaveAttribute('data-state', 'won');
    expect(within(card).getByTestId('chapter-2')).toHaveAttribute('data-state', 'todo');
    expect(within(card).getByTestId('chapter-3')).toHaveAttribute('data-state', 'locked');
    expect(within(card).getByTestId('medium-campaign-gold')).toHaveTextContent(/PO de la guilde : \d+/);
    play(finished(1, false, 1));
    expect(within(card).getByTestId('chapter-2')).toHaveAttribute('data-state', 'retry');
    expect(within(card).getByRole('button', { name: /Rejouer le chapitre 2 : La Halle aux Grains/ })).toBeInTheDocument();
  });

  it('terminer les cinq chapitres affiche la fin de la campagne', async () => {
    const user = userEvent.setup();
    const card = await openPicker(user);
    await user.click(within(card).getByRole('button', { name: 'Commencer la campagne moyenne' }));
    for (let n = 0; n < 5; n++) play(finished(n, true, n + 1));
    expect(within(card).getByRole('status')).toHaveTextContent('levé le siège de Val-Noir');
  });

  it('commencer en cours de petite campagne demande confirmation avant de l’abandonner ; annuler la garde', async () => {
    const user = userEvent.setup();
    const card = await openPicker(user);
    await user.click(within(screen.getByTestId('campaign')).getByRole('button', { name: 'Commencer la campagne' }));
    await user.click(within(card).getByRole('button', { name: 'Commencer la campagne moyenne' }));
    expect(within(card).getByText('La campagne en cours sera abandonnée.')).toBeInTheDocument();
    expect(store().medium).toBeNull();
    await user.click(within(card).getByRole('button', { name: 'Annuler' }));
    expect(store().run).not.toBeNull();
    await user.click(within(card).getByRole('button', { name: 'Commencer la campagne moyenne' }));
    await user.click(within(card).getByRole('button', { name: 'Confirmer : abandonner la campagne en cours' }));
    expect(store().medium).not.toBeNull();
    expect(store().run).toBeNull();
  });

  it('inversement : commencer la petite campagne pendant la moyenne demande confirmation', async () => {
    const user = userEvent.setup();
    const card = await openPicker(user);
    await user.click(within(card).getByRole('button', { name: 'Commencer la campagne moyenne' }));
    const small = screen.getByTestId('campaign');
    await user.click(within(small).getByRole('button', { name: 'Commencer la campagne' }));
    expect(within(small).getByText('La campagne moyenne en cours sera abandonnée.')).toBeInTheDocument();
    expect(store().medium).not.toBeNull();
    await user.click(within(small).getByRole('button', { name: 'Confirmer : abandonner la campagne moyenne' }));
    expect(store().medium).toBeNull();
    expect(store().run).not.toBeNull();
  });

  it('recommencer demande confirmation et efface la progression', async () => {
    const user = userEvent.setup();
    const card = await openPicker(user);
    await user.click(within(card).getByRole('button', { name: 'Commencer la campagne moyenne' }));
    play(finished(0, true, 4));
    await user.click(within(card).getByRole('button', { name: 'Recommencer la campagne moyenne' }));
    expect(within(card).getByText('La progression et les PO cumulés seront effacés.')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Confirmer : tout recommencer' }));
    expect(within(card).getByTestId('chapter-1')).toHaveAttribute('data-state', 'todo');
    expect(within(card).getByTestId('medium-campaign-gold')).toHaveTextContent('PO de la guilde : 0');
  });
});

describe('l’écran de résultat d’un chapitre de la campagne moyenne', () => {
  it('annonce le chapitre gagné, le chapitre suivant débloqué et les PO cumulés', () => {
    store().startMedium();
    const g = finished(0, true, 4);
    act(() => useGameStore.setState({ game: g }));
    render(<ResultScreen onLeave={() => undefined} onCampaign={() => undefined} />);
    expect(screen.getByText(/Le Siège de Val-Noir · chapitre 1 sur 5/)).toBeInTheDocument();
    expect(screen.getByTestId('chapter-result')).toHaveTextContent('Chapitre gagné.');
    expect(screen.getByTestId('chapter-unlocked')).toHaveTextContent('Chapitre 2 débloqué.');
  });
});

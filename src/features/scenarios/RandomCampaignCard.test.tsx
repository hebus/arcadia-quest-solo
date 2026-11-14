import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { ResultScreen } from '@/features/campaign/ResultScreen';
import { coinsOfGame, totalGold } from '@/engine/campaignRun';
import { createScenarioGame } from '@/engine/scenario/definition';
import type { GameState } from '@/engine/domain/schemas';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES } from '@/game-data/original';
import { useCampaignStore } from '@/stores/campaignStore';
import { randomChapterIds, useCampaignRunStore } from '@/stores/campaignRunStore';
import { defaultContent, useGameStore } from '@/stores/gameStore';
import { useTileStore } from '@/stores/tileStore';
import { resetTestGuild } from '@/tests/fixtures/guild';

beforeEach(() => {
  useGameStore.setState({ game: null, history: [], instructions: [], traces: [], answers: [], error: null, agent: { status: 'ready' }, content: defaultContent(), selectedId: null, placing: null, correctionMode: false, beats: [], script: [] });
  useCampaignStore.setState({ campaign: null, error: null });
  useTileStore.setState({ tiles: [], loaded: true });
  useCampaignRunStore.setState({ run: null, random: null, loaded: true });
  resetTestGuild();
});

const store = () => useCampaignRunStore.getState();
const chapter = (n: number) => store().random!.campaign.chapters[n]!.scenario;
/** Une partie terminée d'un chapitre aléatoire. */
function finished(n: number, won: boolean, coins = 3): GameState {
  const g = createScenarioGame(chapter(n), { sessionId: `s-${n}-${won}-${coins}`, difficulty: 'medium', seed: 1, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT);
  return { ...g, phase: won ? 'SCENARIO_WON' : 'SCENARIO_LOST', coins, quests: g.quests.map((q) => ({ ...q, done: won })) };
}
const play = (g: GameState) => act(() => store().record(g));

async function openRandomCampaign(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
  return screen.getByTestId('random-campaign');
}

describe('la campagne aléatoire dans le choix des scénarios', () => {
  it('avant le tirage : un bouton, sans chapitres ; la campagne écrite à la main reste proposée', async () => {
    const card = await openRandomCampaign(userEvent.setup());
    expect(within(card).getByRole('button', { name: 'Tirer une campagne aléatoire' })).toBeInTheDocument();
    expect(within(card).queryByTestId('chapter-1')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('campaign')).getByRole('button', { name: 'Commencer la campagne' })).toBeInTheDocument();
  });

  it('le tirage affiche trois chapitres comme la campagne écrite : le premier à jouer, les autres verrouillés, 0 PO', async () => {
    const user = userEvent.setup();
    const card = await openRandomCampaign(user);
    await user.click(within(card).getByRole('button', { name: 'Tirer une campagne aléatoire' }));
    expect(within(card).getByTestId('random-campaign-gold')).toHaveTextContent('PO de la guilde : 0');
    expect(within(card).getByTestId('chapter-1')).toHaveAttribute('data-state', 'todo');
    expect(within(card).getByTestId('chapter-2')).toHaveAttribute('data-state', 'locked');
    expect(within(card).getByTestId('chapter-3')).toHaveAttribute('data-state', 'locked');
    expect(within(card).getByTestId('chapter-1')).toHaveTextContent(chapter(0).title);
    expect(store().random).not.toBeNull();
  });

  it('« Autre tirage » change la campagne tant que rien n’est joué, puis disparaît', async () => {
    const user = userEvent.setup();
    const card = await openRandomCampaign(user);
    await user.click(within(card).getByRole('button', { name: 'Tirer une campagne aléatoire' }));
    const seen = new Set([store().random!.campaign.id]);
    for (let i = 0; i < 4; i++) {
      await user.click(within(card).getByRole('button', { name: /Autre tirage/ }));
      seen.add(store().random!.campaign.id);
    }
    expect(seen.size).toBeGreaterThan(1);
    play(finished(0, true));
    expect(within(card).queryByRole('button', { name: /Autre tirage/ })).not.toBeInTheDocument();
  });

  it('jouer le chapitre ouvre son briefing, sans « Autre tirage » isolé, puis la partie garde le scénario', async () => {
    const user = userEvent.setup();
    act(() => store().drawRandom(5));
    const card = await openRandomCampaign(user);
    await user.click(within(card).getByRole('button', { name: /Jouer le chapitre 1/ }));
    expect(screen.getByRole('heading', { name: new RegExp(chapter(0).title.slice(0, 20)) })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Autre tirage/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Commencer l’aventure/ }));
    expect(useGameStore.getState().game!.scenarioId).toBe('campagne-5-1');
    expect(useGameStore.getState().game!.generatedScenario).toBeTruthy();
  });

  it('gagner un chapitre déverrouille le suivant et cumule les PO ; la défaite se rejoue', async () => {
    const user = userEvent.setup();
    act(() => store().drawRandom(5));
    const card = await openRandomCampaign(user);
    play(finished(0, false, 1));
    expect(within(card).getByTestId('chapter-1')).toHaveAttribute('data-state', 'retry');
    play(finished(0, true, 2));
    play(finished(1, true, 4));
    expect(within(card).getByTestId('chapter-1')).toHaveAttribute('data-state', 'won');
    expect(within(card).getByTestId('chapter-3')).toHaveAttribute('data-state', 'todo');
    expect(within(card).getByTestId('random-campaign-gold')).toHaveTextContent(`PO de la guilde : ${totalGold(store().random!.run)}`);
    expect(totalGold(store().random!.run)).toBe(coinsOfGame(finished(0, false, 1)) + coinsOfGame(finished(0, true, 2)) + coinsOfGame(finished(1, true, 4))); // la défaite rapporte aussi ses PO
    play(finished(2, true, 1));
    expect(within(card).getByRole('status')).toHaveTextContent('Campagne terminée');
  });

  it('abandonner une campagne en cours demande une confirmation (écrite → aléatoire, aléatoire → écrite, nouveau tirage)', async () => {
    const user = userEvent.setup();
    act(() => store().start());
    const card = await openRandomCampaign(user);
    // écrite en cours → tirer une aléatoire : confirmation
    await user.click(within(card).getByRole('button', { name: 'Tirer une campagne aléatoire' }));
    expect(store().random).toBeNull();
    await user.click(within(card).getByRole('button', { name: /Confirmer : abandonner la campagne en cours/ }));
    expect(store().random).not.toBeNull();
    expect(store().run).toBeNull();
    // aléatoire en cours → commencer l'écrite : confirmation, annulable
    const hand = screen.getByTestId('campaign');
    await user.click(within(hand).getByRole('button', { name: 'Commencer la campagne' }));
    await user.click(within(hand).getByRole('button', { name: 'Annuler' }));
    expect(store().random).not.toBeNull();
    await user.click(within(hand).getByRole('button', { name: 'Commencer la campagne' }));
    await user.click(within(hand).getByRole('button', { name: /Confirmer : abandonner la campagne aléatoire/ }));
    expect(store().random).toBeNull();
    expect(store().run).not.toBeNull();
  });

  it('un nouveau tirage après un chapitre joué demande confirmation et efface la progression', async () => {
    const user = userEvent.setup();
    act(() => store().drawRandom(5));
    const card = await openRandomCampaign(user);
    play(finished(0, true));
    const first = store().random!.campaign.id;
    await user.click(within(card).getByRole('button', { name: 'Tirer une nouvelle campagne' }));
    expect(store().random!.campaign.id).toBe(first);
    await user.click(within(card).getByRole('button', { name: /Confirmer : tirer une nouvelle campagne/ }));
    expect(store().random!.run.attempts).toHaveLength(0);
    await user.click(within(card).getByRole('button', { name: /Autre tirage/ }));
  });

  it('l’écran de résultat suit la campagne aléatoire : titre, PO, chapitre suivant débloqué', async () => {
    act(() => store().drawRandom(5));
    const g = finished(0, true, 3);
    useGameStore.setState({ game: g });
    render(<ResultScreen onLeave={() => undefined} onCampaign={() => undefined} />);
    expect(screen.getByText(new RegExp(`${store().random!.campaign.title} · chapitre 1 sur 3`))).toBeInTheDocument();
    expect(screen.getByTestId('chapter-result')).toHaveTextContent('Chapitre gagné');
    expect(screen.getByTestId('chapter-result')).toHaveTextContent(`PO de la guilde : ${coinsOfGame(g)}`);
    expect(screen.getByTestId('chapter-unlocked')).toHaveTextContent('Chapitre 2 débloqué');
    expect(randomChapterIds(store().random)).toContain(g.scenarioId);
  });
});

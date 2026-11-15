import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { ResultScreen } from '@/features/campaign/ResultScreen';
import { createScenarioGame } from '@/engine/scenario/definition';
import type { GameState } from '@/engine/domain/schemas';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES, scenarioById } from '@/game-data/original';
import { useCampaignStore } from '@/stores/campaignStore';
import { CHAPTER_IDS, useCampaignRunStore } from '@/stores/campaignRunStore';
import { defaultContent, useGameStore } from '@/stores/gameStore';
import { useTileStore } from '@/stores/tileStore';
import { resetTestGuild } from '@/tests/fixtures/guild';

beforeEach(() => {
  useGameStore.setState({ game: null, history: [], instructions: [], traces: [], answers: [], error: null, agent: { status: 'ready' }, content: defaultContent(), selectedId: null, placing: null, correctionMode: false, beats: [], script: [] });
  useCampaignStore.setState({ campaign: null, error: null });
  useTileStore.setState({ tiles: [], loaded: true });
  useCampaignRunStore.setState({ run: null, loaded: true });
  resetTestGuild();
});

/** Une partie terminée d'un chapitre : gagnée ou perdue, avec ses pièces. */
function finished(scenarioId: string, won: boolean, coins = 3): GameState {
  const g = createScenarioGame(scenarioById(scenarioId)!, { sessionId: `s-${scenarioId}-${won}-${coins}`, difficulty: 'medium', seed: 1, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT);
  return { ...g, phase: won ? 'SCENARIO_WON' : 'SCENARIO_LOST', coins, quests: g.quests.map((q) => ({ ...q, done: won })) };
}
const play = (g: GameState) => act(() => useCampaignRunStore.getState().record(g));

async function openCampaign(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
  return screen.getByTestId('campaign');
}

describe('la campagne dans le choix des scénarios', () => {
  it('avant de commencer : le titre, l’accroche et un bouton « Commencer la campagne », sans chapitres', async () => {
    const card = await openCampaign(userEvent.setup());
    expect(within(card).getByText(/La Chute des Braises/)).toBeInTheDocument();
    expect(card).toHaveTextContent('petite campagne en 3 chapitres');
    expect(within(card).getByRole('button', { name: 'Commencer la campagne' })).toBeInTheDocument();
    expect(within(card).queryByTestId('chapter-1')).not.toBeInTheDocument();
  });

  it('commencée : trois chapitres, le premier à jouer, les deux autres verrouillés, 0 PO', async () => {
    const user = userEvent.setup();
    const card = await openCampaign(user);
    await user.click(within(card).getByRole('button', { name: 'Commencer la campagne' }));
    expect(within(card).getByTestId('campaign-gold')).toHaveTextContent('PO de la guilde : 0');
    expect(within(card).getByTestId('chapter-1')).toHaveAttribute('data-state', 'todo');
    expect(within(card).getByTestId('chapter-2')).toHaveAttribute('data-state', 'locked');
    expect(within(card).getByTestId('chapter-3')).toHaveAttribute('data-state', 'locked');
    expect(within(card).getByTestId('chapter-1')).toHaveTextContent('Les Braises de Port-Cendre');
    expect(within(card).getByTestId('chapter-2')).toHaveTextContent('Le Marché des Ombres');
    expect(within(card).getByTestId('chapter-3')).toHaveTextContent('La Forge du Maître-Fer');
    // Un chapitre verrouillé ne se lance pas.
    expect(within(card).getByRole('button', { name: /Chapitre 2 verrouillé/ })).toBeDisabled();
    expect(within(card).getByRole('button', { name: /Chapitre 3 verrouillé/ })).toBeDisabled();
    expect(within(card).queryByRole('button', { name: /Jouer le chapitre 2/ })).not.toBeInTheDocument();
  });

  it('« Jouer le chapitre 1 » ouvre son briefing, d’où l’on revient au choix', async () => {
    const user = userEvent.setup();
    const card = await openCampaign(user);
    await user.click(within(card).getByRole('button', { name: 'Commencer la campagne' }));
    await user.click(within(card).getByRole('button', { name: /Jouer le chapitre 1/ }));
    expect(screen.getByText(/Port-Cendre brûle depuis trois nuits/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Commencer l’aventure/ })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /Autres scénarios/ }));
    expect(screen.getByTestId('campaign')).toBeInTheDocument();
  });

  it('gagner le chapitre 1 déverrouille le chapitre 2 et cumule les PO', async () => {
    const user = userEvent.setup();
    const card = await openCampaign(user);
    await user.click(within(card).getByRole('button', { name: 'Commencer la campagne' }));
    play(finished('cave-aux-cendres', true, 4)); // 4 pièces + 3 quêtes
    expect(within(card).getByTestId('chapter-1')).toHaveAttribute('data-state', 'won');
    expect(within(card).getByTestId('chapter-1')).toHaveTextContent('terminé');
    expect(within(card).getByTestId('chapter-1')).toHaveTextContent('+7 PO');
    expect(within(card).getByTestId('chapter-2')).toHaveAttribute('data-state', 'todo');
    expect(within(card).getByTestId('chapter-3')).toHaveAttribute('data-state', 'locked');
    expect(within(card).getByTestId('campaign-gold')).toHaveTextContent('PO de la guilde : 7');
    // Le chapitre 2 se lance : son briefing s'ouvre.
    await user.click(within(card).getByRole('button', { name: /Jouer le chapitre 2/ }));
    expect(screen.getByRole('heading', { name: 'Le Marché des Ombres' })).toBeInTheDocument();
  });

  it('une défaite ne déverrouille rien : le chapitre est à rejouer, les PO gagnés comptent', async () => {
    const user = userEvent.setup();
    const card = await openCampaign(user);
    await user.click(within(card).getByRole('button', { name: 'Commencer la campagne' }));
    play(finished('cave-aux-cendres', false, 2));
    expect(within(card).getByTestId('chapter-1')).toHaveAttribute('data-state', 'retry');
    expect(within(card).getByTestId('chapter-1')).toHaveTextContent('à rejouer (défaite)');
    expect(within(card).getByTestId('chapter-2')).toHaveAttribute('data-state', 'locked');
    expect(within(card).getByRole('button', { name: /Rejouer le chapitre 1/ })).toBeInTheDocument();
    expect(within(card).getByTestId('campaign-gold')).toHaveTextContent('PO de la guilde : 2');
  });

  it('les trois chapitres gagnés : campagne terminée, avec le total des PO', async () => {
    const user = userEvent.setup();
    const card = await openCampaign(user);
    await user.click(within(card).getByRole('button', { name: 'Commencer la campagne' }));
    play(finished('cave-aux-cendres', true, 2));
    play(finished('marche-aux-ombres', true, 3));
    play(finished('forge-du-maitre-fer', true, 5));
    expect(within(card).getByRole('status')).toHaveTextContent('Campagne terminée');
    expect(within(card).getByTestId('campaign-gold')).toHaveTextContent(`PO de la guilde : ${(2 + 3) + (3 + 3) + (5 + 3)}`);
    expect(within(card).queryByRole('button', { name: /Jouer le chapitre|Rejouer/ })).not.toBeInTheDocument();
  });

  it('« Recommencer la campagne » demande confirmation, puis efface la progression et les PO', async () => {
    const user = userEvent.setup();
    const card = await openCampaign(user);
    await user.click(within(card).getByRole('button', { name: 'Commencer la campagne' }));
    play(finished('cave-aux-cendres', true, 4));
    await user.click(within(card).getByRole('button', { name: 'Recommencer la campagne' }));
    await user.click(within(card).getByRole('button', { name: 'Annuler' })); // annuler ne change rien
    expect(within(card).getByTestId('chapter-1')).toHaveAttribute('data-state', 'won');
    await user.click(within(card).getByRole('button', { name: 'Recommencer la campagne' }));
    await user.click(within(card).getByRole('button', { name: /Confirmer : tout recommencer/ }));
    expect(within(card).getByTestId('chapter-1')).toHaveAttribute('data-state', 'todo');
    expect(within(card).getByTestId('chapter-2')).toHaveAttribute('data-state', 'locked');
    expect(within(card).getByTestId('campaign-gold')).toHaveTextContent('PO de la guilde : 0');
  });

  it('trois onglets : campagnes, scénarios uniques (le scénario 1, mais pas les chapitres 2 et 3, réservés à la campagne) et terrain d’essai', async () => {
    const user = userEvent.setup();
    await openCampaign(user);
    await user.click(screen.getByRole('tab', { name: 'Scénarios uniques' }));
    expect(screen.getByRole('button', { name: /Voir le briefing : Les Braises/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Voir le briefing : Terrain d’essai/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Terrain d’essai' }));
    expect(screen.getByRole('button', { name: /Voir le briefing : Terrain d’essai/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Voir le briefing : Les Braises/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Scénarios uniques' }));
    expect(screen.queryByRole('button', { name: /Voir le briefing : Le Marché des Ombres/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Voir le briefing : La Forge du Maître-Fer/ })).not.toBeInTheDocument();
    expect(CHAPTER_IDS).toHaveLength(3);
  });
});

describe('écran de résultat d’un chapitre', () => {
  const show = (g: GameState, onCampaign = () => undefined) => {
    useGameStore.setState({ game: g, content: ORIGINAL_CONTENT });
    return render(<ResultScreen onLeave={() => undefined} onCampaign={onCampaign} />);
  };

  it('un chapitre gagné est enregistré, le suivant se débloque, et un bouton ramène à la campagne', async () => {
    const user = userEvent.setup();
    useCampaignRunStore.getState().start();
    let back = 0;
    show(finished('cave-aux-cendres', true, 4), () => void back++);
    expect(useCampaignRunStore.getState().run!.attempts).toHaveLength(1);
    expect(screen.getByTestId('chapter-result')).toHaveTextContent('Chapitre gagné.');
    expect(screen.getByTestId('chapter-result')).toHaveTextContent('PO de la guilde : 7');
    expect(screen.getByTestId('chapter-unlocked')).toHaveTextContent('Chapitre 2 débloqué');
    await user.click(screen.getByRole('button', { name: 'Retour à la campagne' }));
    expect(back).toBe(1);
  });

  it('un chapitre encore verrouillé n’est pas enregistré, même terminé : il faut d’abord gagner le précédent', () => {
    useCampaignRunStore.getState().start();
    show(finished('marche-aux-ombres', false, 1));
    // Le chapitre 2 est encore verrouillé : sa partie n'est pas enregistrée.
    expect(useCampaignRunStore.getState().run!.attempts).toHaveLength(0);
    act(() => useCampaignRunStore.getState().record(finished('cave-aux-cendres', true, 1)));
    expect(useCampaignRunStore.getState().run!.attempts).toHaveLength(1);
  });

  it('afficher le résultat plusieurs fois n’enregistre la partie qu’une fois', () => {
    useCampaignRunStore.getState().start();
    const g = finished('cave-aux-cendres', false, 2);
    const { unmount } = show(g);
    unmount();
    show(g);
    expect(useCampaignRunStore.getState().run!.attempts).toHaveLength(1);
    expect(screen.getByTestId('chapter-result')).toHaveTextContent('Chapitre perdu');
    expect(screen.queryByTestId('chapter-unlocked')).not.toBeInTheDocument();
  });

  it('un scénario joué hors campagne, ou sans campagne commencée, n’affiche aucun encart de campagne', () => {
    show(finished('cave-aux-cendres', true)); // aucune campagne commencée
    expect(screen.queryByTestId('chapter-result')).not.toBeInTheDocument();
    expect(useCampaignRunStore.getState().run).toBeNull();
  });
});

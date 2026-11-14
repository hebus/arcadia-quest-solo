import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { DICE_PRESETS } from '@/engine/sandbox';
import { useCampaignStore } from '@/stores/campaignStore';
import { defaultContent, useGameStore } from '@/stores/gameStore';
import { useTileStore } from '@/stores/tileStore';
import { App } from './App';

const game = () => useGameStore.getState().game!;
type User = ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  useGameStore.setState({ game: null, startConfig: null, history: [], instructions: [], traces: [], answers: [], error: null, agent: { status: 'ready' }, content: defaultContent(), selectedId: null, placing: null, correctionMode: false, beats: [], script: [] });
  useCampaignStore.setState({ campaign: null, error: null });
  useTileStore.setState({ tiles: [], loaded: true });
});

async function startSandbox(user: User) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
  await user.click(screen.getByRole('button', { name: /Voir le briefing : Terrain d’essai/ }));
  await user.click(screen.getByRole('button', { name: /Commencer l’aventure/ }));
  await screen.findByTestId('sandbox-strip');
}

async function openSandboxMenu(user: User) {
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  await user.click(screen.getByRole('button', { name: /Terrain d’essai/ }));
  return screen.getByRole('dialog', { name: 'Menu de la partie' });
}

describe('terrain d’essai : démarrage', () => {
  it('est proposé avec les scénarios, démarre au tour de guilde en placement libre', async () => {
    const user = userEvent.setup();
    await startSandbox(user);
    expect(game().scenarioId).toBe('terrain-essai');
    expect(game().phase).toBe('GUILD_TURN');
    expect(useGameStore.getState().correctionMode).toBe(true);
    expect(screen.queryByRole('button', { name: 'Démarrer le scénario' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Placement libre/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('un scénario ordinaire n’a ni bande d’essai ni onglet « Terrain d’essai »', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
    await user.click(screen.getByRole('button', { name: /Voir le briefing : Les Braises/ }));
    await user.click(screen.getByRole('button', { name: /Commencer l’aventure/ }));
    await screen.findByRole('img', { name: 'Plateau de jeu' });
    expect(screen.queryByTestId('sandbox-strip')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.queryByRole('button', { name: /Terrain d’essai/ })).not.toBeInTheDocument();
  });

  it('le placement libre se désactive pour jouer normalement', async () => {
    const user = userEvent.setup();
    await startSandbox(user);
    await user.click(screen.getByRole('button', { name: /Placement libre/ }));
    expect(useGameStore.getState().correctionMode).toBe(false);
  });
});

describe('terrain d’essai : outils', () => {
  it('ajouter un monstre : choix du type, le menu se ferme, une case libre le pose, une case occupée est refusée', async () => {
    const user = userEvent.setup();
    await startSandbox(user);
    const menu = await openSandboxMenu(user);
    await user.click(within(menu).getByRole('button', { name: '+ Rôdeur des quais' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByTestId('placing-banner')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cell-0-7')); // un héros s'y tient
    expect(screen.getByTestId('placing-banner')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cell-5-8')); // libre
    expect(game().monsters.find((m) => m.id === 'rodeur2')).toMatchObject({ definitionId: 'rodeur', position: { x: 5, y: 8 }, status: 'board' });
    expect(screen.getByTestId('token-rodeur2')).toBeInTheDocument();
  });

  it('régler les blessures d’un monstre, le passer en garde, le retirer', async () => {
    const user = userEvent.setup();
    await startSandbox(user);
    const menu = await openSandboxMenu(user);
    await user.click(within(menu).getByRole('button', { name: 'Blessures de brute1 : plus' }));
    await user.click(within(menu).getByRole('button', { name: 'Blessures de brute1 : plus' }));
    expect(game().monsters.find((m) => m.id === 'brute1')!.wounds).toBe(2);
    const guard = within(menu).getAllByRole('button', { name: 'Garde' })[2]!; // brute1 est le 3e de la liste
    await user.click(guard);
    expect(game().monsters.find((m) => m.id === 'brute1')!.isGuard).toBe(true);
    await user.click(within(menu).getByRole('button', { name: 'Retirer brute1' }));
    expect(game().monsters.find((m) => m.id === 'brute1')!.status).toBe('removed');
  });

  it('régler les blessures d’un héros', async () => {
    const user = userEvent.setup();
    await startSandbox(user);
    const menu = await openSandboxMenu(user);
    await user.click(within(menu).getByRole('button', { name: 'Blessures de Mira : plus' }));
    expect(game().heroes[0]!.wounds).toBe(1);
  });

  it('dés des monstres : chaque préréglage s’applique et se reconnaît', async () => {
    const user = userEvent.setup();
    await startSandbox(user);
    const menu = await openSandboxMenu(user);
    const group = within(menu).getByRole('group', { name: 'Dés des monstres' });
    expect(within(group).getByRole('button', { name: /Aléatoires/ })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(group).getByRole('button', { name: /Touchent toujours · jeton S1/ }));
    expect(useGameStore.getState().content.attackDie.map((f) => f.symbol)).toEqual(['sword']);
    expect(within(group).getByRole('button', { name: /Touchent toujours · jeton S1/ })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(group).getByRole('button', { name: /Ratent toujours · jeton S2/ }));
    expect(useGameStore.getState().content.attackDie).toEqual(DICE_PRESETS.find((p) => p.id === 'miss-s2')!.faces);
    await user.click(within(group).getByRole('button', { name: /Aléatoires/ }));
    expect(useGameStore.getState().content.attackDie.length).toBeGreaterThan(2);
  });

  it('sauter au tour des monstres depuis la bande, puis le lancer', async () => {
    const user = userEvent.setup();
    await startSandbox(user);
    await user.click(screen.getByRole('button', { name: /Sauter au tour des monstres/ }));
    expect(game().phase).toBe('MONSTER_TURN_SPAWN');
    expect(screen.getByRole('button', { name: 'Lancer le Monster Turn' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sauter au tour des monstres/ })).toBeDisabled(); // plus de tour de guilde
  });

  it('remettre la disposition de départ : positions et phase d’origine, directement au tour de guilde', async () => {
    const user = userEvent.setup();
    await startSandbox(user);
    const start = game().heroes.map((h) => h.position);
    act(() => useGameStore.getState().correct({ kind: 'hero-position', heroId: 'h1', to: { x: 8, y: 0 } }));
    act(() => useGameStore.getState().correct({ kind: 'monster-status', monsterId: 'rodeur1', status: 'removed' }));
    await user.click(screen.getByRole('button', { name: /Sauter au tour des monstres/ }));
    const menu = await openSandboxMenu(user);
    await user.click(within(menu).getByRole('button', { name: /Remettre la disposition de départ/ }));
    expect(game().phase).toBe('GUILD_TURN');
    expect(game().heroes.map((h) => h.position)).toEqual(start);
    expect(game().monsters.find((m) => m.id === 'rodeur1')!.status).toBe('board');
  });
});

describe('terrain d’essai : le déroulement affiché de la phase des monstres', () => {
  it('étapes sur la table d’abord, puis annonce « qui attaque qui », puis dialogue de défense', async () => {
    const user = userEvent.setup();
    await startSandbox(user);
    // Situation : Mira collée au rôdeur 1 ; cartes choisies à la main ; dés qui touchent toujours, jeton S1 ; défense du joueur.
    act(() => {
      useGameStore.getState().setDice(DICE_PRESETS.find((p) => p.id === 'hit-s1')!.faces!, useGameStore.getState().content.defenseDie);
      useGameStore.getState().setSettings({ cardMode: 'physical', defenseRoll: 'physical' });
      useGameStore.getState().correct({ kind: 'hero-position', heroId: 'h1', to: { x: 4, y: 7 } });
    });
    await user.click(screen.getByRole('button', { name: /Sauter au tour des monstres/ }));
    await user.click(screen.getByRole('button', { name: 'Lancer le Monster Turn' }));

    // 1. Le jeton de référence s'affiche en étape de la phase des monstres, avant toute saisie.
    expect(await screen.findByRole('region', { name: /Sur la table/ })).toHaveTextContent('Jeton Spawn de référence');
    expect(screen.getByLabelText('État de la partie')).toHaveTextContent('Phase des monstres · Activation 1');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fait' }));

    // 2. Carte d'activation choisie à la main.
    const cardDialog = await screen.findByRole('dialog', { name: 'Résultat des dés' });
    await user.click(within(cardDialog).getByRole('button', { name: 'Rôdeur des quais' }));

    // 3. Le monstre activé est montré ; l'attaque n'est ni annoncée ni demandée tant que cette étape n'est pas jouée.
    expect(await screen.findByRole('region', { name: /Sur la table/ })).toHaveTextContent('Rôdeur des quais est activé');
    expect(screen.queryByTestId('attack-announcement')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fait' }));

    // 4. Annonce de l'attaque sur le plateau, puis seulement ensuite le dialogue de dés.
    expect(await screen.findByTestId('attack-announcement')).toHaveTextContent('Rôdeur des quais');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Continuer : lancer mes dés/ }));
    expect(await screen.findByRole('dialog', { name: 'Jet de défense' })).toBeInTheDocument();
    // Dés qui touchent toujours : le rôdeur (2 dés) touche 2 fois.
    expect(within(screen.getByRole('dialog')).getAllByTestId('monster-hit')).toHaveLength(2);
  });
});

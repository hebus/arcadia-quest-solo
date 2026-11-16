import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TrackedInstruction } from '@/stores/gameStore';
import { useCampaignStore } from '@/stores/campaignStore';
import { defaultContent, useGameStore } from '@/stores/gameStore';
import { useTileStore } from '@/stores/tileStore';
import { App } from './App';

const C = 56;
const game = () => useGameStore.getState().game!;

beforeEach(() => {
  useGameStore.setState({ game: null, history: [], instructions: [], traces: [], answers: [], error: null, agent: { status: 'ready' }, content: defaultContent(), selectedId: null, placing: null, correctionMode: false, beats: [], script: [] });
  useCampaignStore.setState({ campaign: null, error: null });
  useTileStore.setState({ tiles: [], loaded: true });
});

async function startDemo(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: /Nouvelle partie/ }));
  await user.click(screen.getByRole('button', { name: 'Charger la démo' }));
  await user.click(screen.getByRole('button', { name: '4. Quêtes et deck' }));
  await user.click(screen.getByRole('button', { name: 'Vérifier' }));
  await user.click(screen.getByRole('button', { name: 'Créer la partie' }));
  await user.click(await screen.findByRole('button', { name: 'Démarrer le scénario' }));
}

/** Étape affichée après l'attaque d'un monstre : à jouer sur la table avant tout autre geste. */
const monsterAttackStep = (): TrackedInstruction => ({
  id: 'R1-A1-attack',
  kind: 'attack',
  text: 'Goblin attaque',
  visual: { type: 'attack', attackerId: 'goblin1', targetId: 'h3', wounds: 1 },
  confirmed: false,
});

function mockBoardGeometry() {
  const svg = screen.getByRole('img', { name: 'Plateau de jeu' }) as unknown as Record<string, unknown>;
  const pos = { x: 0, y: 0 };
  svg.getScreenCTM = () => ({ inverse: () => ({}) });
  svg.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform: () => ({ ...pos }) });
  return { svg: svg as unknown as Element, at: (c: { x: number; y: number }) => { pos.x = c.x * C + C / 2; pos.y = c.y * C + C / 2; } };
}

describe('quand un monstre attaque, le héros ne peut que se défendre', () => {
  it('étapes d’attaque du monstre à valider : le héros ne peut ni se déplacer ni viser, même pendant le tour de guilde', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    const start = game().heroes[0]!.position;
    act(() => useGameStore.setState({ instructions: [monsterAttackStep()], selectedId: 'h1' }));
    // Pas de cases atteignables à l'écran, pas de barre d'arme, pas de glisser.
    fireEvent.click(screen.getByTestId('cell-1-6'));
    expect(game().heroes[0]!.position).toEqual(start);
    expect(screen.queryByTestId('board-menu')).not.toBeInTheDocument();
    const { svg, at } = mockBoardGeometry();
    at(start!);
    fireEvent.pointerDown(screen.getByTestId('token-h1'));
    at({ x: 1, y: 6 });
    fireEvent.pointerMove(svg);
    fireEvent.pointerUp(svg);
    expect(game().heroes[0]!.position).toEqual(start);
    expect(useGameStore.getState().error).toBeNull();
  });

  it('les boutons de fin de tour, de repos et d’activation sont retirés tant que l’attaque n’est pas jouée', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    act(() => useGameStore.setState({ instructions: [monsterAttackStep()], selectedId: 'h1' }));
    expect(screen.queryByRole('button', { name: 'Fin de tour' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Repos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activer sans agir' })).not.toBeInTheDocument();
  });

  it('une fois l’étape jouée, le héros peut de nouveau agir', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    act(() => useGameStore.setState({ instructions: [monsterAttackStep()], selectedId: 'h1' }));
    fireEvent.click(screen.getByTestId('cell-1-6'));
    expect(game().heroes[0]!.position).toEqual({ x: 1, y: 8 });
    await user.click(screen.getByRole('button', { name: 'Fait' }));
    fireEvent.click(screen.getByTestId('cell-1-6'));
    expect(game().heroes[0]!.position).toEqual({ x: 1, y: 6 });
  });

  it('pendant l’annonce d’une attaque (réaction Guard), un héros ne peut pas se déplacer : il ne fait que se défendre', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    act(() =>
      useGameStore.setState((st) => ({
        content: { ...st.content, attackDie: [{ symbol: 'sword', melee: true, ranged: false, crit: false, save: false }] },
        game: { ...st.game!, heroes: st.game!.heroes.map((h) => ({ ...h, defense: 2 })), monsters: st.game!.monsters.map((m) => (m.id === 'goblin1' ? { ...m, position: { x: 1, y: 6 } } : m)) },
      })),
    );
    fireEvent.click(screen.getByTestId('token-h3'));
    fireEvent.click(screen.getByTestId('cell-0-7'));
    expect(screen.getByTestId('attack-announcement')).toBeInTheDocument();
    expect(useGameStore.getState().agent.status).toBe('awaiting-input');
    const before = game().heroes[2]!.position;
    // Une case libre et atteignable : sans verrou, ce clic lancerait un second déplacement.
    fireEvent.click(screen.getByTestId('cell-2-7'));
    fireEvent.click(screen.getByTestId('token-h1'));
    expect(game().heroes[2]!.position).toEqual(before);
    expect(useGameStore.getState().agent.status).toBe('awaiting-input');
    expect(screen.getByTestId('attack-announcement')).toBeInTheDocument();
    expect(useGameStore.getState().error).toBeNull();
    // Le seul geste possible : continuer vers le jet de défense.
    await user.click(screen.getByRole('button', { name: /Continuer : lancer mes dés/ }));
    expect(screen.getByRole('region', { name: 'Jet de défense' })).toBeInTheDocument();
  });

  it('garde-fou du store : aucune action de héros ne démarre pendant une saisie en attente', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    const before = game();
    act(() => useGameStore.setState({ agent: { status: 'awaiting-input', request: { kind: 'die', purpose: 'dé de spawn', faces: ['a', 'b'] } } }));
    act(() => useGameStore.getState().moveHero('h1', { x: 1, y: 6 }));
    expect(game()).toBe(before);
    expect(useGameStore.getState().error).toMatch(/saisie est en cours/);
    act(() => useGameStore.getState().clearError());
    act(() => useGameStore.getState().attackHero('h1', [{ monsterId: 'goblin1', wounds: 1 }], 'melee'));
    expect(game()).toBe(before);
    expect(useGameStore.getState().error).toMatch(/saisie est en cours/);
  });

  it('le déplacement que le joueur vient de faire lui-même ne bloque pas la suite (il peut encore attaquer)', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    fireEvent.click(screen.getByTestId('token-h1'));
    fireEvent.click(screen.getByTestId('cell-1-6'));
    expect(useGameStore.getState().instructions.some((i) => !i.confirmed && i.kind === 'move')).toBe(true);
    fireEvent.click(screen.getByTestId('token-h1')); // 1re touche : valide l'étape de déplacement
    fireEvent.click(screen.getByTestId('token-h1')); // 2e touche : boutons d'attaque
    expect(screen.getByTestId('board-menu')).toBeInTheDocument(); // les boutons d'attaque restent proposés
  });
});

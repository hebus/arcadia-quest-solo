import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCampaignStore } from '@/stores/campaignStore';
import { defaultContent, useGameStore } from '@/stores/gameStore';
import { useTileStore } from '@/stores/tileStore';
import { App } from './App';

const C = 56;
const game = () => useGameStore.getState().game!;

beforeEach(() => {
  useGameStore.setState({
    game: null,
    history: [],
    instructions: [],
    traces: [],
    answers: [],
    error: null,
    agent: { status: 'ready' },
    content: defaultContent(),
    selectedId: null,
    placing: null,
    correctionMode: false,
  });
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

/** jsdom n'a pas de géométrie SVG : conversion écran → plateau pilotée par le test. */
function mockBoardGeometry() {
  const svg = screen.getByRole('img', { name: 'Plateau de jeu' }) as unknown as Record<string, unknown>;
  const pos = { x: 0, y: 0 };
  svg.getScreenCTM = () => ({ inverse: () => ({}) });
  svg.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform: () => ({ ...pos }) });
  return {
    svg: svg as unknown as Element,
    at: (cell: { x: number; y: number }) => {
      pos.x = cell.x * C + C / 2;
      pos.y = cell.y * C + C / 2;
    },
  };
}

describe('synchronisation visuelle plateau / table', () => {
  it('le tableau de bord montre des pions, jamais de coordonnées', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    const status = screen.getByLabelText('État de la partie');
    expect(status.parentElement).not.toHaveTextContent(/\(\d+,\d+\)/);
    await user.click(screen.getByRole('button', { name: /Repérer Grom/ }));
    expect(useGameStore.getState().selectedId).toBe('h1');
  });

  it('mode correction : glisser un héros sur le plateau recale sa position, sans règle de déplacement', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    useGameStore.getState().setCorrectionMode(true);
    const heroFrom = game().heroes[0]!.position!;
    const { svg, at } = mockBoardGeometry();
    at(heroFrom);
    fireEvent.pointerDown(await screen.findByTestId('token-h1'));
    at({ x: 4, y: 0 }); // très loin : hors de portée en jeu normal, permis en correction (case libre)
    fireEvent.pointerMove(svg);
    fireEvent.pointerUp(svg);
    expect(game().heroes[0]!.position).toEqual({ x: 4, y: 0 });
  });

  it('mode correction : lâcher un pion sur une case pleine est refusé (deux figurines au maximum par case)', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    useGameStore.getState().setCorrectionMode(true);
    const heroFrom = game().heroes[0]!.position!;
    const occupiedBy = game().heroes[1]!.position!; // un autre héros, rejoint par le 3e : la case est pleine
    useGameStore.setState((st) => ({ game: { ...st.game!, heroes: st.game!.heroes.map((h) => (h.id === 'h3' ? { ...h, position: { ...occupiedBy } } : h)) } }));
    const { svg, at } = mockBoardGeometry();
    at(heroFrom);
    fireEvent.pointerDown(await screen.findByTestId('token-h1'));
    at(occupiedBy);
    fireEvent.pointerMove(svg);
    fireEvent.pointerUp(svg);
    expect(game().heroes[0]!.position).toEqual(heroFrom);
  });

  it('pose : la bannière montre la figurine, un tap sur une case la place, puis la bannière disparaît', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    let placed: { x: number; y: number } | null = null;
    useGameStore.getState().startPlacing({ actorId: 'h1', onPlace: (to) => (placed = to) });
    expect(await screen.findByTestId('placing-banner')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cell-4-4'));
    expect(placed).toEqual({ x: 4, y: 4 });
    expect(screen.queryByTestId('placing-banner')).not.toBeInTheDocument();
  });

  it('repos : un héros mort revient à la case touchée sur le plateau (aucune saisie x/y)', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    useGameStore.getState().correct({ kind: 'hero-dead', heroId: 'h1', dead: true });
    expect(screen.queryByLabelText('Grom x')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Repos' }));
    expect(await screen.findByTestId('placing-banner')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cell-2-2'));
    expect(game().heroes[0]!.dead).toBe(false);
    expect(game().heroes[0]!.position).toEqual({ x: 2, y: 2 });
  });

  it('un monstre ne se glisse pas hors du mode correction', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    const before = game().monsters.find((m) => m.position)?.position;
    const monster = game().monsters.find((m) => m.position)!;
    const { svg, at } = mockBoardGeometry();
    at(monster.position!);
    fireEvent.pointerDown(await screen.findByTestId(`token-${monster.id}`));
    at({ x: 0, y: 0 });
    fireEvent.pointerMove(svg);
    fireEvent.pointerUp(svg);
    expect(game().monsters.find((m) => m.id === monster.id)!.position).toEqual(before);
  });

  it('toucher la case de destination valide l’étape, sans passer par le bouton « Fait »', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    fireEvent.click(screen.getByTestId('token-h1'));
    fireEvent.click(screen.getByTestId('cell-1-6'));
    expect(useGameStore.getState().instructions.filter((i) => !i.confirmed)).toHaveLength(1);
    expect(screen.getByTestId('ghost-h1')).toBeInTheDocument();
    // Une autre case ne valide rien.
    fireEvent.click(screen.getByTestId('cell-5-5'));
    expect(useGameStore.getState().instructions.filter((i) => !i.confirmed)).toHaveLength(1);
    // La case du fantôme valide l'étape : le fantôme disparaît.
    fireEvent.click(screen.getByTestId('cell-1-6'));
    expect(useGameStore.getState().instructions.filter((i) => !i.confirmed)).toHaveLength(0);
    expect(screen.queryByTestId('ghost-h1')).not.toBeInTheDocument();
  });

  it('glisser un héros sur un monstre déclare l’attaque ; le type se déduit quand un seul est possible', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    // Archer de la démo : monstre posé près de Zazu (h3), puis plus loin pour tester la distance.
    const place = (at: { x: number; y: number }) =>
      useGameStore.setState((st) => ({ game: { ...st.game!, monsters: st.game!.monsters.map((m) => (m.id === 'goblin1' ? { ...m, position: at } : m)) } }));
    const h3 = game().heroes[2]!.position!;
    place({ x: h3.x, y: h3.y - 1 }); // adjacent
    const { svg, at } = mockBoardGeometry();
    at(h3);
    fireEvent.pointerDown(await screen.findByTestId('token-h3'));
    at({ x: h3.x, y: h3.y - 1 });
    fireEvent.pointerMove(svg);
    expect(screen.getByTestId('drag-line')).toHaveAttribute('data-hostile', 'true');
    fireEvent.pointerUp(svg);
    expect(await screen.findByText('Zazu attaque')).toBeInTheDocument();
    expect(useGameStore.getState().selectedId).toBe('h3');
    // Adjacent avec ligne de vue : mêlée et distance sont possibles, le choix est proposé.
    expect(screen.getByRole('radio', { name: /Corps à corps/ })).toBeInTheDocument();
  });

  it('cible à distance seulement : le type est déduit, aucun choix demandé', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    useGameStore.setState((st) => ({ game: { ...st.game!, monsters: st.game!.monsters.map((m) => (m.id === 'goblin1' ? { ...m, position: { x: 1, y: 0 } } : m)) } }));
    fireEvent.click(screen.getByTestId('token-h3'));
    fireEvent.click(screen.getByTestId('token-h3'));
    fireEvent.click(screen.getByTestId('menu-ranged'));
    fireEvent.click(screen.getByTestId('token-goblin1'));
    expect(await screen.findByText('Zazu attaque')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    const dialog = screen.getByRole('region', { name: 'Zazu attaque' });
    expect(within(dialog).getByText(/Distance|Hors de portée/)).toBeInTheDocument();
  });

  it('arme choisie avant la cible : corps à corps = cases adjacentes, distance = trait visible entre les centres', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    const [a, b, c] = game().monsters.filter((m) => m.position);
    // Zazu (h3) en (1,7) ; le monstre `a` en (1,4) ; les monstres `b` et `c` en (1,5) : deux ennemis sur une case coupent le trait.
    useGameStore.setState((st) => ({
      game: {
        ...st.game!,
        monsters: st.game!.monsters.map((m) => (m.id === a!.id ? { ...m, position: { x: 1, y: 4 } } : m.id === b!.id || m.id === c!.id ? { ...m, position: { x: 1, y: 5 } } : m)),
      },
    }));
    fireEvent.click(screen.getByTestId('token-h3'));
    fireEvent.click(screen.getByTestId('token-h3'));
    await user.click(screen.getByTestId('menu-ranged'));
    // Les traits partent du centre de la case du héros : gris vers la cible cachée, rouge vers la visible.
    const lines = screen.getAllByTestId('sight-line');
    expect(lines.some((l) => l.getAttribute('data-tone') === 'blocked')).toBe(true);
    expect(lines.some((l) => l.getAttribute('data-tone') === 'clear')).toBe(true);
    // Viser la cible cachée derrière un personnage : refusé avec une explication, pas de dialogue.
    fireEvent.click(screen.getByTestId(`token-${a!.id}`));
    expect(screen.getByText(/Pas de ligne de vue/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Zazu attaque' })).not.toBeInTheDocument();
    // Le monstre qui coupe le trait, lui, est visible : le viser ouvre l'attaque, type imposé, sans choix à faire.
    fireEvent.click(screen.getByTestId(`token-${b!.id}`));
    expect(await screen.findByRole('region', { name: 'Zazu attaque' })).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    // Au corps à corps, ce même monstre (à 2 cases) n'est pas atteignable.
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    await user.click(screen.getByTestId('menu-melee'));
    fireEvent.click(screen.getByTestId(`token-${b!.id}`));
    expect(screen.getByText(/Hors de portée : le corps à corps/)).toBeInTheDocument();
  });

  it('2e touche sur le héros : boutons Mêlée / Distance ; 3e touche : ils disparaissent', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    fireEvent.click(screen.getByTestId('token-h3'));
    expect(screen.queryByTestId('board-menu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('token-h3'));
    expect(screen.getByTestId('menu-melee')).toBeInTheDocument();
    expect(screen.getByTestId('menu-ranged')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('menu-ranged'));
    expect(screen.getAllByTestId('sight-line').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('token-h3'));
    expect(screen.queryByTestId('board-menu')).not.toBeInTheDocument();
    expect(screen.queryAllByTestId('sight-line')).toHaveLength(0);
    expect(useGameStore.getState().selectedId).toBe('h3');
  });

  it('chaque monstre du plateau porte la pastille de son attaque', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    const onBoard = game().monsters.filter((m) => m.status === 'board');
    expect(onBoard.length).toBeGreaterThan(0);
    for (const m of onBoard) expect(screen.getByTestId(`attack-badge-${m.id}`)).toBeInTheDocument();
    expect(screen.getByTestId('attack-badge-goblin1')).toHaveTextContent('⚔2'); // Goblin : mêlée, 2 dés
  });

  it('pose : une case pleine est refusée et la bannière reste ; une case avec une seule figurine ou libre est acceptée', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    let placed: { x: number; y: number } | null = null;
    useGameStore.getState().startPlacing({ actorId: 'h1', onPlace: (to) => (placed = to) });
    expect(await screen.findByTestId('placing-banner')).toBeInTheDocument();
    const h2 = game().heroes[1]!.position!;
    // Le 3e héros rejoint le 2e : la case est pleine.
    act(() => useGameStore.setState((st) => ({ game: { ...st.game!, heroes: st.game!.heroes.map((h) => (h.id === 'h3' ? { ...h, position: { ...h2 } } : h)) } })));
    fireEvent.click(screen.getByTestId(`cell-${h2.x}-${h2.y}`)); // case pleine
    expect(placed).toBeNull();
    expect(screen.getByTestId('placing-banner')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cell-4-0')); // case libre
    expect(placed).toEqual({ x: 4, y: 0 });
    expect(screen.queryByTestId('placing-banner')).not.toBeInTheDocument();
  });
});


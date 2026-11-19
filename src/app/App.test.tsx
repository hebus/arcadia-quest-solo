import { parse } from '@/engine/domain/validate';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { TileDefSchema, effectiveWalls } from '@/engine/tiles';
import { useCampaignStore } from '@/stores/campaignStore';
import { defaultContent, useGameStore } from '@/stores/gameStore';
import { useTileStore } from '@/stores/tileStore';
import { App } from './App';

type User = ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  useGameStore.setState({ game: null, history: [], instructions: [], traces: [], answers: [], error: null, agent: { status: 'ready' }, content: defaultContent(), selectedId: null });
  useCampaignStore.setState({ campaign: null, error: null });
  useTileStore.setState({ tiles: [], loaded: true });
});

async function createDemoGame(user: User) {
  await user.click(screen.getByRole('button', { name: /Nouvelle partie/ }));
  await user.click(screen.getByRole('button', { name: 'Charger la démo' }));
  await user.click(screen.getByRole('button', { name: '4. Quêtes et deck' }));
  await user.click(screen.getByRole('button', { name: 'Vérifier' }));
  await user.click(screen.getByRole('button', { name: 'Créer la partie' }));
}

const game = () => useGameStore.getState().game!;

describe('App', () => {
  it('affiche le titre et l accueil', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /Arcadia Quest Solo Companion/ })).toBeInTheDocument();
    expect(screen.getByText(/Aucune partie sauvegardée/)).toBeInTheDocument();
  });

  it('parcours complet : clic sur le héros puis sur la case, tour de guilde, Monster Turn', async () => {
    const user = userEvent.setup();
    render(<App />);
    await createDemoGame(user);
    await user.click(await screen.findByRole('button', { name: 'Démarrer le scénario' }));

    // Déplacement au clic : sélection du héros puis case atteignable (2 PM).
    fireEvent.click(screen.getByTestId('token-h1'));
    expect(screen.getByText(/Grom : 3\/3 PM/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cell-1-6'));
    expect(game().heroes[0]!.position).toEqual({ x: 1, y: 6 });
    expect(game().heroTurn.h1).toMatchObject({ mpLeft: 1, moved: true });
    expect(game().activatedHeroIds).toContain('h1');
    // L'étape est montrée visuellement : fantôme à la case cible, flèche sur le trajet, aucune coordonnée en texte.
    expect(screen.getByTestId('instruction-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('ghost-h1')).toBeInTheDocument();
    expect(screen.getByTestId('instruction-arrow')).toBeInTheDocument();
    expect(screen.getByTestId('instruction-step')).not.toHaveTextContent(/\(\d+,\d+\)/);

    await user.click(screen.getByRole('button', { name: 'Fait' }));
    // Règle « un héros par tour » : Grom est activé, les deux autres ne peuvent plus l'être ce tour-ci.
    expect(screen.getByRole('button', { name: /Repérer Maya/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Repérer Zazu/ })).toBeDisabled();
    // Un jet de spawn sans jeton correspondant ne fait rien (pas de relance) : la graine est fixée pour que les dés tombent sur un jeton.
    // L'ordre des cartes d'activation, lui, est tiré au hasard à la création de la partie : la défense des héros est numérique ici,
    // pour que le tour des monstres aille toujours jusqu'au bout, quel que soit le monstre qui attaque.
    act(() => {
      useGameStore.getState().setSettings({ defenseRoll: 'digital' });
      useGameStore.setState((st) => ({ game: { ...st.game!, rngSeed: 1 } }));
    });
    // « Fin de tour » passe la main aux monstres et lance leur tour directement : bandeau « Tour des monstres ».
    await user.click(screen.getByRole('button', { name: 'Fin de tour' }));
    expect(screen.getByLabelText('État de la partie')).toHaveTextContent('Manche 2');
    expect(screen.getByTestId('turn-banner')).toHaveAttribute('data-side', 'monsters');
    expect(screen.getByTestId('turn-banner')).toHaveTextContent('Tour des monstres');
    // Tant que les étapes du tour des monstres ne sont pas toutes jouées sur la table, c'est encore leur tour.
    expect(screen.queryByRole('button', { name: 'Fin de tour' })).not.toBeInTheDocument();
    act(() => useGameStore.getState().confirmAll());
    // Tour des monstres terminé : bandeau « Tour des héros ».
    expect(screen.getByTestId('turn-banner')).toHaveAttribute('data-side', 'heroes');
    expect(screen.getByTestId('turn-banner')).toHaveTextContent('Tour des héros');
    expect(screen.getByRole('button', { name: 'Fin de tour' })).toBeInTheDocument();
    // Les décisions de l'agent ne s'affichent plus en permanence : un dialogue les montre à la demande.
    expect(screen.queryByRole('region', { name: /Décisions de l'agent/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Décisions de l'agent \(/ }));
    const decisions = screen.getByRole('region', { name: /Décisions de l'agent/ });
    expect(within(decisions).getAllByRole('listitem').length).toBeGreaterThan(0);
  });

  it('refuse une case hors de portée et ne bouge pas le héros', async () => {
    const user = userEvent.setup();
    render(<App />);
    await createDemoGame(user);
    await user.click(await screen.findByRole('button', { name: 'Démarrer le scénario' }));
    fireEvent.click(screen.getByTestId('token-h1'));
    fireEvent.click(screen.getByTestId('cell-8-0'));
    expect(game().heroes[0]!.position).toEqual({ x: 1, y: 8 });
  });

  it('Guard : le joueur saisit les coups parés au clic de déplacement', async () => {
    const user = userEvent.setup();
    render(<App />);
    await createDemoGame(user);
    await user.click(await screen.findByRole('button', { name: 'Démarrer le scénario' }));
    useGameStore.setState((s) => ({
      // Dés d'attaque qui touchent toujours : le gobelin (2 dés) touche 2 fois, sans dépendre du hasard.
      content: { ...s.content, attackDie: [{ symbol: 'sword', melee: true, ranged: false, crit: false, save: false }] },
      game: {
        ...s.game!,
        heroes: s.game!.heroes.map((h) => ({ ...h, defense: 2 })),
        monsters: s.game!.monsters.map((m) => (m.id === 'goblin1' ? { ...m, position: { x: 1, y: 6 } } : m)),
      },
    }));
    fireEvent.click(screen.getByTestId('token-h3'));
    fireEvent.click(screen.getByTestId('cell-0-7'));
    // Avant le dialogue de dés, le plateau montre qui attaque qui ; on continue ensuite.
    expect(screen.getByTestId('attack-announcement')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Continuer : lancer mes dés/ }));
    const prompt = screen.getByRole('group', { name: 'Saisie requise' });
    expect(prompt).toHaveTextContent(/touche Zazu 2 fois/);
    expect(game().heroes[2]!.position).toEqual({ x: 1, y: 7 });
    // Aucun dé de défense touché = 0 coup paré : on valide directement.
    expect(within(prompt).getByRole('group', { name: 'Boucliers' })).toBeInTheDocument();
    await user.click(within(prompt).getByRole('button', { name: 'Valider' }));
    expect(screen.queryByRole('group', { name: 'Saisie requise' })).toBeNull();
    const zazu = game().heroes[2]!;
    expect(zazu.dead || (zazu.position!.x === 0 && zazu.position!.y === 7)).toBe(true);
    expect(game().events.some((e) => e.type === 'wound' || e.message.includes('Réaction Guard') || e.type === 'hero-move')).toBe(true);
  });

  it('attaque en touchant un monstre : cible validée, Payback calculé', async () => {
    const user = userEvent.setup();
    render(<App />);
    await createDemoGame(user);
    await user.click(await screen.findByRole('button', { name: 'Démarrer le scénario' }));
    useGameStore.setState((s) => ({
      game: { ...s.game!, monsters: s.game!.monsters.map((m) => (m.id === 'goblin1' ? { ...m, position: { x: 1, y: 6 } } : m)) },
    }));
    fireEvent.click(screen.getByTestId('token-h3'));
    fireEvent.click(screen.getByTestId('token-h3'));
    fireEvent.click(screen.getByTestId('menu-ranged'));
    fireEvent.click(screen.getByTestId('token-goblin1'));
    expect(screen.getByRole('region', { name: 'Combat' })).toBeInTheDocument();
    // Le joueur a lancé ses dés : il indique les blessures subies par le gobelin (4 = tué sur le coup, sans riposte).
    for (let i = 0; i < 4; i++) await user.click(screen.getByRole('button', { name: 'Blessures de goblin1 : plus' }));
    expect(screen.getByLabelText('Blessures de goblin1 : valeur')).toHaveTextContent('4');
    expect(screen.getByText(/tué sur le coup/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Résoudre l'attaque/ }));
    expect(game().heroTurn.h3!.attacked).toBe(true);
    expect(game().monsters.find((m) => m.id === 'goblin1')!.status).toBe('spawn-tile');
    expect(game().coins).toBe(1);
  });

  it('mode cartes matérielles : l agent demande la saisie puis reprend seul', async () => {
    const user = userEvent.setup();
    render(<App />);
    await createDemoGame(user);
    useGameStore.getState().setSettings({ cardMode: 'physical' });
    await user.click(await screen.findByRole('button', { name: 'Démarrer le scénario' }));
    await user.click(screen.getByRole('button', { name: /Repérer Grom/ }));
    await user.click(screen.getByRole('button', { name: 'Activer sans agir' }));
    await user.click(screen.getByRole('button', { name: 'Fin de tour' }));
    const prompt = screen.getByRole('group', { name: 'Saisie requise' });
    expect(prompt).toHaveTextContent(/Carte Monster Activation/);
    expect(useGameStore.getState().agent.status).toBe('awaiting-input');
    // La carte choisie est mémorisée et l'agent reprend seul : il montre les étapes de l'activation.
    await user.click(within(prompt).getAllByRole('button')[0]!);
    expect(useGameStore.getState().answers).toHaveLength(1);
    expect(screen.queryByRole('group', { name: 'Saisie requise' })).not.toBeInTheDocument();
  });

  it('mise en place : poser une tuile, un héros et un monstre sur le plateau', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Nouvelle partie/ }));
    await user.click(screen.getByRole('button', { name: '3. Plateau' }));
    expect(screen.getByText(/Posez au moins une tuile/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Emplacement 1,1' }));
    await user.selectOptions(screen.getByLabelText('Tuile'), '__blank');
    expect(screen.getByTestId('cell-2-2')).toBeInTheDocument();
    expect(screen.queryByTestId('cell-3-0')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Héros' }));
    fireEvent.click(screen.getByTestId('cell-1-1'));
    expect(screen.getByRole('button', { name: /Héros 1 \(1,1\)/ })).toBeInTheDocument();
    expect(screen.getByTestId('token-hero-0')).toBeInTheDocument();
  });

  it('mise en place : portes et murs se tracent en touchant les arêtes', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Nouvelle partie/ }));
    await user.click(screen.getByRole('button', { name: '3. Plateau' }));
    await user.click(screen.getByRole('button', { name: 'Emplacement 1,1' }));
    await user.selectOptions(screen.getByLabelText('Tuile'), '__blank');
    await user.click(screen.getByRole('button', { name: 'Porte' }));
    fireEvent.click(screen.getByTestId('edge-0,0-1,0'));
    expect(screen.getByTestId('door-d1-0010')).toHaveAttribute('stroke', '#b45309');
    fireEvent.click(screen.getByTestId('edge-0,0-1,0'));
    expect(screen.getByTestId('door-d1-0010')).toHaveAttribute('stroke', '#22c55e');
    fireEvent.click(screen.getByTestId('edge-0,0-1,0'));
    expect(screen.queryByTestId('door-d1-0010')).toBeNull();
  });

  it('vérification : plateau vide ou héros non placés signalés', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Nouvelle partie/ }));
    await user.click(screen.getByRole('button', { name: '4. Quêtes et deck' }));
    await user.click(screen.getByRole('button', { name: 'Vérifier' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Posez au moins une tuile/);
  });

  it('bibliothèque de tuiles : tracer un mur sur le scan', async () => {
    const user = userEvent.setup();
    useTileStore.setState({ tiles: [parse(TileDefSchema, { id: '1A', name: '1A', walls: [] })], loaded: true });
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Bibliothèque de tuiles' }));
    await user.click(screen.getByRole('button', { name: 'Face 1A' }));
    await user.click(screen.getByRole('button', { name: 'Murs' }));
    fireEvent.click(screen.getByTestId('edge-0,0-1,0'));
    expect(useTileStore.getState().tiles[0]!.walls).toHaveLength(1);
    fireEvent.click(screen.getByTestId('edge-0,0-1,0'));
    expect(useTileStore.getState().tiles[0]!.walls).toHaveLength(0);
  });

  it("tuile de rue par défaut ; cases d'intérieur = bâtiment muré, portes et murs modifiables", async () => {
    const user = userEvent.setup();
    useTileStore.setState({ tiles: [parse(TileDefSchema, { id: '1A', name: '1A' })], loaded: true });
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Bibliothèque de tuiles' }));
    await user.click(screen.getByRole('button', { name: 'Face 1A' }));
    expect(screen.getByText(/aucun \(toutes les cases sont de la rue\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cell-1-1'));
    fireEvent.click(screen.getByTestId('cell-1-2'));
    expect(screen.getByText(/bâtiment 1 \(2 cases\)/)).toBeInTheDocument();
    expect(useTileStore.getState().tiles[0]!.interior).toHaveLength(2);
    // Contour muré automatiquement : 6 arêtes autour d'un bâtiment de 2 cases.
    expect(effectiveWalls(useTileStore.getState().tiles[0]!)).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Face 1A' })).toHaveTextContent('1 bât.');
    await user.click(screen.getByRole('button', { name: 'Portes' }));
    fireEvent.click(screen.getByTestId('edge-1,0-1,1'));
    expect(useTileStore.getState().tiles[0]!.doors).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Murs' }));
    fireEvent.click(screen.getByTestId('edge-0,2-1,2'));
    expect(useTileStore.getState().tiles[0]!.openedWalls).toHaveLength(1);
    expect(effectiveWalls(useTileStore.getState().tiles[0]!)).toHaveLength(5);
  });

  it('éditeur des 9 tuiles : une face se crée au toucher, zone de départ des héros et bâtiments se définissent', async () => {
    const user = userEvent.setup();
    useTileStore.setState({ tiles: [], loaded: true });
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Bibliothèque de tuiles' }));
    // Le catalogue montre les 9 tuiles, recto (A) et verso (B).
    const catalog = screen.getByRole('table', { name: 'Catalogue des tuiles' });
    expect(within(catalog).getAllByRole('button')).toHaveLength(18);
    expect(screen.getByText(/0 \/ 18 faces définies/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Face 3B' }));
    expect(useTileStore.getState().tiles.map((t) => t.id)).toEqual(['3B']);
    expect(screen.getByText(/Face 3B \(verso\)/)).toBeInTheDocument();
    // Zone de départ des héros : trois cases.
    await user.click(screen.getByRole('button', { name: 'Départ des héros' }));
    for (const c of ['cell-0-2', 'cell-1-2', 'cell-2-2']) fireEvent.click(screen.getByTestId(c));
    expect(useTileStore.getState().tiles[0]!.heroStart).toEqual([{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }]);
    fireEvent.click(screen.getByTestId('cell-1-2')); // retouche : retirée
    expect(useTileStore.getState().tiles[0]!.heroStart).toHaveLength(2);
    // Bâtiment : cases d'intérieur.
    await user.click(screen.getByRole('button', { name: 'Bâtiments' }));
    fireEvent.click(screen.getByTestId('cell-1-0'));
    expect(useTileStore.getState().tiles[0]!.interior).toEqual([{ x: 1, y: 0 }]);
    expect(screen.getByRole('button', { name: 'Face 3B' })).toHaveTextContent('1 bât. · 2 dép.');
    expect(screen.getByText(/1 \/ 18 faces définies/)).toBeInTheDocument();
  });

  it('éditeur des tuiles : exporter puis importer les définitions des faces', async () => {
    const user = userEvent.setup();
    const tiles = [parse(TileDefSchema, { id: '2A', name: '2A', interior: [{ x: 1, y: 1 }], heroStart: [{ x: 0, y: 2 }] })];
    useTileStore.setState({ tiles, loaded: true });
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Bibliothèque de tuiles' }));
    // Export : un fichier JSON avec toutes les tuiles.
    let blob: Blob | null = null;
    URL.createObjectURL = (b: Blob | MediaSource) => ((blob = b as Blob), 'blob:test');
    URL.revokeObjectURL = () => undefined;
    HTMLAnchorElement.prototype.click = () => undefined;
    await user.click(screen.getByRole('button', { name: 'Exporter' }));
    const exported = JSON.parse(await blob!.text()) as { tiles: unknown[] };
    expect(exported.tiles).toHaveLength(1);
    // Import : les définitions du fichier remplacent / complètent la bibliothèque.
    useTileStore.setState({ tiles: [], loaded: true });
    const file = new File([JSON.stringify(exported)], 'tuiles.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText('Fichier de tuiles'), { target: { files: [file] } });
    expect(await screen.findByText(/1 tuile\(s\) importée\(s\)/)).toBeInTheDocument();
    expect(useTileStore.getState().tiles[0]).toMatchObject({ id: '2A', interior: [{ x: 1, y: 1 }], heroStart: [{ x: 0, y: 2 }] });
    // Un fichier invalide est refusé avec un message.
    fireEvent.change(screen.getByLabelText('Fichier de tuiles'), { target: { files: [new File(['{"tiles": 3}'], 'x.json')] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/invalide/);
  });

  it('guide et paramètres sont accessibles', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Guide et règles' }));
    expect(screen.getByText(/Limites connues/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Accueil/ }));
    await user.click(screen.getByRole('button', { name: 'Paramètres' }));
    expect(screen.getByText(/Faces des dés/)).toBeInTheDocument();
  });
});

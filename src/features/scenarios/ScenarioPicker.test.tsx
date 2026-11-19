import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { useCampaignStore } from '@/stores/campaignStore';
import { defaultContent, useGameStore } from '@/stores/gameStore';
import { useTileStore } from '@/stores/tileStore';
import { HERO_NAMES } from '@/engine/guild';
import { useGuildStore } from '@/stores/guildStore';
import { TEST_GUILD, resetTestGuild } from '@/tests/fixtures/guild';
import { scenarioToSetup } from '@/engine/scenario/definition';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES } from '@/game-data/original';
import { CAVE_AUX_CENDRES_LEGACY } from '@/tests/fixtures/legacyScenario';

beforeEach(() => {
  useGameStore.setState({ game: null, history: [], instructions: [], traces: [], answers: [], error: null, agent: { status: 'ready' }, content: defaultContent(), selectedId: null, placing: null, correctionMode: false });
  useCampaignStore.setState({ campaign: null, error: null });
  useTileStore.setState({ tiles: [], loaded: true });
  resetTestGuild();
});

/** Ces tests portent sur le combat : ils jouent sur l'ancienne géométrie du scénario 1 (plateau écrit à la main, rue dégagée). */
function useLegacyGeometry() {
  act(() => {
    const store = useGameStore.getState();
    store.newGame(scenarioToSetup(CAVE_AUX_CENDRES_LEGACY, { sessionId: 's', difficulty: 'medium', seed: 5, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT), CAVE_AUX_CENDRES_LEGACY.script ?? []);
    store.begin();
  });
}

describe('scénario de l’univers original', () => {
  it('accueil → briefing → héros → partie prête, sans mise en place manuelle', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
    await user.click(screen.getByRole('tab', { name: 'Scénarios uniques' }));
    await user.click(screen.getByRole('button', { name: /Voir le briefing : Les Braises/ }));
    expect(screen.getByText(/Port-Cendre brûle depuis trois nuits/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Aperçu du scénario' })).toBeInTheDocument();
    // La guilde : trois héros, nom et points de vie. Sans nom, impossible de commencer.
    const start = screen.getByRole('button', { name: /Commencer l’aventure/ });
    expect(start).toBeEnabled();
    const second = screen.getByLabelText('Nom du héros 2');
    await user.clear(second);
    expect(start).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Donnez un nom au héros 2');
    await user.type(second, 'Brogan');
    expect(start).toBeEnabled();
    await user.clear(screen.getByLabelText('Nom du héros 1'));
    await user.type(screen.getByLabelText('Nom du héros 1'), 'Mira');
    await user.click(screen.getByRole('button', { name: 'Points de vie du héros 1 : plus' }));
    await user.click(start);

    const g = useGameStore.getState().game!;
    expect(g.scenarioId).toBe('cave-aux-cendres');
    expect(g.heroes.map((h) => [h.name, h.life])).toEqual([['Mira', 4], ['Brogan', 3], ['Zazu', 3]]);
    expect(await screen.findByRole('img', { name: 'Plateau de jeu' })).toBeInTheDocument();
    // Les objectifs sont signalés sur le plateau par des drapeaux.
    for (const id of ['cle', 'brasero', 'seigneur']) expect(screen.getByTestId(`objective-${id}`)).toBeInTheDocument();
  });

  it('le maître de jeu raconte : la clé validée ouvre une fenêtre de récit, puis la victoire affiche l’épilogue', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
    await user.click(screen.getByRole('tab', { name: 'Scénarios uniques' }));
    await user.click(screen.getByRole('button', { name: /Voir le briefing : Les Braises/ }));
    await user.click(screen.getByRole('button', { name: /Commencer l’aventure/ }));
    await user.click(await screen.findByRole('button', { name: 'Démarrer le scénario' }));

    // Le héros se retrouve sur la case de la clé (recalage) : la règle du script se déclenche.
    useGameStore.getState().correct({ kind: 'hero-position', heroId: 'h1', to: { x: 0, y: 3 } });
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Quête accomplie');
    expect(dialog).toHaveTextContent('Reprendre la Clé de Braise');
    expect(useGameStore.getState().game!.quests.find((q) => q.id === 'cle')!.done).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Le seigneur tombe après les autres quêtes : victoire, et le texte de fin du scénario s'affiche.
    useGameStore.setState((s) => ({ game: { ...s.game!, quests: s.game!.quests.map((q) => (q.id === 'seigneur' ? q : { ...q, done: true })) } }));
    useGameStore.getState().correct({ kind: 'monster-status', monsterId: 'M1', status: 'spawn-tile' });
    expect(useGameStore.getState().game!.phase).toBe('SCENARIO_WON');
    // Le Minotaur abattu laisse une carte Récompense : la fenêtre de récit l'annonce avant le résultat.
    expect(await screen.findByRole('dialog')).toHaveTextContent('Récompense');
    expect(useGameStore.getState().game!.rewards).toHaveLength(1);
    // Récompense, puis fin de la quête : les fenêtres de récit se ferment l'une après l'autre.
    while (screen.queryByRole('dialog')) await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(await screen.findByRole('button', { name: /Voir le résultat/ }));
    expect(screen.getByTestId('rewards-won')).toBeInTheDocument();
    expect(screen.getByTestId('outro')).toHaveTextContent('la guilde a tenu');
  });

  it('attaque d’un héros du scénario : le joueur lance ses dés et indique les blessures du monstre', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
    await user.click(screen.getByRole('tab', { name: 'Scénarios uniques' }));
    await user.click(screen.getByRole('button', { name: /Voir le briefing : Les Braises/ }));
    await user.click(screen.getByRole('button', { name: /Commencer l’aventure/ }));
    await user.click(await screen.findByRole('button', { name: 'Démarrer le scénario' }));
    useLegacyGeometry();
    // La riposte du rôdeur demanderait la saisie des boucliers : ce test porte sur l’attaque, la défense est donc numérique ici.
    useGameStore.getState().setSettings({ defenseRoll: 'digital' });
    // Mira (h1) à côté du rôdeur 1, en (3,1).
    useGameStore.getState().correct({ kind: 'hero-position', heroId: 'h1', to: { x: 3, y: 2 } });
    fireEvent.click(screen.getByTestId('token-h1'));
    // Les cartes équipement sont gérées par les joueurs : l'application ne propose que le type d'attaque.
    expect(screen.queryByRole('group', { name: 'Cartes arme' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('token-h1'));
    fireEvent.click(screen.getByTestId('menu-melee'));
    fireEvent.click(screen.getByTestId('token-OM1'));
    expect(await screen.findByRole('region', { name: 'Combat' })).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument(); // le type est celui du bouton choisi
    // L'application ne demande ni coups ni parades, seulement les blessures du monstre.
    const dialog = screen.getByRole('region', { name: 'Combat' });
    expect(within(dialog).queryByText(/Parades/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Blessures de OM1 : plus' }));
    await user.click(within(dialog).getByRole('button', { name: 'Blessures de OM1 : plus' }));
    expect(within(dialog).getByText(/tué \(il peut riposter\)/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Résoudre l'attaque/ }));
    expect(useGameStore.getState().game!.monsters.find((m) => m.id === 'OM1')!.status).not.toBe('board');
  });

  it('le briefing montre une icône par objectif, dans la liste et sur l’aperçu du plateau', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
    await user.click(screen.getByRole('tab', { name: 'Scénarios uniques' }));
    await user.click(screen.getByRole('button', { name: /Voir le briefing : Les Braises/ }));
    const preview = screen.getByRole('img', { name: 'Aperçu du scénario' });
    expect(preview.querySelector('[data-testid="objective-cle"] svg')).toHaveAttribute('data-icon', 'key');
    expect(preview.querySelector('[data-testid="objective-brasero"] svg')).toHaveAttribute('data-icon', 'flame');
    expect(preview.querySelector('[data-testid="objective-seigneur"] svg')).toHaveAttribute('data-icon', 'skull');
    // La liste des objectifs porte les mêmes icônes (hors aperçu).
    const icons = Array.from(document.querySelectorAll('li svg[data-icon]')).map((s) => s.getAttribute('data-icon'));
    expect(icons).toEqual(expect.arrayContaining(['key', 'flame', 'skull']));
  });

  it('le dialogue d’attaque dit si le monstre tombé peut encore riposter ou s’il est retiré directement', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
    await user.click(screen.getByRole('tab', { name: 'Scénarios uniques' }));
    await user.click(screen.getByRole('button', { name: /Voir le briefing : Les Braises/ }));
    await user.click(screen.getByRole('button', { name: /Commencer l’aventure/ }));
    await user.click(await screen.findByRole('button', { name: 'Démarrer le scénario' }));
    useLegacyGeometry();
    // Mira en (6,8) ; rôdeur 1 collé à elle (hors de la ligne de tir) ; rôdeur 2 loin au bout de la rue, hors d'atteinte.
    act(() =>
      useGameStore.setState((st) => ({
        game: {
          ...st.game!,
          heroes: st.game!.heroes.map((h) => (h.id === 'h1' ? { ...h, position: { x: 6, y: 8 } } : h.id === 'h2' ? { ...h, position: { x: 8, y: 5 } } : h.id === 'h3' ? { ...h, position: { x: 8, y: 6 } } : h)),
          monsters: st.game!.monsters.map((m) => (m.id === 'OM1' ? { ...m, position: { x: 6, y: 7 } } : m.id === 'OM2' ? { ...m, position: { x: 0, y: 8 } } : m)),
        },
      })),
    );
    fireEvent.click(screen.getByTestId('token-h1'));
    fireEvent.click(screen.getByTestId('token-h1'));
    fireEvent.click(screen.getByTestId('menu-ranged'));
    fireEvent.click(screen.getByTestId('token-OM2'));
    const far = await screen.findByRole('region', { name: 'Combat' });
    await user.click(within(far).getByRole('button', { name: 'Blessures de OM2 : plus' }));
    await user.click(within(far).getByRole('button', { name: 'Blessures de OM2 : plus' }));
    expect(far).toHaveTextContent('tué : il ne peut pas riposter, retiré directement');
  });

  it('le briefing tient sur une seule page : récit, objectifs, guilde, lancement et plateau ensemble, sans panneaux empilés', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
    await user.click(screen.getByRole('tab', { name: 'Scénarios uniques' }));
    await user.click(screen.getByRole('button', { name: /Voir le briefing : Les Braises/ }));
    const page = screen.getByTestId('briefing-page');
    // Récit, difficulté et cartes héros à gauche, plan à droite.
    const guildSection = within(page).getByRole('region', { name: /Votre guilde/ });
    const plan = within(page).getByRole('img', { name: 'Aperçu du scénario' });
    expect(guildSection.compareDocumentPosition(plan) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const leftColumn = guildSection.parentElement!;
    expect(leftColumn.contains(plan)).toBe(false); // le plan est dans l'autre colonne
    expect(leftColumn.nextElementSibling?.contains(plan)).toBe(true); // colonne de droite
    expect(leftColumn.contains(within(page).getByRole('region', { name: 'Récit' }))).toBe(true);
    expect(leftColumn.contains(within(page).getByRole('button', { name: /Commencer l’aventure/ }))).toBe(true);
    for (const name of ['Récit', 'Objectifs', /Votre guilde/]) expect(within(page).getByRole('region', { name })).toBeInTheDocument();
    expect(within(page).getByRole('img', { name: 'Aperçu du scénario' })).toBeInTheDocument();
    expect(within(page).getByRole('button', { name: /Commencer l’aventure/ })).toBeInTheDocument();
    expect(within(page).getByRole('radiogroup', { name: 'Difficulté' })).toBeInTheDocument(); // difficulté
    // Plus de panneaux empilés (l'ancienne mise en page en avait deux).
    expect(page.querySelectorAll('section[aria-label^="Votre guilde"]')).toHaveLength(1);
  });

  it('la guilde compte trois héros ; chacun n’a qu’un nom et des points de vie (le reste se gère en physique)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
    await user.click(screen.getByRole('tab', { name: 'Scénarios uniques' }));
    await user.click(screen.getByRole('button', { name: /Voir le briefing : Les Braises/ }));
    const guild = screen.getByRole('region', { name: 'Votre guilde' });
    for (const i of [1, 2, 3]) {
      const card = within(guild).getByTestId(`guild-hero-${i}`);
      expect(within(card).getByLabelText(`Nom du héros ${i}`)).toHaveValue(TEST_GUILD[i - 1]!.name);
      expect(within(card).getByRole('group', { name: `Points de vie du héros ${i}` })).toBeInTheDocument();
      expect(card).toHaveTextContent('❤❤❤'); // 3 points de vie par défaut
      expect(card).not.toHaveTextContent(/🛡|⚔|🏹/); // ni dés de défense, ni armes
    }
    expect(within(guild).getAllByRole('textbox')).toHaveLength(3);
    expect(guild).toHaveTextContent('cartes, dés de défense et armes se gèrent en physique');
    // Pas de héros prédéfinis à choisir : ceux du jeu sont une cinquantaine, le joueur saisit les siens.
    expect(screen.queryByRole('button', { name: /Mira|Brogan|Pip|Sora/ })).not.toBeInTheDocument();
  });

  it('sans guilde enregistrée, les trois noms proposés sont tirés au hasard, jamais « Héros N »', async () => {
    useGuildStore.setState({ heroes: useGuildStore.getInitialState().heroes, loaded: true });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
    await user.click(screen.getByRole('tab', { name: 'Scénarios uniques' }));
    await user.click(screen.getByRole('button', { name: /Voir le briefing : Les Braises/ }));
    const names = [1, 2, 3].map((i) => (screen.getByLabelText(`Nom du héros ${i}`) as HTMLInputElement).value);
    expect(new Set(names).size).toBe(3);
    for (const n of names) {
      expect(HERO_NAMES).toContain(n);
      expect(n).not.toMatch(/^Héros \d/);
    }
    expect(screen.getByRole('button', { name: /Commencer l’aventure/ })).toBeEnabled();
  });
});

describe('tuiles du scénario 1', () => {
  it('le numéro de chaque tuile est au centre de la tuile, sur l’aperçu du briefing et sur le plateau de la partie', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
    await user.click(screen.getByRole('tab', { name: 'Scénarios uniques' }));
    await user.click(screen.getByRole('button', { name: /Voir le briefing : Les Braises/ }));
    const preview = screen.getByRole('img', { name: 'Aperçu du scénario' });
    expect(within(preview).getByTestId('tile-label-2-0')).toHaveTextContent('2A'); // la chapelle, en haut à droite
    expect(within(preview).getByTestId('tile-label-0-2')).toHaveTextContent('7A'); // le départ des héros, en bas à gauche
    expect(preview.querySelectorAll('[data-testid^="tile-label-"]')).toHaveLength(9);
    // Pas de liste de tuiles ni d'orientation dans le briefing : les numéros suffisent.
    expect(screen.queryByTestId('tile-assembly')).not.toBeInTheDocument();
    expect(screen.queryByText(/tournée de/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Commencer l’aventure/ }));
    const board = await screen.findByRole('img', { name: 'Plateau de jeu' });
    expect(within(board).getByTestId('tile-label-1-0')).toHaveTextContent('3B');
    expect(board.querySelectorAll('[data-testid^="tile-label-"]')).toHaveLength(9);
  });

  it('un bouton du briefing affiche les tuiles en réduit dans un dialogue, pour aider à construire le plateau', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
    await user.click(screen.getByRole('tab', { name: 'Scénarios uniques' }));
    await user.click(screen.getByRole('button', { name: /Voir le briefing : Les Braises/ }));
    await user.click(screen.getByRole('button', { name: /Voir les tuiles/ }));
    const dialog = screen.getByRole('dialog', { name: 'Tuiles du plateau' });
    const mini = within(dialog).getByRole('img', { name: 'Tuiles du plateau (réduit)' });
    expect(mini.querySelectorAll('[data-testid^="tile-label-"]')).toHaveLength(9);
    expect(within(dialog).getByTestId('tile-label-0-1')).toHaveTextContent('8A');
    await user.click(within(dialog).getByRole('button', { name: /Fermer/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('pendant la partie, le bouton « Voir les tuiles » n’existe plus : ni à la mise en place, ni dans le menu', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
    await user.click(screen.getByRole('tab', { name: 'Scénarios uniques' }));
    await user.click(screen.getByRole('button', { name: /Voir le briefing : Les Braises/ }));
    await user.click(screen.getByRole('button', { name: /Commencer l’aventure/ }));
    // Mise en place de la partie.
    await screen.findByRole('button', { name: 'Démarrer le scénario' });
    expect(screen.queryByRole('button', { name: /Voir les tuiles/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Démarrer le scénario' }));
    expect(screen.queryByRole('button', { name: /Voir les tuiles/ })).not.toBeInTheDocument();
    // Menu de la partie : pas d'onglet « Tuiles ».
    await user.click(screen.getByRole('button', { name: /Menu/ }));
    expect(within(screen.getByRole('navigation', { name: 'Sections du menu' })).queryByRole('button', { name: 'Tuiles' })).not.toBeInTheDocument();
    // Les numéros restent écrits sur le plateau.
    expect(screen.getAllByRole('img', { name: 'Plateau de jeu' })[0]!.querySelectorAll('[data-testid^="tile-label-"]')).toHaveLength(9);
  });
});

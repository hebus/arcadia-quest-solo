import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { useCampaignStore } from '@/stores/campaignStore';
import { defaultContent, useGameStore } from '@/stores/gameStore';
import { useTileStore } from '@/stores/tileStore';

beforeEach(() => {
  useGameStore.setState({ game: null, history: [], instructions: [], traces: [], answers: [], error: null, agent: { status: 'ready' }, content: defaultContent(), selectedId: null, placing: null, correctionMode: false });
  useCampaignStore.setState({ campaign: null, error: null });
  useTileStore.setState({ tiles: [], loaded: true });
});

describe('scénario de l’univers original', () => {
  it('accueil → briefing → héros → partie prête, sans mise en place manuelle', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
    await user.click(screen.getByRole('button', { name: /Voir le briefing : Les Braises/ }));
    expect(screen.getByText(/Port-Cendre brûle depuis trois nuits/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Aperçu du scénario' })).toBeInTheDocument();
    // Trois héros préselectionnés ; en retirer un empêche de commencer.
    const start = screen.getByRole('button', { name: /Commencer l’aventure/ });
    expect(start).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /Pip/ }));
    expect(start).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Sora/ }));
    expect(start).toBeEnabled();
    await user.click(start);

    const g = useGameStore.getState().game!;
    expect(g.scenarioId).toBe('cave-aux-cendres');
    expect(g.heroes.map((h) => h.name)).toEqual(['Mira', 'Brogan', 'Sora']);
    expect(await screen.findByRole('img', { name: 'Plateau de jeu' })).toBeInTheDocument();
    // Les objectifs sont signalés sur le plateau par des drapeaux.
    for (const id of ['cle', 'brasero', 'seigneur']) expect(screen.getByTestId(`objective-${id}`)).toBeInTheDocument();
  });

  it('le maître de jeu raconte : la clé validée ouvre une fenêtre de récit, puis la victoire affiche l’épilogue', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
    await user.click(screen.getByRole('button', { name: /Voir le briefing : Les Braises/ }));
    await user.click(screen.getByRole('button', { name: /Commencer l’aventure/ }));
    await user.click(await screen.findByRole('button', { name: 'Démarrer le scénario' }));

    // Le héros se retrouve sur la case de la clé (recalage) : la règle du script se déclenche.
    useGameStore.getState().correct({ kind: 'hero-position', heroId: 'h1', to: { x: 1, y: 3 } });
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Quête accomplie');
    expect(dialog).toHaveTextContent('Reprendre la Clé de Braise');
    expect(useGameStore.getState().game!.quests.find((q) => q.id === 'cle')!.done).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Le seigneur tombe après les autres quêtes : victoire, et le texte de fin du scénario s'affiche.
    useGameStore.setState((s) => ({ game: { ...s.game!, quests: s.game!.quests.map((q) => (q.id === 'seigneur' ? q : { ...q, done: true })) } }));
    useGameStore.getState().correct({ kind: 'monster-status', monsterId: 'OM6', status: 'spawn-tile' });
    expect(useGameStore.getState().game!.phase).toBe('SCENARIO_WON');
    await user.click(await screen.findByRole('button', { name: /Voir le résultat/ }));
    expect(screen.getByTestId('outro')).toHaveTextContent('la guilde a tenu');
  });

  it('attaque d’un héros du scénario : le joueur lance ses dés et indique les blessures du monstre', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
    await user.click(screen.getByRole('button', { name: /Voir le briefing : Les Braises/ }));
    await user.click(screen.getByRole('button', { name: /Commencer l’aventure/ }));
    await user.click(await screen.findByRole('button', { name: 'Démarrer le scénario' }));
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
    expect(await screen.findByText('Mira attaque')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument(); // le type est celui du bouton choisi
    // L'application ne demande ni coups ni parades, seulement les blessures du monstre.
    const dialog = screen.getByRole('region', { name: 'Mira attaque' });
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
    await user.click(screen.getByRole('button', { name: /Voir le briefing : Les Braises/ }));
    await user.click(screen.getByRole('button', { name: /Commencer l’aventure/ }));
    await user.click(await screen.findByRole('button', { name: 'Démarrer le scénario' }));
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
    const far = await screen.findByRole('region', { name: 'Mira attaque' });
    await user.click(within(far).getByRole('button', { name: 'Blessures de OM2 : plus' }));
    await user.click(within(far).getByRole('button', { name: 'Blessures de OM2 : plus' }));
    expect(far).toHaveTextContent('tué : il ne peut pas riposter, retiré directement');
  });

  it('le briefing tient sur une seule page : récit, objectifs, guilde, lancement et plateau ensemble, sans panneaux empilés', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
    await user.click(screen.getByRole('button', { name: /Voir le briefing : Les Braises/ }));
    const page = screen.getByTestId('briefing-page');
    // Hauteur bornée à celle de la fenêtre sur grand écran : pas de défilement de la page.
    expect(page.className).toContain('lg:h-[calc(100dvh-8rem)]');
    for (const name of ['Récit', 'Objectifs', /Votre guilde/]) expect(within(page).getByRole('region', { name })).toBeInTheDocument();
    expect(within(page).getByRole('img', { name: 'Aperçu du scénario' })).toBeInTheDocument();
    expect(within(page).getByRole('button', { name: /Commencer l’aventure/ })).toBeInTheDocument();
    expect(within(page).getByRole('combobox')).toBeInTheDocument(); // difficulté
    // Plus de panneaux empilés (l'ancienne mise en page en avait deux).
    expect(page.querySelectorAll('section[aria-label^="Votre guilde"]')).toHaveLength(1);
  });

  it('les héros sont des cartes compactes, à la largeur de leur contenu : nom et cœurs sur une ligne', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Jouer un scénario' }));
    await user.click(screen.getByRole('button', { name: /Voir le briefing : Les Braises/ }));
    const mira = screen.getByRole('button', { name: /Mira/ });
    expect(mira).toHaveTextContent('❤❤❤❤');
    expect(mira).not.toHaveTextContent('🛡');
    expect(mira).not.toHaveTextContent('⚔');
    expect(mira).not.toHaveTextContent('🏹');
    expect(mira).toHaveAttribute('title', expect.stringContaining('Lame-de-cendre'));
  });
});


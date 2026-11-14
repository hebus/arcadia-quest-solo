import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '@/engine/domain/schemas';
import { audio } from '@/audio/engine';
import { demoGame } from '@/tests/fixtures/demo';
import { defaultContent, useGameStore } from '@/stores/gameStore';
import { useCampaignStore } from '@/stores/campaignStore';
import { useTileStore } from '@/stores/tileStore';
import { App } from '@/app/App';
import { attachGameAudio, type AudioSink } from './director';
import type { Cue, Mood } from './cues';

const reset = () =>
  useGameStore.setState({ game: null, history: [], instructions: [], traces: [], answers: [], error: null, agent: { status: 'ready' }, content: defaultContent(), selectedId: null, placing: null, correctionMode: false, beats: [], script: [] });

function sink() {
  const plays: Cue[] = [];
  const moods: (Mood | null)[] = [];
  const s: AudioSink = { play: (c) => plays.push(c), setMood: (m) => moods.push(m) };
  return { s, plays, moods };
}

const withEvents = (g: GameState, ...types: string[]): GameState => ({
  ...g,
  eventSeq: g.eventSeq + types.length,
  events: [...g.events, ...types.map((type, i) => ({ seq: g.eventSeq + i + 1, round: g.round, phase: g.phase, type, message: type }))],
});

beforeEach(() => {
  vi.useFakeTimers();
  reset();
});
afterEach(() => vi.useRealTimers());

describe('chef d’orchestre audio', () => {
  it('ne rejoue jamais l’historique d’une partie déjà commencée', () => {
    const g = withEvents(demoGame(), 'hero-move', 'monster-attack');
    useGameStore.setState({ game: g });
    const { s, plays, moods } = sink();
    const off = attachGameAudio(s);
    expect(plays).toEqual([]);
    expect(moods).toEqual(['calm']);
    off();
  });

  it('un nouvel événement déclenche son effet ; plusieurs sons d’une action sont échelonnés', () => {
    const g = demoGame();
    useGameStore.setState({ game: g });
    const { s, plays } = sink();
    const off = attachGameAudio(s);
    act(() => useGameStore.setState({ game: withEvents(g, 'monster-attack') }));
    expect(plays).toEqual(['dice']); // premier son tout de suite
    vi.advanceTimersByTime(500);
    expect(plays).toEqual(['dice', 'hit']); // puis le coup
    off();
  });

  it('le changement de phase change l’ambiance', () => {
    const g = demoGame();
    useGameStore.setState({ game: { ...g, phase: 'GUILD_TURN' } });
    const { s, moods } = sink();
    const off = attachGameAudio(s);
    act(() => useGameStore.setState({ game: { ...useGameStore.getState().game!, phase: 'MONSTER_TURN_SPAWN' } }));
    act(() => useGameStore.setState({ game: { ...useGameStore.getState().game!, phase: 'SCENARIO_WON' } }));
    expect(moods).toEqual(['calm', 'tense', 'victory']);
    off();
  });

  it('une annulation (moins d’événements) ne joue rien ; la suite rejoue normalement', () => {
    const g = withEvents(demoGame(), 'hero-move');
    useGameStore.setState({ game: g });
    const { s, plays } = sink();
    const off = attachGameAudio(s);
    act(() => useGameStore.setState({ game: { ...g, eventSeq: 0, events: [] } }));
    expect(plays).toEqual([]);
    act(() => useGameStore.setState({ game: withEvents({ ...g, eventSeq: 0, events: [] }, 'quest-completed') }));
    expect(plays).toEqual(['quest']);
    off();
  });

  it('une autre partie ne rejoue pas ses événements ; la fermeture coupe la musique', () => {
    const { s, plays, moods } = sink();
    const off = attachGameAudio(s);
    const other = withEvents(demoGame({ sessionId: 'autre' }), 'scenario-won', 'quest-completed');
    act(() => useGameStore.setState({ game: other }));
    expect(plays).toEqual([]);
    expect(moods.at(-1)).toBe('calm');
    off();
    expect(moods.at(-1)).toBeNull();
  });

  it('un moment de récit « danger » a son son, une quête accomplie non (déjà annoncée)', () => {
    useGameStore.setState({ game: demoGame() });
    const { s, plays } = sink();
    const off = attachGameAudio(s);
    act(() => useGameStore.setState({ beats: [{ id: 'b1', text: '…', tone: 'danger' }] }));
    expect(plays).toEqual(['danger']);
    act(() => useGameStore.setState({ beats: [{ id: 'b2', text: '…', tone: 'quest' }] }));
    expect(plays).toEqual(['danger']);
    off();
  });

  it('après le détachement, plus aucun son ne part', () => {
    const g = demoGame();
    useGameStore.setState({ game: g });
    const { s, plays } = sink();
    attachGameAudio(s)();
    act(() => useGameStore.setState({ game: withEvents(g, 'quest-completed') }));
    expect(plays).toEqual([]);
  });
});

describe('contrôles du son dans l’interface', () => {
  beforeEach(() => {
    vi.useRealTimers();
    useCampaignStore.setState({ campaign: null, error: null });
    useTileStore.setState({ tiles: [], loaded: true });
    audio.setMuted(false);
  });
  afterEach(() => audio.setMuted(false));

  async function startDemo(user: ReturnType<typeof userEvent.setup>) {
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Nouvelle partie/ }));
    await user.click(screen.getByRole('button', { name: 'Charger la démo' }));
    await user.click(screen.getByRole('button', { name: '4. Quêtes et deck' }));
    await user.click(screen.getByRole('button', { name: 'Vérifier' }));
    await user.click(screen.getByRole('button', { name: 'Créer la partie' }));
  }

  it('le bouton de la barre d’état coupe et rétablit le son', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    await user.click(await screen.findByRole('button', { name: 'Couper le son' }));
    expect(audio.settings.muted).toBe(true);
    expect(screen.getByRole('button', { name: 'Activer le son' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Activer le son' }));
    expect(audio.settings.muted).toBe(false);
  });

  it('le menu a une section Son avec volumes et écoute des effets', async () => {
    const user = userEvent.setup();
    await startDemo(user);
    await user.click(await screen.findByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('button', { name: 'Son' }));
    const panel = screen.getByRole('region', { name: 'Son' });
    const music = panel.querySelector('input[aria-label="Musique"]') as HTMLInputElement;
    expect(music).toBeInTheDocument();
    fireEvent.change(music, { target: { value: '30' } });
    expect(audio.settings.music).toBeCloseTo(0.3, 1);
    expect(panel.querySelectorAll('button[data-silent]').length).toBeGreaterThanOrEqual(4);
  });
});

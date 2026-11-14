import { afterEach, describe, expect, it, vi } from 'vitest';
import { asContext, FakeAudioContext, MemoryStorage } from '@/tests/fakeAudio';
import { CUES, cueForBeat, cuesForEvents, moodFor } from './cues';
import { AudioEngine, DEFAULT_AUDIO } from './engine';

const ev = (...types: string[]) => types.map((type) => ({ type }));

describe('événements → sons', () => {
  it('chaque événement sonore produit ses effets, les autres rien', () => {
    expect(cuesForEvents(ev('quest-completed'))).toEqual(['quest']);
    expect(cuesForEvents(ev('monster-attack'))).toEqual(['dice', 'hit']);
    expect(cuesForEvents(ev('round-start', 'correction', 'deck-recycled'))).toEqual([]);
    expect(cuesForEvents(ev('scenario-won'))).toEqual(['victory']);
    expect(cuesForEvents(ev('scenario-lost'))).toEqual(['defeat']);
    expect(cuesForEvents(ev('script-door'))).toEqual(['door']);
    expect(cuesForEvents(ev('hero-door'))).toEqual(['door']);
  });

  it('un même son consécutif ne se répète pas, et une action ne produit pas plus de cinq sons', () => {
    expect(cuesForEvents(ev('hero-move', 'hero-move', 'hero-move'))).toEqual(['step']);
    const many = cuesForEvents(ev('hero-move', 'wound', 'hero-move', 'wound', 'hero-move', 'wound', 'spawn-place', 'script-door'));
    expect(many.length).toBeLessThanOrEqual(5);
  });

  it('le récit : danger et récit ont un son, la quête accomplie est déjà annoncée par son événement', () => {
    expect(cueForBeat('danger')).toBe('danger');
    expect(cueForBeat('story')).toBe('story');
    expect(cueForBeat('quest')).toBeNull();
  });

  it('l’ambiance suit la phase : calme chez la guilde, tension pendant les monstres', () => {
    expect(moodFor('GUILD_TURN')).toBe('calm');
    expect(moodFor('SCENARIO_SETUP')).toBe('calm');
    expect(moodFor('MONSTER_TURN_ACTIVATION_1')).toBe('tense');
    expect(moodFor('MONSTER_TURN_SPAWN')).toBe('tense');
    expect(moodFor('SCENARIO_WON')).toBe('victory');
    expect(moodFor('SCENARIO_LOST')).toBe('defeat');
  });
});

describe('moteur audio', () => {
  const make = (storage = new MemoryStorage()) => {
    const ctx = new FakeAudioContext();
    const engine = new AudioEngine(() => asContext(ctx), storage);
    return { ctx, engine, storage };
  };
  afterEach(() => vi.useRealTimers());

  it('aucun contexte audio avant un geste de l’utilisateur ; tout est ignoré', () => {
    const { ctx, engine } = make();
    engine.play('quest');
    engine.setMood('calm');
    expect(engine.unlocked).toBe(false);
    expect(ctx.oscillators).toHaveLength(0);
  });

  it('au déverrouillage : contexte réveillé, et l’ambiance demandée plus tôt démarre', () => {
    vi.useFakeTimers();
    const { ctx, engine } = make();
    engine.setMood('tense'); // demandée avant le geste
    engine.unlock();
    expect(engine.unlocked).toBe(true);
    expect(ctx.resumed).toBe(1);
    expect(ctx.oscillators.length).toBeGreaterThanOrEqual(4); // bourdon (3) + respiration
    engine.dispose();
  });

  it('chaque effet produit du son sans erreur', () => {
    const { ctx, engine } = make();
    engine.unlock();
    for (const cue of CUES) {
      const before = ctx.oscillators.length + ctx.sources;
      expect(() => engine.play(cue)).not.toThrow();
      expect(ctx.oscillators.length + ctx.sources, cue).toBeGreaterThan(before);
    }
  });

  it('muet : plus aucun effet, volume général à zéro ; rétablissable', () => {
    const { ctx, engine } = make();
    engine.unlock();
    engine.setMuted(true);
    expect(ctx.master.gain.value).toBe(0);
    const n = ctx.oscillators.length;
    engine.play('hit');
    expect(ctx.oscillators).toHaveLength(n);
    engine.setMuted(false);
    expect(ctx.master.gain.value).toBe(1);
    engine.play('hit');
    expect(ctx.oscillators.length).toBeGreaterThan(n);
  });

  it('les volumes sont bornés entre 0 et 1', () => {
    const { engine } = make();
    engine.setMusicVolume(3);
    engine.setSfxVolume(-2);
    expect(engine.settings.music).toBe(1);
    expect(engine.settings.sfx).toBe(0);
    engine.setSfxVolume(Number.NaN);
    expect(engine.settings.sfx).toBe(0);
  });

  it('les préférences sont sauvegardées et relues ; un stockage corrompu retombe sur les valeurs par défaut', () => {
    const { engine, storage } = make();
    engine.setMuted(true);
    engine.setMusicVolume(0.25);
    const reread = new AudioEngine(() => null, storage);
    expect(reread.settings).toMatchObject({ muted: true, music: 0.25 });
    storage.setItem('aq-audio', '{pas du json');
    expect(new AudioEngine(() => null, storage).settings).toEqual(DEFAULT_AUDIO);
  });

  it('un stockage qui lève une exception ne casse rien', () => {
    const broken = { getItem: () => { throw new Error('refusé'); }, setItem: () => { throw new Error('refusé'); } };
    const engine = new AudioEngine(() => null, broken);
    expect(engine.settings).toEqual(DEFAULT_AUDIO);
    expect(() => engine.setMuted(true)).not.toThrow();
  });

  it('sans Web Audio (ou s’il refuse), tout reste silencieusement sans effet', () => {
    const none = new AudioEngine(() => null, new MemoryStorage());
    expect(() => { none.unlock(); none.play('quest'); none.setMood('calm'); }).not.toThrow();
    expect(none.unlocked).toBe(false);
    const throwing = new AudioEngine(() => { throw new Error('NotSupported'); }, new MemoryStorage());
    expect(() => throwing.unlock()).not.toThrow();
    expect(throwing.unlocked).toBe(false);
  });

  it('changer d’ambiance estompe l’ancienne puis l’arrête ; la même ambiance ne redémarre pas', () => {
    vi.useFakeTimers();
    const { ctx, engine } = make();
    engine.unlock();
    engine.setMood('calm');
    const first = ctx.oscillators.slice();
    const count = ctx.oscillators.length;
    engine.setMood('calm');
    expect(ctx.oscillators).toHaveLength(count);
    engine.setMood('tense');
    expect(ctx.oscillators.length).toBeGreaterThan(count);
    expect(first.every((o) => !o.stopped)).toBe(true); // encore en fondu
    vi.advanceTimersByTime(2000);
    expect(first.every((o) => o.stopped)).toBe(true);
    engine.dispose();
  });

  it('abonnés prévenus à chaque changement de réglage', () => {
    const { engine } = make();
    const fn = vi.fn();
    const off = engine.subscribe(fn);
    engine.setMuted(true);
    engine.setSfxVolume(0.5);
    expect(fn).toHaveBeenCalledTimes(2);
    off();
    engine.setMuted(false);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

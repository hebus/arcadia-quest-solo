import type { Cue, Mood } from './cues';
import { playCue, startMusic, type MusicHandle } from './synth';

export interface AudioSettings {
  muted: boolean;
  /** Volumes entre 0 et 1. */
  music: number;
  sfx: number;
}

export const DEFAULT_AUDIO: AudioSettings = { muted: false, music: 0.6, sfx: 0.8 };
const STORAGE_KEY = 'aq-audio';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

function defaultContextFactory(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // accès refusé (navigation privée, données bloquées)
  }
}

/**
 * Moteur audio : effets et ambiance, volumes, mode muet. Le navigateur interdit de produire du son avant un geste de
 * l'utilisateur : le contexte audio n'est donc créé qu'à `unlock()`, et tout ce qui est demandé avant est ignoré
 * (l'ambiance voulue est gardée et démarre au déverrouillage). Sans Web Audio, tout est silencieusement sans effet.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private music: MusicHandle | null = null;
  private wanted: Mood | null = null;
  private current: Mood | null = null;
  private listeners = new Set<() => void>();
  private _settings: AudioSettings;

  constructor(
    private readonly createContext: () => AudioContext | null = defaultContextFactory,
    private readonly storage: StorageLike | null = defaultStorage(),
  ) {
    this._settings = this.load();
  }

  get settings(): AudioSettings {
    return this._settings;
  }

  get unlocked(): boolean {
    return this.ctx !== null;
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private load(): AudioSettings {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_AUDIO };
      const p = JSON.parse(raw) as Partial<AudioSettings>;
      return {
        muted: p.muted === true,
        music: typeof p.music === 'number' ? clamp01(p.music) : DEFAULT_AUDIO.music,
        sfx: typeof p.sfx === 'number' ? clamp01(p.sfx) : DEFAULT_AUDIO.sfx,
      };
    } catch {
      return { ...DEFAULT_AUDIO };
    }
  }

  private commit(patch: Partial<AudioSettings>): void {
    this._settings = { ...this._settings, ...patch };
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this._settings));
    } catch {
      /* préférence non sauvegardée : sans conséquence */
    }
    this.applyGains();
    this.listeners.forEach((l) => l());
  }

  private applyGains(): void {
    if (!this.ctx || !this.master || !this.sfxBus || !this.musicBus) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this._settings.muted ? 0 : 1, t, 0.03);
    this.sfxBus.gain.setTargetAtTime(this._settings.sfx, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this._settings.music * 0.7, t, 0.03);
  }

  /** À appeler depuis un geste de l'utilisateur (clic, touche) : crée ou réveille le contexte audio. */
  unlock(): void {
    if (!this.ctx) {
      let ctx: AudioContext | null;
      try {
        ctx = this.createContext();
      } catch {
        return; // Web Audio refusé ou indisponible : le jeu reste silencieux
      }
      if (!ctx) return;
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.master.connect(ctx.destination);
      this.applyGains();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.wanted && this.current !== this.wanted) this.setMood(this.wanted);
  }

  play(cue: Cue): void {
    if (!this.ctx || !this.sfxBus || this._settings.muted) return;
    playCue(this.ctx, this.sfxBus, cue);
  }

  /** Change d'ambiance en fondu ; `null` coupe la musique. L'ambiance voulue est gardée tant que le son n'est pas déverrouillé. */
  setMood(mood: Mood | null): void {
    this.wanted = mood;
    if (!this.ctx || !this.musicBus) return;
    if (mood === this.current && this.music) return;
    this.music?.stop();
    this.music = null;
    this.current = null;
    if (mood) {
      this.music = startMusic(this.ctx, this.musicBus, mood);
      this.current = mood;
    }
  }

  setMuted(muted: boolean): void {
    this.commit({ muted });
  }

  setMusicVolume(v: number): void {
    this.commit({ music: clamp01(v) });
  }

  setSfxVolume(v: number): void {
    this.commit({ sfx: clamp01(v) });
  }

  dispose(): void {
    this.music?.stop(0.05);
    this.music = null;
    this.current = null;
    this.wanted = null;
  }
}

export const audio = new AudioEngine();

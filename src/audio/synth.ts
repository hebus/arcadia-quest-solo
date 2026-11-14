import type { Cue, Mood } from './cues';

/**
 * Sons synthétisés avec l'API Web Audio : aucun fichier à charger. Ce sont des sons simples, faits pour être remplacés
 * un jour par de vrais enregistrements (le reste de l'application ne connaît que les noms de `Cue`).
 */

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseBuffers.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, b);
  }
  return b;
}

interface ToneOpts {
  freq: number;
  to?: number;
  type?: OscillatorType;
  t: number;
  dur: number;
  gain?: number;
  attack?: number;
  /** Filtre passe-bas optionnel pour adoucir un son riche en harmoniques. */
  lowpass?: number;
}

function tone(ctx: BaseAudioContext, dest: AudioNode, o: ToneOpts): void {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, o.t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), o.t + o.dur);
  const peak = o.gain ?? 0.2;
  g.gain.setValueAtTime(0.0001, o.t);
  g.gain.exponentialRampToValueAtTime(peak, o.t + (o.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
  let head: AudioNode = osc;
  if (o.lowpass) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.lowpass;
    osc.connect(f);
    head = f;
  }
  head.connect(g);
  g.connect(dest);
  osc.start(o.t);
  osc.stop(o.t + o.dur + 0.05);
}

interface NoiseOpts {
  t: number;
  dur: number;
  freq: number;
  to?: number;
  type?: BiquadFilterType;
  q?: number;
  gain?: number;
  attack?: number;
}

function noise(ctx: BaseAudioContext, dest: AudioNode, o: NoiseOpts): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = o.type ?? 'bandpass';
  f.frequency.setValueAtTime(o.freq, o.t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), o.t + o.dur);
  f.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, o.t);
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.2, o.t + (o.attack ?? 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  src.start(o.t, Math.random());
  src.stop(o.t + o.dur + 0.05);
}

const hz = (root: number, semitones: number): number => root * 2 ** (semitones / 12);

const CUE_SYNTH: Record<Cue, (c: BaseAudioContext, d: AudioNode, t: number) => void> = {
  click: (c, d, t) => tone(c, d, { freq: 900, to: 500, type: 'triangle', t, dur: 0.05, gain: 0.08 }),

  // Dés qui roulent : une rafale de petits chocs secs.
  dice: (c, d, t) => {
    for (let i = 0; i < 7; i++) noise(c, d, { t: t + i * 0.045 + Math.random() * 0.02, dur: 0.035, freq: 1800 + Math.random() * 2200, q: 4, gain: 0.12 });
  },

  step: (c, d, t) => noise(c, d, { t, dur: 0.07, freq: 500, type: 'lowpass', gain: 0.1 }),
  'heavy-step': (c, d, t) => {
    noise(c, d, { t, dur: 0.13, freq: 220, type: 'lowpass', gain: 0.18 });
    tone(c, d, { freq: 80, to: 45, t, dur: 0.16, gain: 0.25 });
  },

  hit: (c, d, t) => {
    noise(c, d, { t, dur: 0.09, freq: 1100, q: 1.2, gain: 0.22 });
    tone(c, d, { freq: 140, to: 55, t, dur: 0.16, gain: 0.3 });
  },
  hurt: (c, d, t) => tone(c, d, { freq: 320, to: 110, type: 'sawtooth', t, dur: 0.22, gain: 0.12, lowpass: 1200 }),
  death: (c, d, t) => {
    tone(c, d, { freq: 230, to: 50, type: 'sawtooth', t, dur: 0.7, gain: 0.14, lowpass: 700 });
    noise(c, d, { t, dur: 0.5, freq: 300, to: 80, type: 'lowpass', gain: 0.2 });
  },

  spawn: (c, d, t) => {
    noise(c, d, { t, dur: 0.45, freq: 200, to: 1600, q: 2, gain: 0.2, attack: 0.15 });
    tone(c, d, { freq: 110, to: 330, type: 'triangle', t, dur: 0.45, gain: 0.12 });
  },
  door: (c, d, t) => {
    tone(c, d, { freq: 130, to: 190, type: 'sawtooth', t, dur: 0.55, gain: 0.09, attack: 0.1, lowpass: 600 });
    noise(c, d, { t, dur: 0.5, freq: 900, to: 400, q: 6, gain: 0.07, attack: 0.1 });
  },

  // Carillon : arpège majeur de cloches.
  quest: (c, d, t) => [0, 4, 7, 12].forEach((s, i) => tone(c, d, { freq: hz(523.25, s), type: 'triangle', t: t + i * 0.09, dur: 0.9, gain: 0.14, attack: 0.005 })),
  story: (c, d, t) => {
    noise(c, d, { t, dur: 0.35, freq: 700, to: 2200, q: 0.7, gain: 0.06, attack: 0.1 });
    tone(c, d, { freq: 220, type: 'sine', t: t + 0.1, dur: 1.4, gain: 0.1, attack: 0.05 });
  },
  danger: (c, d, t) => {
    tone(c, d, { freq: 110, type: 'sawtooth', t, dur: 1.0, gain: 0.1, attack: 0.15, lowpass: 500 });
    tone(c, d, { freq: 116.5, type: 'sawtooth', t, dur: 1.0, gain: 0.1, attack: 0.15, lowpass: 500 });
    tone(c, d, { freq: 55, to: 50, t, dur: 1.1, gain: 0.2, attack: 0.2 });
  },
  rest: (c, d, t) => [0, 4, 7].forEach((s) => tone(c, d, { freq: hz(220, s), type: 'triangle', t, dur: 1.2, gain: 0.08, attack: 0.3 })),
  start: (c, d, t) => {
    tone(c, d, { freq: 110, type: 'sine', t, dur: 2.2, gain: 0.25, attack: 0.02 });
    tone(c, d, { freq: 165, type: 'sine', t, dur: 1.8, gain: 0.15, attack: 0.02 });
    noise(c, d, { t, dur: 0.3, freq: 600, type: 'lowpass', gain: 0.1 });
  },
  victory: (c, d, t) => [0, 4, 7, 12, 7, 12].forEach((s, i) => tone(c, d, { freq: hz(261.63, s), type: 'sawtooth', t: t + i * 0.16, dur: i >= 4 ? 1.1 : 0.4, gain: 0.1, lowpass: 1800, attack: 0.02 })),
  defeat: (c, d, t) => [0, -3, -7].forEach((s, i) => tone(c, d, { freq: hz(220, s), type: 'sawtooth', t: t + i * 0.45, dur: 1.1, gain: 0.1, lowpass: 600, attack: 0.05 })),
};

export function playCue(ctx: BaseAudioContext, dest: AudioNode, cue: Cue, t = ctx.currentTime): void {
  CUE_SYNTH[cue](ctx, dest, t);
}

interface MoodSpec {
  root: number;
  scale: number[];
  /** Intervalle (s) entre deux notes isolées. */
  gap: [number, number];
  noteType: OscillatorType;
  noteGain: number;
  droneGain: number;
  /** Battement de cœur sourd, pour les moments de tension. */
  heartbeat?: boolean;
}

const MOODS: Record<Mood, MoodSpec> = {
  calm: { root: 55, scale: [0, 3, 5, 7, 10, 12, 15], gap: [2.5, 6], noteType: 'triangle', noteGain: 0.05, droneGain: 0.05 },
  tense: { root: 49, scale: [0, 1, 6, 7, 12, 13], gap: [1.1, 3], noteType: 'sawtooth', noteGain: 0.03, droneGain: 0.07, heartbeat: true },
  victory: { root: 65.41, scale: [0, 4, 7, 12, 16, 19], gap: [0.7, 1.6], noteType: 'triangle', noteGain: 0.07, droneGain: 0.05 },
  defeat: { root: 41.2, scale: [0, 3, 7, 10], gap: [4, 8], noteType: 'sine', noteGain: 0.05, droneGain: 0.06 },
};

export interface MusicHandle {
  /** Estompe puis arrête l'ambiance. */
  stop(fade?: number): void;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Ambiance générative : un bourdon grave qui respire, des notes isolées et, en tension, un battement de cœur. */
export function startMusic(ctx: BaseAudioContext, dest: AudioNode, mood: Mood, fadeIn = 2): MusicHandle {
  const spec = MOODS[mood];
  const bus = ctx.createGain();
  bus.gain.setValueAtTime(0.0001, ctx.currentTime);
  bus.gain.exponentialRampToValueAtTime(1, ctx.currentTime + fadeIn);
  bus.connect(dest);

  // Bourdon : fondamentale et quinte légèrement désaccordées, filtre qui respire.
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  const droneGain = ctx.createGain();
  droneGain.gain.value = spec.droneGain;
  lp.connect(droneGain);
  droneGain.connect(bus);
  const oscs: OscillatorNode[] = [];
  for (const [mult, detune] of [[1, -6], [1.5, 5], [2, 0]] as const) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = spec.root * mult;
    o.detune.value = detune;
    o.connect(lp);
    o.start();
    oscs.push(o);
  }
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = mood === 'tense' ? 0.35 : 0.12;
  lfoGain.gain.value = 140;
  lfo.connect(lfoGain);
  lfoGain.connect(lp.frequency);
  lfo.start();
  oscs.push(lfo);

  let stopped = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const intervals: ReturnType<typeof setInterval>[] = [];

  const nextNote = () => {
    if (stopped) return;
    const s = spec.scale[Math.floor(Math.random() * spec.scale.length)]!;
    const octave = Math.random() < 0.5 ? 2 : 4;
    tone(ctx, bus, { freq: hz(spec.root, s) * octave, type: spec.noteType, t: ctx.currentTime, dur: rand(1.2, 2.6), gain: spec.noteGain, attack: 0.08, lowpass: 1500 });
    timers.push(setTimeout(nextNote, rand(...spec.gap) * 1000));
  };
  timers.push(setTimeout(nextNote, rand(0.5, 1.5) * 1000));

  if (spec.heartbeat) {
    const beat = () => {
      if (stopped) return;
      tone(ctx, bus, { freq: 62, to: 38, t: ctx.currentTime, dur: 0.18, gain: 0.16 });
      tone(ctx, bus, { freq: 58, to: 36, t: ctx.currentTime + 0.22, dur: 0.16, gain: 0.1 });
    };
    intervals.push(setInterval(beat, 1200));
  }

  return {
    stop(fade = 1.5) {
      if (stopped) return;
      stopped = true;
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
      const t = ctx.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(Math.max(bus.gain.value, 0.0001), t);
      bus.gain.exponentialRampToValueAtTime(0.0001, t + fade);
      setTimeout(() => {
        for (const o of oscs) {
          try {
            o.stop();
          } catch {
            /* déjà arrêté */
          }
        }
        bus.disconnect();
      }, fade * 1000 + 100);
    },
  };
}

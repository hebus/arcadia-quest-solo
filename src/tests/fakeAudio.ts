/** Faux contexte Web Audio pour les tests : compte les nœuds créés et mémorise les valeurs des gains. */
class Param {
  value = 0;
  calls: string[] = [];
  setValueAtTime(v: number) {
    this.value = v;
    this.calls.push('set');
  }
  exponentialRampToValueAtTime(v: number) {
    this.value = v;
    this.calls.push('ramp');
  }
  linearRampToValueAtTime(v: number) {
    this.value = v;
  }
  setTargetAtTime(v: number) {
    this.value = v;
    this.calls.push('target');
  }
  cancelScheduledValues() {}
}

class Node {
  connections: unknown[] = [];
  disconnected = false;
  connect(n: unknown) {
    this.connections.push(n);
    return n;
  }
  disconnect() {
    this.disconnected = true;
  }
}

export class FakeOscillator extends Node {
  type = 'sine';
  frequency = new Param();
  detune = new Param();
  started = false;
  stopped = false;
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
}

class FakeGain extends Node {
  gain = new Param();
}
class FakeFilter extends Node {
  type = 'lowpass';
  frequency = new Param();
  Q = new Param();
}
class FakeSource extends Node {
  buffer: unknown = null;
  start() {}
  stop() {}
}

export class FakeAudioContext {
  currentTime = 0;
  sampleRate = 8000;
  state: 'suspended' | 'running' = 'suspended';
  destination = new Node();
  oscillators: FakeOscillator[] = [];
  gains: FakeGain[] = [];
  sources = 0;
  resumed = 0;
  resume() {
    this.resumed++;
    this.state = 'running';
    return Promise.resolve();
  }
  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createOscillator() {
    const o = new FakeOscillator();
    this.oscillators.push(o);
    return o;
  }
  createBiquadFilter() {
    return new FakeFilter();
  }
  createBufferSource() {
    this.sources++;
    return new FakeSource();
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
  /** Gain principal : le premier créé par le moteur (master). */
  get master() {
    return this.gains[0]!;
  }
}

export const asContext = (c: FakeAudioContext): AudioContext => c as unknown as AudioContext;

/** Stockage en mémoire pour les préférences. */
export class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

/** Source aléatoire injectée (dés numériques) ; les dés physiques passent par l'Oracle. */
export interface RandomSource {
  nextInt(min: number, max: number): number;
}

/** Générateur déterministe (mulberry32) pour les tests et le rejeu par graine. */
export function createSeededRandom(seed: number): RandomSource {
  let a = seed >>> 0;
  return {
    nextInt(min, max) {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      return min + Math.floor(r * (max - min + 1));
    },
  };
}

/** Générateur à graine dont la position est persistable (graine + nombre de tirages). */
export class CountingRandom implements RandomSource {
  private inner: RandomSource;
  counter: number;

  constructor(seed: number, counter = 0) {
    this.inner = createSeededRandom(seed);
    this.counter = 0;
    while (this.counter < counter) {
      this.inner.nextInt(0, 1);
      this.counter++;
    }
  }

  nextInt(min: number, max: number): number {
    this.counter++;
    return this.inner.nextInt(min, max);
  }
}

/** Mélange de Fisher-Yates avec la source injectée. */
export function shuffle<T>(items: readonly T[], rng: RandomSource): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

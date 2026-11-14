import { createSeededRandom } from './random';

describe('createSeededRandom', () => {
  it('est reproductible pour une même graine', () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    const seqA = Array.from({ length: 10 }, () => a.nextInt(1, 6));
    const seqB = Array.from({ length: 10 }, () => b.nextInt(1, 6));
    expect(seqA).toEqual(seqB);
  });

  it('reste dans les bornes', () => {
    const r = createSeededRandom(1);
    for (let i = 0; i < 200; i++) {
      const v = r.nextInt(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });
});

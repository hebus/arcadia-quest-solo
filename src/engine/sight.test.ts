import { describe, expect, it } from 'vitest';
import { canHeroTarget } from './combat/heroMove';
import { demoGame } from '@/tests/fixtures/demo';
import { startScenario } from './turn/machine';

/** Héros h1 en (0,2) ; cible g1 en (4,2) ; un personnage éventuel entre les deux. */
const game = (mode: 'any-character' | 'rulebook', blocker?: { x: number; y: number }, blockerKind: 'monster' | 'hero' = 'monster', blockers = 1) =>
  startScenario(
    demoGame({
      settings: { lineOfSight: mode },
      heroes: [
        { id: 'h1', name: 'Grom', life: 4, defense: 0, position: { x: 0, y: 2 } },
        ...(blocker && blockerKind === 'hero' ? [{ id: 'h2', name: 'Maya', life: 3, defense: 0, position: blocker }] : []),
      ],
      monsters: [
        { id: 'g1', definitionId: 'goblin', position: { x: 4, y: 2 } },
        ...(blocker && blockerKind === 'monster' ? Array.from({ length: blockers }, (_, i) => ({ id: `o${i + 1}`, definitionId: 'orc', position: blocker })) : []),
      ],
    }),
  );

describe('ligne de vue : trait entre les centres des cases', () => {
  it('dégagée : visible', () => {
    expect(canHeroTarget(game('any-character'), 'h1', 'g1', 'ranged')).toBe(true);
  });

  it('un monstre sur le trait le coupe', () => {
    expect(canHeroTarget(game('any-character', { x: 2, y: 2 }), 'h1', 'g1', 'ranged')).toBe(false);
  });

  it('un héros sur le trait le coupe aussi : tout personnage bloque', () => {
    expect(canHeroTarget(game('any-character', { x: 2, y: 2 }, 'hero'), 'h1', 'g1', 'ranged')).toBe(false);
  });

  it('un personnage hors du trait ne gêne pas', () => {
    expect(canHeroTarget(game('any-character', { x: 2, y: 3 }), 'h1', 'g1', 'ranged')).toBe(true);
  });

  it('règle du livret : seuls deux ennemis bloquent (Blocked Space) ; un seul, ou un allié, ne bloque pas', () => {
    expect(canHeroTarget(game('rulebook', { x: 2, y: 2 }), 'h1', 'g1', 'ranged')).toBe(true); // un seul monstre : il reste une place
    expect(canHeroTarget(game('rulebook', { x: 2, y: 2 }, 'monster', 2), 'h1', 'g1', 'ranged')).toBe(false); // deux monstres : case bloquée
    expect(canHeroTarget(game('rulebook', { x: 2, y: 2 }, 'hero'), 'h1', 'g1', 'ranged')).toBe(true); // héros allié
  });

  it('corps à corps : seules les cases adjacentes, même avec une ligne de vue', () => {
    expect(canHeroTarget(game('any-character'), 'h1', 'g1', 'melee')).toBe(false);
    const adjacent = startScenario(demoGame({ heroes: [{ id: 'h1', name: 'Grom', life: 4, defense: 0, position: { x: 3, y: 2 } }], monsters: [{ id: 'g1', definitionId: 'goblin', position: { x: 4, y: 2 } }] }));
    expect(canHeroTarget(adjacent, 'h1', 'g1', 'melee')).toBe(true);
  });
});

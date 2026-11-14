import { describe, expect, it } from 'vitest';
import { parseBoardDsl } from '@/engine/boardDsl';
import { parseScenario, validateScenario, createScenarioGame } from '@/engine/scenario/definition';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES, ORIGINAL_SCENARIOS } from './index';

describe('univers original : Port-Cendre', () => {
  it.each(ORIGINAL_SCENARIOS.map((s) => [s.id, s] as const))('scénario %s : valide au schéma et sans problème d’intégrité', (_id, def) => {
    expect(() => parseScenario(def)).not.toThrow();
    expect(validateScenario(def, ORIGINAL_CONTENT)).toEqual([]);
  });

  it.each(ORIGINAL_SCENARIOS.map((s) => [s.id, s] as const))('scénario %s : une partie se crée avec trois héros, sans mise en place manuelle', (_id, def) => {
    const g = createScenarioGame(def, { sessionId: 's', difficulty: def.recommended, seed: 7, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT);
    expect(g.heroes.map((h) => h.id)).toEqual(['h1', 'h2', 'h3']);
    expect(g.heroes.map((h) => h.position)).toEqual(def.heroStarts.slice(0, 3));
    expect(g.monsters).toHaveLength(def.monsters.length);
    expect(g.quests.map((q) => q.id)).toEqual(def.quests.map((q) => q.id));
    expect(g.deck.draw.length).toBeGreaterThan(0);
  });

  it('chaque monstre a des statistiques pour tous les jeux de cartes', () => {
    for (const m of Object.values(ORIGINAL_CONTENT.monsters)) {
      expect(Object.keys(m.levels).sort()).toEqual(['1', '2-3', '4', '5-6']);
    }
  });

  it('un scénario avec un monstre inconnu ou hors plateau est refusé avec un message clair', () => {
    const base = ORIGINAL_SCENARIOS[0]!;
    const bad = { ...base, monsters: [{ id: 'x', definitionId: 'dragon', at: { x: 99, y: 0 } }] };
    const problems = validateScenario(bad, ORIGINAL_CONTENT);
    expect(problems.some((p) => p.includes('Monstre inconnu : dragon'))).toBe(true);
    expect(problems.some((p) => p.includes('hors du plateau'))).toBe(true);
  });

  it('plus de trois héros que de cases de départ : refusé', () => {
    const def = ORIGINAL_SCENARIOS[0]!;
    expect(() => createScenarioGame(def, { sessionId: 's', difficulty: 'easy', seed: 1, heroes: ORIGINAL_HEROES }, ORIGINAL_CONTENT)).toThrow(/3 héros au plus/);
  });
});

describe('DSL : commande room', () => {
  it('muré le contour d’une pièce, sauf à l’emplacement d’une porte', () => {
    const { board } = parseBoardDsl('size 5x4\nroom 1,1 2x2\ndoor d 0,1-1,1 closed\nspawn S 0,0 a+b');
    expect(board.interior).toHaveLength(4);
    // Contour d'une pièce 2×2 : 8 arêtes, moins la porte.
    expect(board.walls).toHaveLength(7);
    expect(board.doors).toHaveLength(1);
  });

  it('une pièce au bord du plateau n’ajoute pas de mur hors plateau', () => {
    const { board } = parseBoardDsl('size 3x3\nroom 0,0 3x1\nspawn S 0,2 a+b');
    expect(board.walls).toHaveLength(3);
  });
});
describe('objectifs : icônes', () => {
  it('chaque objectif du scénario a une icône reconnue et une case', () => {
    for (const def of ORIGINAL_SCENARIOS) {
      for (const q of def.quests) {
        expect(['key', 'flame', 'skull', 'flag', 'chest', 'gem'], q.id).toContain(q.icon);
        expect(q.at, q.id).toBeDefined();
      }
    }
  });

  it('l’icône voyage du scénario jusqu’à l’état de partie', () => {
    const def = ORIGINAL_SCENARIOS[0]!;
    const g = createScenarioGame(def, { sessionId: 's', difficulty: 'medium', seed: 1, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT);
    expect(g.quests.map((q) => q.icon)).toEqual(['key', 'flame', 'skull']);
  });
});


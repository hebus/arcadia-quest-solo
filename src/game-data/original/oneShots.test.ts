import { describe, expect, it } from 'vitest';
import { DEFEAT_THRESHOLD, type Difficulty } from '@/engine/domain/schemas';
import { createScenarioGame, validateScenario } from '@/engine/scenario/definition';
import { DIFFICULTIES, DIFFICULTY_LEVEL, resolveDifficulty } from '@/engine/scenario/difficulty';
import { ONE_SHOT_SCENARIOS, ORIGINAL_CONTENT, ORIGINAL_HEROES, ORIGINAL_SCENARIOS, scenarioForGame } from '.';

const heroes = ORIGINAL_HEROES.slice(0, 3);
const start = (id: string, difficulty: Difficulty) => createScenarioGame(ONE_SHOT_SCENARIOS.find((s) => s.id === id)!, { sessionId: 's', difficulty, seed: 1, heroes }, ORIGINAL_CONTENT);
const countOf = (monsters: { definitionId: string }[], id: string) => monsters.filter((m) => m.definitionId === id).length;

describe('scénarios one shot : difficulté au choix', () => {
  it('cinq scénarios livrés, tous au catalogue, avec des identifiants distincts et les quatre variantes', () => {
    expect(ONE_SHOT_SCENARIOS.map((s) => s.id)).toEqual(['quartier-des-voleurs', 'corridor-des-ombres', 'evasion-du-quartier', 'dernier-rempart', 'caveau-des-brumes']);
    for (const s of ONE_SHOT_SCENARIOS) {
      expect(ORIGINAL_SCENARIOS).toContain(s);
      expect(Object.keys(s.difficulties ?? {}).sort()).toEqual(['easy', 'hard', 'legendary', 'medium']);
      expect(s.tiles!.placements.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('chaque scénario est valide aux quatre difficultés (boîtes, statistiques, portes, départ, script)', () => {
    for (const s of ONE_SHOT_SCENARIOS) expect(validateScenario(s, ORIGINAL_CONTENT), s.id).toEqual([]);
  });

  it.each(ONE_SHOT_SCENARIOS.map((s) => s.id))('%s : la difficulté fixe le niveau des fiches', (id) => {
    for (const d of DIFFICULTIES) {
      const g = start(id, d);
      expect(g.monsterCardSet, d).toBe(DIFFICULTY_LEVEL[d]);
      expect(g.difficulty).toBe(d);
    }
    expect(DIFFICULTIES.map((d) => DIFFICULTY_LEVEL[d])).toEqual(['1', '2-3', '4-5', '6']);
    // Les seuils de défaite par difficulté restent ceux du jeu.
    expect(DEFEAT_THRESHOLD).toEqual({ legendary: 1, hard: 2, medium: 3, easy: 4 });
  });

  it.each(ONE_SHOT_SCENARIOS.map((s) => s.id))('%s : facile sans archers (pas de fiche de niveau 1), de plus en plus de monstres ensuite', (id) => {
    const n = (d: Difficulty) => start(id, d).monsters.length;
    expect(countOf(start(id, 'easy').monsters, 'GA')).toBe(0);
    expect(countOf(start(id, 'medium').monsters, 'GA')).toBeGreaterThan(0);
    expect(n('hard')).toBeGreaterThanOrEqual(n('medium'));
    expect(n('legendary')).toBeGreaterThan(n('hard'));
    expect(JSON.stringify(start(id, 'easy').deck)).not.toContain('GA');
  });

  it('un scénario sans variantes se joue tel quel, à toutes les difficultés', () => {
    const plain = ORIGINAL_SCENARIOS.find((s) => !s.difficulties)!;
    for (const d of DIFFICULTIES) expect(resolveDifficulty(plain, d)).toBe(plain);
  });

  it('la variante est appliquée sans toucher au scénario d’origine', () => {
    const def = ONE_SHOT_SCENARIOS[0]!;
    const easy = resolveDifficulty(def, 'easy');
    expect(easy.difficulties).toBeUndefined();
    expect(easy.monsterCardSet).toBe('1');
    expect(def.monsters.some((m) => m.definitionId === 'GA')).toBe(true);
    expect(def.monsterCardSet).toBe('2-3');
  });

  it('un monstre sans fiche au niveau choisi, ou une variante incohérente, est refusé avec un message clair', () => {
    const def = ONE_SHOT_SCENARIOS[0]!;
    const noStats = { ...def, difficulties: { ...def.difficulties, easy: { monsterCardSet: '1' } } };
    expect(validateScenario(noStats, ORIGINAL_CONTENT).some((p) => p.includes('[Facile]') && p.includes('GA') && p.includes('niveau 1'))).toBe(true);
    const unknown = { ...def, difficulties: { ...def.difficulties, hard: { monsterCardSet: '4-5', removeMonsters: ['X9'] } } };
    expect(validateScenario(unknown, ORIGINAL_CONTENT).some((p) => p.includes('Difficile') && p.includes('X9'))).toBe(true);
    const dup = { ...def, difficulties: { ...def.difficulties, hard: { monsterCardSet: '4-5', addMonsters: [{ id: 'OC1', definitionId: 'OM', at: { x: 0, y: 0 } }] } } };
    expect(validateScenario(dup, ORIGINAL_CONTENT).some((p) => p.includes('OC1') && p.includes('existe déjà'))).toBe(true);
  });

  it('les renforts du script comptent dans la boîte des Orcs (8 au plus)', () => {
    const def = ONE_SHOT_SCENARIOS[0]!;
    const crowded = { ...def, monsters: [...def.monsters, ...Array.from({ length: 6 }, (_, i) => ({ id: `OMx${i}`, definitionId: 'OM', at: { x: i, y: 3 } }))] };
    expect(validateScenario(crowded, ORIGINAL_CONTENT).length).toBeGreaterThan(0);
  });

  it('la partie retrouve le script de sa difficulté (reprise) : scenarioForGame', () => {
    const g = start('dernier-rempart', 'legendary');
    const played = scenarioForGame(g)!;
    expect(played.monsterCardSet).toBe('6');
    expect(played.script!.length).toBeGreaterThan(3);
    expect(played.monsters).toHaveLength(g.monsters.length);
    expect(scenarioForGame({ scenarioId: 'inconnu', difficulty: 'easy' })).toBeUndefined();
  });
});

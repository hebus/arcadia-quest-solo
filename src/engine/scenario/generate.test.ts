import { describe, expect, it } from 'vitest';
import { heroStartsEnclosed } from '../startArea';
import { tilePlacementProblems } from '../tileCatalog';
import { runScript } from './script';
import { createScenarioGame, scenarioBoard, validateScenario } from './definition';
import { MAX_GENERATED_TILES, generateScenario } from './generate';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES } from '@/game-data/original';
import { startScenario } from '../turn/machine';

const gen = (tileCount: number, seed: number) => generateScenario({ tileCount, seed }, ORIGINAL_CONTENT);
/** Objectif classique (atteindre un objet puis abattre le chef) : les autres types ont leurs propres tests (objectives.test.ts). */
const genClassic = (tileCount: number, seed: number) => generateScenario({ tileCount, seed, objective: 'atteindre' }, ORIGINAL_CONTENT);
const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 42, 99, 123, 2024, 31337];

describe('scénario aléatoire', () => {
  it('le nombre de tuiles demandé est celui du terrain, de 1 à 9', () => {
    for (let n = 1; n <= MAX_GENERATED_TILES; n++) expect(gen(n, 7).tiles!.placements).toHaveLength(n);
  });

  it('un nombre de tuiles hors de 1 à 9 est refusé', () => {
    expect(() => gen(0, 1)).toThrow(/entre 1 et 9/);
    expect(() => gen(10, 1)).toThrow(/entre 1 et 9/);
    expect(() => gen(Number.NaN, 1)).toThrow(/entre 1 et 9/);
  });

  it('sans tuiles définies, une erreur claire', () => {
    expect(() => generateScenario({ tileCount: 3, seed: 1 }, { monsters: ORIGINAL_CONTENT.monsters })).toThrow(/Aucune tuile n'est définie/);
  });

  it('même graine, même scénario ; une autre graine change le tirage', () => {
    expect(gen(5, 11)).toEqual(gen(5, 11));
    const variants = new Set(seeds.map((s) => JSON.stringify(gen(5, s).tiles)));
    expect(variants.size).toBeGreaterThan(5);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])('%i tuile(s) : scénario valide et jouable pour toutes les graines essayées', (n) => {
    for (const seed of seeds) {
      const def = gen(n, seed);
      expect(validateScenario(def, ORIGINAL_CONTENT), `graine ${seed}`).toEqual([]);
      // Une partie se crée avec trois héros, sur un plateau de la taille des tuiles.
      const g = createScenarioGame(def, { sessionId: 's', difficulty: 'medium', seed: 1, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT);
      expect(g.phase).toBe('SCENARIO_SETUP');
      expect(g.monsters.length).toBeGreaterThanOrEqual(2);
      expect(g.monsters.length).toBeLessThanOrEqual(8);
    }
  });

  it('chaque tuile est utilisée une seule fois, sur une seule face, et les tuiles se touchent (d’un seul tenant)', () => {
    for (const seed of seeds) {
      const def = gen(6, seed);
      expect(tilePlacementProblems(def.tiles!.placements.map((p) => p.tileId)).errors).toEqual([]);
      // D'un seul tenant : chaque tuile touche au moins une autre par un côté.
      const at = def.tiles!.placements.map((p) => ({ x: p.tx, y: p.ty }));
      for (const c of at) expect(at.some((o) => Math.abs(o.x - c.x) + Math.abs(o.y - c.y) === 1)).toBe(true);
    }
  });

  it('les héros peuvent sortir de leur départ, et tout est atteignable : monstres, objectif, jetons Spawn', () => {
    for (const n of [1, 3, 6, 9]) {
      for (const seed of seeds) {
        const def = gen(n, seed);
        const board = scenarioBoard(def, ORIGINAL_CONTENT).board;
        expect(heroStartsEnclosed(board, def.heroStarts), `n=${n} graine ${seed}`).toBe(false);
        expect(def.heroStarts).toHaveLength(3);
      }
    }
  });

  it('il y a un bâtiment fermé par un pion porte, des jetons Spawn de types différents et au plus 22 portes', () => {
    for (const seed of seeds) {
      const def = gen(7, seed);
      const board = scenarioBoard(def, ORIGINAL_CONTENT).board;
      expect(board.doors.length).toBeGreaterThanOrEqual(1);
      expect(board.doors.length).toBeLessThanOrEqual(22);
      const tokens = def.board.split('\n').filter((l) => l.startsWith('spawn'));
      const types = tokens.map((l) => l.split(' ')[3]!);
      expect(new Set(types).size).toBe(types.length); // pas de doublon : un seul jeton de chaque type
    }
  });

  it('les monstres sont ceux du niveau 1, au plus un par case, et un chef gardien (vilain) porte la quête', () => {
    for (const seed of seeds) {
      const def = genClassic(5, seed);
      expect(def.monsters.every((m) => ['OM', 'OC', 'GA', 'M', 'T', 'SB', 'HB'].includes(m.definitionId))).toBe(true);
      expect(['M', 'T']).toContain(def.monsters.at(-1)!.definitionId); // le chef est un vilain
      expect(new Set(def.monsters.map((m) => `${m.at.x},${m.at.y}`)).size).toBe(def.monsters.length);
      const chef = def.monsters.at(-1)!;
      expect(chef.guard).toBe(true);
      expect(def.quests.map((q) => q.id)).toEqual(['objectif', 'chef']);
      expect(def.quests[1]!.at).toEqual(chef.at);
      expect(def.monsterCardSet).toBe('1');
    }
  });

  it('les quêtes se valident : toucher l’objectif, abattre le chef, et la partie est gagnée', () => {
    const def = genClassic(4, 5);
    const g0 = startScenario(createScenarioGame(def, { sessionId: 's', difficulty: 'medium', seed: 1, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT));
    const objective = def.quests.find((q) => q.id === 'objectif')!.at!;
    const onObjective = { ...g0, heroes: g0.heroes.map((h, i) => (i === 0 ? { ...h, position: objective } : h)) };
    const r1 = runScript(onObjective, def.script!);
    expect(r1.state.quests.find((q) => q.id === 'objectif')!.done).toBe(true);
    const chefId = def.monsters.at(-1)!.id;
    const down = { ...r1.state, monsters: r1.state.monsters.map((m) => (m.id === chefId ? { ...m, status: 'spawn-tile' as const, position: null } : m)) };
    const r2 = runScript(down, def.script!);
    expect(r2.state.quests.every((q) => q.done)).toBe(true);
    expect(r2.state.phase).toBe('SCENARIO_WON');
  });

  it('le scénario généré est marqué, avec une histoire, et son identifiant dépend de la graine', () => {
    const def = gen(3, 77);
    expect(def.generated).toBe(true);
    expect(def.id).toBe('aleatoire-77');
    expect(def.story.intro).toHaveLength(3);
    expect(def.title).toContain('3 tuiles');
    expect(gen(1, 77).title).toContain('1 tuile');
    expect(gen(1, 77).title).not.toContain('tuiles');
  });
});

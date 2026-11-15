import { describe, expect, it } from 'vitest';
import { boxProblems } from './figurines';
import { monsterClassLabel, monsterStats, rankAtLevel, skillLines } from './monsters';
import { addMonster } from './sandbox';
import { createScenarioGame, validateScenario } from './scenario/definition';
import { generateScenario } from './scenario/generate';
import { validateGameState } from './setup';
import { startScenario } from './turn/machine';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES } from '@/game-data/original';
import { CAVE_AUX_CENDRES } from '@/game-data/original/scenarios/cave-aux-cendres';
import { TERRAIN_ESSAI } from '@/game-data/original/scenarios/terrain-essai';

const defs = ORIGINAL_CONTENT.monsters;
const at1 = (id: string) => monsterStats(defs[id], '1')!;

describe('bestiaire du niveau 1 : fiches exactes', () => {
  it('Orc Marauder : minor minion, 2 de vie, overkill 3, mouvement 1, 3 dés d’épée, 1 PO', () => {
    expect(at1('OM')).toEqual({ life: 2, overkill: 3, movement: 1, reward: 1, attackType: 'melee', attackDice: 3 });
    expect(defs.OM).toMatchObject({ kind: 'minion', tier: 1 });
    expect(rankAtLevel(defs.OM, '1')).toBe('minor');
    expect(monsterClassLabel(defs.OM, '1')).toBe('minion mineur');
  });

  it('Orc Captain : minor minion, overkill 4, 2 PO et 1 relance', () => {
    expect(at1('OC')).toEqual({ life: 2, overkill: 4, movement: 1, reward: 2, attackType: 'melee', attackDice: 3, rerolls: 1 });
    expect(skillLines(at1('OC'))).toEqual(['1 relance de l’attaque.']);
    expect(rankAtLevel(defs.OC, '1')).toBe('minor');
  });

  it('Minotaur : minor villain, 5 de vie, overkill 6, défense 1 dé, mouvement 2, 4 dés d’épée, 3 PO, critique = blessure en plus', () => {
    expect(at1('M')).toEqual({ life: 5, overkill: 6, movement: 2, reward: 3, attackType: 'melee', attackDice: 4, defense: 1, skills: ['crit-extra-wound'] });
    expect(defs.M).toMatchObject({ kind: 'villain', tier: 3, copies: 1 });
    expect(monsterClassLabel(defs.M, '1')).toBe('vilain mineur');
    expect(skillLines(at1('M'))[0]).toMatch(/critique donne une blessure supplémentaire/);
  });

  it('Troll : minor villain, 4 de vie, overkill 6, défense 2 dés, mouvement 2, 4 dés d’épée, 3 PO, cible tous les héros adjacents', () => {
    expect(at1('T')).toEqual({ life: 4, overkill: 6, movement: 2, reward: 3, attackType: 'melee', attackDice: 4, defense: 2, skills: ['attack-all-adjacent'] });
    expect(defs.T).toMatchObject({ kind: 'villain', tier: 3, copies: 1 });
    expect(skillLines(at1('T'))).toEqual(['Son attaque cible tous les héros adjacents.']);
  });

  it('Spear Beastman : major minion, 3 de vie, overkill 5, mouvement 1, 3 dés d’arc, 2 PO, un dé de plus près d’un monstre', () => {
    expect(at1('SB')).toEqual({ life: 3, overkill: 5, movement: 1, reward: 2, attackType: 'ranged', attackDice: 3, skills: ['extra-die-next-to-monster'] });
    expect(defs.SB!.levels['1']).toBeUndefined(); // il n'existe qu'en major
    expect(rankAtLevel(defs.SB, '1')).toBe('major');
    expect(monsterClassLabel(defs.SB, '1')).toBe('minion majeur');
    expect(monsterStats(defs.SB, '1', 'major')).toBe(at1('SB'));
    expect(monsterStats(defs.SB, '1', 'minor')).toBeUndefined();
    expect(defs.SB).toMatchObject({ copies: 2, tier: 2 });
  });

  it('Hammer Beastman : major minion, 3 de vie, overkill 5, mouvement 1, 4 dés d’épée, 2 PO, étourdit', () => {
    expect(at1('HB')).toEqual({ life: 3, overkill: 5, movement: 1, reward: 2, attackType: 'melee', attackDice: 4, skills: ['stun'] });
    expect(rankAtLevel(defs.HB, '1')).toBe('major');
    expect(skillLines(at1('HB'))).toEqual(['Si au moins une blessure passe, le héros est étourdi.']);
    expect(defs.HB).toMatchObject({ copies: 2, tier: 2 });
  });

  it('les vilains sont des vilains, les autres des minions ; le Goblin Archer reste inchangé', () => {
    expect(Object.values(defs).filter((d) => d.kind === 'villain').map((d) => d.id).sort()).toEqual(['M', 'T']);
    expect(monsterStats(defs.GA, '2-3')).toMatchObject({ life: 2, overkill: 3, movement: 1, reward: 1, attackType: 'ranged', attackDice: 2 });
    expect(defs.GA).toMatchObject({ copies: 6 });
  });
});

describe('boîtes de figurines : 8 Orcs partagés, 1 Minotaur, 1 Troll, 2 Spear Beastman, 2 Hammer Beastman', () => {
  const count = (o: Record<string, number>) => new Map(Object.entries(o));

  it('l’Orc Marauder et l’Orc Captain se comptent ensemble sur les 8 Orcs', () => {
    expect(boxProblems(count({ OM: 8 }), defs)).toEqual([]);
    expect(boxProblems(count({ OM: 5, OC: 3 }), defs)).toEqual([]);
    expect(boxProblems(count({ OM: 5, OC: 4 }), defs)).toEqual(['Trop de figurines Orc Marauder et Orc Captain : 9 pour 8 dans la boîte']);
    expect(boxProblems(count({ OM: 9 }), defs)).toEqual(['Trop de figurines Orc Marauder : 9 pour 8 dans la boîte']);
  });

  it('les autres types ont leur propre boîte', () => {
    expect(boxProblems(count({ OM: 8, M: 1, T: 1, SB: 2, HB: 2, GA: 6 }), defs)).toEqual([]);
    expect(boxProblems(count({ M: 2 }), defs)[0]).toMatch(/Minotaur : 2 pour 1/);
    expect(boxProblems(count({ T: 2 }), defs)[0]).toMatch(/Troll : 2 pour 1/);
    expect(boxProblems(count({ SB: 3 }), defs)[0]).toMatch(/Spear Beastman : 3 pour 2/);
    expect(boxProblems(count({ HB: 3 }), defs)[0]).toMatch(/Hammer Beastman : 3 pour 2/);
  });

  it('un scénario qui dépasse une boîte est refusé, Orcs mélangés compris', () => {
    const at = (i: number) => ({ x: i % 9, y: 8 - Math.floor(i / 9) });
    const list = (ids: string[]) => ids.map((definitionId, i) => ({ id: `x${i}`, definitionId, at: at(i) }));
    const orcs = (om: number, oc: number) => [...Array(om).fill('OM'), ...Array(oc).fill('OC')] as string[];
    expect(validateScenario({ ...CAVE_AUX_CENDRES, script: [], monsters: list(orcs(4, 4)) }, ORIGINAL_CONTENT).join()).not.toMatch(/Trop de figurines/);
    expect(validateScenario({ ...CAVE_AUX_CENDRES, script: [], monsters: list(orcs(5, 4)) }, ORIGINAL_CONTENT).join()).toMatch(/Trop de figurines Orc Marauder et Orc Captain : 9 pour 8/);
    expect(validateScenario({ ...CAVE_AUX_CENDRES, script: [], monsters: list(['M', 'M']) }, ORIGINAL_CONTENT).join()).toMatch(/Trop de figurines Minotaur : 2 pour 1/);
  });

  it('la mise en place d’une partie contrôle aussi les boîtes partagées', () => {
    const g = createScenarioGame(CAVE_AUX_CENDRES, { sessionId: 's', difficulty: 'medium', seed: 1, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT);
    const extra = (id: string, definitionId: string, x: number) => ({ id, definitionId, position: { x, y: 8 }, status: 'spawn-tile' as const, isGuard: false, wounds: 0 });
    // 6 Orcs (4 OM et 2 OC) sont déjà posés : 3 Orc Captain de plus font 9.
    const over = { ...g, monsters: [...g.monsters, extra('c1', 'OC', 3), extra('c2', 'OC', 4), extra('c3', 'OC', 5)] };
    expect(validateGameState({ ...over, monsters: over.monsters.map((m) => ({ ...m, position: m.status === 'board' ? m.position : null })) }, ORIGINAL_CONTENT).join()).toMatch(/Trop de figurines (Orc Marauder et Orc Captain|Orc Captain et Orc Marauder) : 9 pour 8/);
  });

  it('au terrain d’essai, la boîte des Orcs est commune et chaque vilain n’a qu’une figurine', () => {
    let g = startScenario(createScenarioGame(TERRAIN_ESSAI, { sessionId: 's', difficulty: 'medium', seed: 1, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT));
    // 2 Orcs en jeu (1 Marauder, 1 Captain) : 6 Orc Captain de plus complètent les 8 de la boîte, un 7e est refusé.
    for (const [x, y] of [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]] as const) g = addMonster(g, ORIGINAL_CONTENT, 'OC', { x, y });
    expect(() => addMonster(g, ORIGINAL_CONTENT, 'OC', { x: 3, y: 1 })).toThrow(/Plus de figurine Orc Marauder ou Orc Captain disponible \(8 dans la boîte\)/);
    expect(() => addMonster(g, ORIGINAL_CONTENT, 'OM', { x: 3, y: 1 })).toThrow(/Plus de figurine/);
    // Le Minotaur et le Troll sont déjà sur le plateau : leur unique figurine est prise.
    expect(() => addMonster(g, ORIGINAL_CONTENT, 'M', { x: 3, y: 1 })).toThrow(/Plus de figurine Minotaur disponible \(1 dans la boîte\)/);
    expect(() => addMonster(g, ORIGINAL_CONTENT, 'T', { x: 3, y: 1 })).toThrow(/Plus de figurine Troll disponible \(1 dans la boîte\)/);
    // Spear et Hammer Beastman : 2 chacun, un seul en jeu au départ ; ils n'existent qu'en major mais se posent.
    g = addMonster(g, ORIGINAL_CONTENT, 'SB', { x: 0, y: 2 });
    expect(() => addMonster(g, ORIGINAL_CONTENT, 'SB', { x: 3, y: 1 })).toThrow(/Spear Beastman/);
    expect(g.monsters.filter((m) => m.definitionId === 'SB')).toHaveLength(2);
    g = addMonster(g, ORIGINAL_CONTENT, 'HB', { x: 0, y: 3 });
    expect(() => addMonster(g, ORIGINAL_CONTENT, 'HB', { x: 3, y: 1 })).toThrow(/Hammer Beastman/);
    expect(g.monsters.filter((m) => m.definitionId === 'HB')).toHaveLength(2);
  });
});

describe('générateur : tout le bestiaire du niveau 1, dans les limites des boîtes', () => {
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 21, 42, 99, 123, 2024, 31337];

  it('les boîtes sont respectées, avec un vilain pour chef gardien et des ids <type><n>', () => {
    for (const n of [2, 4, 6, 9]) {
      for (const seed of seeds) {
        const def = generateScenario({ tileCount: n, seed }, ORIGINAL_CONTENT);
        const count = new Map<string, number>();
        for (const m of def.monsters) count.set(m.definitionId, (count.get(m.definitionId) ?? 0) + 1);
        expect(boxProblems(count, defs), `n=${n} graine ${seed}`).toEqual([]);
        expect(def.monsters.length).toBeGreaterThanOrEqual(2);
        expect(def.monsters.length).toBeLessThanOrEqual(8);
        const chef = def.monsters.at(-1)!;
        expect(['M', 'T']).toContain(chef.definitionId);
        expect(chef.guard).toBe(true);
        expect(new Set(def.monsters.map((m) => m.id)).size).toBe(def.monsters.length);
        for (const m of def.monsters) expect(m.id).toMatch(new RegExp(`^${m.definitionId}\\d+$`));
        expect(validateScenario(def, ORIGINAL_CONTENT), `n=${n} graine ${seed}`).toEqual([]);
      }
    }
  });

  it('le deck liste tous les types présents, et la quête porte le nom du chef', () => {
    for (const seed of seeds) {
      const def = generateScenario({ tileCount: 5, seed, objective: 'atteindre' }, ORIGINAL_CONTENT);
      const present = [...new Set(def.monsters.map((m) => m.definitionId))].sort();
      expect([...(def.deck!.listedMonsterIds ?? [])].sort()).toEqual(present);
      const chefName = defs[def.monsters.at(-1)!.definitionId]!.name;
      expect(def.quests[1]!.title).toBe(`Abattre le ${chefName}`);
      expect(def.tagline).toContain(chefName);
      expect(JSON.stringify(def.story)).not.toMatch(/maraudeur/i);
    }
  });

  it('plusieurs types sont tirés, au moins un Minotaur et un Troll sur l’ensemble des graines, jamais plus d’un chef', () => {
    const seen = new Set<string>();
    const chiefs = new Set<string>();
    for (const seed of [...seeds, ...Array.from({ length: 30 }, (_, i) => 500 + i)]) {
      const def = generateScenario({ tileCount: 9, seed }, ORIGINAL_CONTENT);
      for (const m of def.monsters) seen.add(m.definitionId);
      chiefs.add(def.monsters.at(-1)!.definitionId);
      expect(def.monsters.filter((m) => ['M', 'T'].includes(m.definitionId))).toHaveLength(1); // un seul vilain : le chef
    }
    expect(chiefs.has('M') && chiefs.has('T')).toBe(true);
    for (const id of ['OM', 'OC', 'SB', 'HB']) expect(seen.has(id), id).toBe(true);
  });

  it('le tirage reste reproductible par graine', () => {
    expect(generateScenario({ tileCount: 6, seed: 77 }, ORIGINAL_CONTENT)).toEqual(generateScenario({ tileCount: 6, seed: 77 }, ORIGINAL_CONTENT));
  });

  it('une partie se crée depuis un scénario généré, avec des Beastmen en major', () => {
    for (const seed of seeds) {
      const def = generateScenario({ tileCount: 7, seed }, ORIGINAL_CONTENT);
      const g = createScenarioGame(def, { sessionId: 's', difficulty: 'medium', seed: 1, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT);
      expect(g.monsters).toHaveLength(def.monsters.length);
    }
  });
});

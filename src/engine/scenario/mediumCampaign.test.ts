import { describe, expect, it } from 'vitest';
import { boxProblems } from '../figurines';
import { CELL_CAPACITY, key, samePos } from '../movement/board';
import { heroStartsEnclosed } from '../startArea';
import { tilePlacementProblems } from '../tileCatalog';
import { layoutExtent } from '../tiles';
import { createScenarioGame, scenarioBoard, validateScenario, type ScenarioDefinition } from './definition';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES, ORIGINAL_SCENARIOS, SIEGE_DE_VAL_NOIR, scenarioById } from '@/game-data/original';

const CHAPTERS = SIEGE_DE_VAL_NOIR.chapters.map((c) => scenarioById(c.scenarioId)!);
const LEVELS = ['1', '2-3', '4-5', '4-5', '6'];
const start = { sessionId: 's', difficulty: 'medium' as const, seed: 1, heroes: ORIGINAL_HEROES.slice(0, 3) };
const count = (def: ScenarioDefinition, id: string) => def.monsters.filter((m) => m.definitionId === id).length;
const reinforcements = (def: ScenarioDefinition) => (def.script ?? []).flatMap((r) => r.then).flatMap((e) => (e.type === 'spawn' ? [e] : []));
const has = (list: { x: number; y: number }[] | undefined, c: { x: number; y: number }) => (list ?? []).some((x) => samePos(x, c));

/** Cases atteignables depuis le départ : un mur arrête le passage, une porte (fermée ou ouverte) le laisse passer. */
function reachable(def: ScenarioDefinition): Set<string> {
  const { board } = scenarioBoard(def, ORIGINAL_CONTENT);
  const wall = new Set(board.walls.map(([a, b]) => [key(a), key(b)].sort().join('|')));
  const seen = new Set(def.heroStarts.map(key));
  const queue = [...def.heroStarts];
  for (let i = 0; i < queue.length; i++) {
    for (const d of [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]) {
      const n = { x: queue[i]!.x + d.x, y: queue[i]!.y + d.y };
      if (n.x < 0 || n.y < 0 || n.x >= board.width || n.y >= board.height || board.holes.some((h) => samePos(h, n)) || seen.has(key(n))) continue;
      if (wall.has([key(queue[i]!), key(n)].sort().join('|'))) continue;
      seen.add(key(n));
      queue.push(n);
    }
  }
  return seen;
}

describe('la campagne moyenne « Le Siège de Val-Noir »', () => {
  it('cinq chapitres écrits à la main, dans l’ordre, tous enregistrés', () => {
    expect(SIEGE_DE_VAL_NOIR.chapters.map((c) => c.scenarioId)).toEqual(['pont-du-guet', 'halle-aux-grains', 'remparts-de-val-noir', 'fosse-aux-cendres', 'trone-de-val-noir']);
    expect(CHAPTERS.every(Boolean)).toBe(true);
    expect(new Set(SIEGE_DE_VAL_NOIR.chapters.map((c) => c.scenarioId)).size).toBe(5);
    for (const c of SIEGE_DE_VAL_NOIR.chapters) expect(c.bridge.length).toBeGreaterThan(20);
    expect(ORIGINAL_SCENARIOS.map((s) => s.id)).toEqual(expect.arrayContaining(CHAPTERS.map((c) => c.id)));
  });

  it('monte sur les quatre niveaux de cartes : 1, 2-3, 4-5, 4-5, 6', () => {
    expect(CHAPTERS.map((c) => c.monsterCardSet)).toEqual(LEVELS);
    // Le Goblin Archer n'apparaît qu'à partir du niveau 2-3.
    expect(count(CHAPTERS[0]!, 'GA')).toBe(0);
    for (const c of CHAPTERS.slice(1)) expect(count(c, 'GA')).toBeGreaterThan(0);
  });

  it('la difficulté recommandée ne baisse jamais d’un chapitre au suivant', () => {
    const rank = { easy: 0, medium: 1, hard: 2, legendary: 3 } as const;
    const r = CHAPTERS.map((c) => rank[c.recommended!]);
    expect(r).toEqual([...r].sort());
  });

  it.each(CHAPTERS.map((c) => [c.id, c] as const))('%s : valide, une partie se crée avec les trois héros de la guilde', (_id, def) => {
    expect(validateScenario(def, ORIGINAL_CONTENT)).toEqual([]);
    const g = createScenarioGame(def, start, ORIGINAL_CONTENT);
    expect(g.heroes).toHaveLength(3);
    expect(g.monsters).toHaveLength(def.monsters.length);
    expect(g.monsterCardSet).toBe(def.monsterCardSet);
  });

  it.each(CHAPTERS.map((c) => [c.id, c] as const))('%s : boîtes respectées, renforts du script compris', (_id, def) => {
    const counts = new Map<string, number>();
    for (const m of [...def.monsters, ...reinforcements(def)]) {
      const d = ORIGINAL_CONTENT.monsters[m.definitionId]!;
      counts.set(d.group ?? d.id, (counts.get(d.group ?? d.id) ?? 0) + 1);
    }
    expect(boxProblems(counts, ORIGINAL_CONTENT.monsters)).toEqual([]);
  });

  it.each(CHAPTERS.map((c) => [c.id, c] as const))('%s : tout est atteignable depuis le départ, et les héros peuvent sortir de leur bâtiment', (_id, def) => {
    const reach = reachable(def);
    const { spawnPoints, board } = scenarioBoard(def, ORIGINAL_CONTENT);
    for (const m of def.monsters) expect(reach.has(key(m.at)), m.id).toBe(true);
    for (const q of def.quests) expect(reach.has(key(q.at!)), q.id).toBe(true);
    for (const r of reinforcements(def)) expect(reach.has(key(r.at)), r.monsterId).toBe(true);
    for (const sp of spawnPoints) expect(reach.has(key(sp.at)), sp.id).toBe(true);
    expect(heroStartsEnclosed(board, def.heroStarts)).toBe(false);
  });

  it.each(CHAPTERS.map((c) => [c.id, c] as const))('%s : pions porte (22 au plus, un spécial au plus), 1 à 5 jetons Spawn, une face par tuile', (_id, def) => {
    const { board, spawnPoints } = scenarioBoard(def, ORIGINAL_CONTENT);
    expect(board.doors.length).toBeGreaterThanOrEqual(1);
    expect(board.doors.length).toBeLessThanOrEqual(22);
    expect(board.doors.filter((d) => d.special).length).toBeLessThanOrEqual(1);
    expect(spawnPoints.length).toBeGreaterThanOrEqual(1);
    expect(spawnPoints.length).toBeLessThanOrEqual(5);
    expect(tilePlacementProblems(def.tiles!.placements.map((p) => p.tileId)).errors).toEqual([]);
  });

  it.each(CHAPTERS.map((c) => [c.id, c] as const))('%s : jamais plus de 2 figurines par case, aucune sur une case absente ou un jeton Spawn', (_id, def) => {
    const { board, spawnPoints } = scenarioBoard(def, ORIGINAL_CONTENT);
    const per = new Map<string, number>();
    for (const m of def.monsters) per.set(key(m.at), (per.get(key(m.at)) ?? 0) + 1);
    for (const h of def.heroStarts) per.set(key(h), (per.get(key(h)) ?? 0) + 1);
    expect([...per.values()].every((n) => n <= CELL_CAPACITY)).toBe(true);
    for (const m of def.monsters) {
      expect(has(board.holes, m.at), m.id).toBe(false);
      expect(spawnPoints.some((sp) => samePos(sp.at, m.at)), m.id).toBe(false);
    }
  });

  it.each(CHAPTERS.map((c) => [c.id, c] as const))('%s : chaque quête a sa règle de script, le script ne cite que ce qui existe, le deck couvre les types présents', (_id, def) => {
    const doors = scenarioBoard(def, ORIGINAL_CONTENT).board.doors.map((d) => d.id);
    const monsters = [...def.monsters.map((m) => m.id), ...reinforcements(def).map((r) => r.monsterId)];
    const completed = (def.script ?? []).flatMap((r) => r.then).flatMap((e) => (e.type === 'complete-quest' ? [e.questId] : []));
    expect(completed.sort()).toEqual(def.quests.map((q) => q.id).sort());
    for (const rule of def.script ?? []) {
      for (const c of rule.when) {
        if (c.type === 'door-open') expect(doors, rule.id).toContain(c.doorId);
        if (c.type === 'monster-down') expect(monsters, rule.id).toContain(c.monsterId);
      }
    }
    const types = new Set([...def.monsters.map((m) => m.definitionId), ...reinforcements(def).map((r) => r.definitionId)]);
    expect(new Set(def.deck!.listedMonsterIds)).toEqual(types);
    expect(def.quests.length).toBeGreaterThanOrEqual(2);
  });

  it('chaque chapitre a un chef en garde dont la chute accomplit la dernière quête', () => {
    for (const def of CHAPTERS) {
      const rule = def.script!.find((r) => r.when.some((c) => c.type === 'monster-down'))!;
      const cond = rule.when.find((c) => c.type === 'monster-down')!;
      const chief = def.monsters.find((m) => cond.type === 'monster-down' && m.id === cond.monsterId)!;
      expect(chief.guard, def.id).toBe(true);
    }
  });

  it('les plateaux varient : 4, 6, 7, 8 puis 9 tuiles, avec un emplacement vide et une tuile décalée', () => {
    expect(CHAPTERS.map((c) => c.tiles!.placements.length)).toEqual([4, 6, 7, 8, 9]);
    expect(layoutExtent(CHAPTERS[0]!.tiles!)).toEqual({ width: 6, height: 6 });
    expect(layoutExtent(CHAPTERS[1]!.tiles!)).toEqual({ width: 9, height: 6 });
    expect(CHAPTERS[4]!.tiles!.placements.some((p) => (p.dx ?? 0) !== 0 || (p.dy ?? 0) !== 0)).toBe(true);
    expect(scenarioBoard(CHAPTERS[3]!, ORIGINAL_CONTENT).board.holes.length).toBeGreaterThanOrEqual(9);
  });

  it('chapitre 5 : le final a le plus de monstres, avec le Minotaur chef et le Troll à ses côtés', () => {
    const last = CHAPTERS[4]!;
    expect(Math.max(...CHAPTERS.map((c) => c.monsters.length))).toBe(last.monsters.length);
    expect(count(last, 'M')).toBe(1);
    expect(count(last, 'T')).toBe(1);
  });
});

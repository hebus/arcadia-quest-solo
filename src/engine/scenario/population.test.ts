import { describe, expect, it } from 'vitest';
import { boxProblems } from '../figurines';
import { CELL_CAPACITY, key, samePos } from '../movement/board';
import { createScenarioGame, scenarioBoard, validateScenario } from './definition';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES } from '@/game-data/original';
import { CAVE_AUX_CENDRES as S1 } from '@/game-data/original/scenarios/cave-aux-cendres';

const count = (defId: string) => S1.monsters.filter((m) => m.definitionId === defId).length;
const reinforcements = (S1.script ?? []).flatMap((r) => r.then).flatMap((e) => (e.type === 'spawn' ? [e] : []));
const start = { sessionId: 's', difficulty: 'medium' as const, seed: 1, heroes: ORIGINAL_HEROES.slice(0, 3) };
const board = scenarioBoard(S1, ORIGINAL_CONTENT).board;
const inside = (c: { x: number; y: number }) => [...(board.interior ?? []), ...(board.rooms ?? [])].some((x) => samePos(x, c));

describe('scénario 1 : la population de niveau 1', () => {
  it('le scénario est valide et une partie se crée', () => {
    expect(validateScenario(S1, ORIGINAL_CONTENT)).toEqual([]);
    expect(createScenarioGame(S1, start, ORIGINAL_CONTENT).monsters).toHaveLength(S1.monsters.length);
  });

  it('les six types de niveau 1 sont présents : Minotaur, Troll, Orc Captain, Spear Beastman, Hammer Beastman, Orc Marauder', () => {
    expect({ M: count('M'), T: count('T'), OC: count('OC'), SB: count('SB'), HB: count('HB'), OM: count('OM') }).toEqual({ M: 1, T: 1, OC: 2, SB: 2, HB: 1, OM: 4 });
  });

  it('le chef, Seigneur Cendre, est le Minotaur : un vilain tenu en garde dans la chapelle, objectif de la quête « seigneur »', () => {
    const chief = S1.monsters.find((m) => m.definitionId === 'M')!;
    expect(ORIGINAL_CONTENT.monsters.M!.kind).toBe('villain');
    expect(chief.guard).toBe(true);
    expect(S1.quests.find((q) => q.id === 'seigneur')!.at).toEqual(chief.at);
    expect(S1.script!.find((r) => r.id === 'seigneur-tombe')!.when).toEqual([{ type: 'monster-down', monsterId: chief.id }]);
    expect((board.interior ?? []).some((c) => samePos(c, chief.at))).toBe(true); // dans la chapelle
  });

  it('le Troll garde la grande salle ; les Orc Captain gardent la chapelle et la remise', () => {
    const troll = S1.monsters.find((m) => m.definitionId === 'T')!;
    expect(troll.guard).toBe(true);
    expect((board.rooms ?? []).some((c) => samePos(c, troll.at))).toBe(true);
    const captains = S1.monsters.filter((m) => m.definitionId === 'OC');
    expect(captains.every((m) => m.guard)).toBe(true);
    expect(captains.every((m) => (board.interior ?? []).some((c) => samePos(c, m.at)))).toBe(true);
  });

  it('un Spear Beastman est collé à un autre monstre (dé en plus), pas l’autre ; le Hammer Beastman patrouille la rue', () => {
    const adjacent = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
    const sb = S1.monsters.filter((m) => m.definitionId === 'SB');
    expect(sb.map((m) => S1.monsters.some((o) => o !== m && adjacent(o.at, m.at))).filter(Boolean)).toHaveLength(1);
    expect(inside(S1.monsters.find((m) => m.definitionId === 'HB')!.at)).toBe(false);
  });

  it('les boîtes sont respectées, renforts du script compris (8 Orcs, 1 Minotaur, 1 Troll, 2 SB, 2 HB)', () => {
    const counts = new Map<string, number>();
    for (const m of [...S1.monsters, ...reinforcements]) {
      const def = ORIGINAL_CONTENT.monsters[m.definitionId]!;
      const box = def.group ?? def.id;
      counts.set(box, (counts.get(box) ?? 0) + 1);
    }
    expect(boxProblems(counts, ORIGINAL_CONTENT.monsters)).toEqual([]);
    expect(counts.get('orc')).toBe(8); // 6 au départ + 2 renforts : toute la boîte, pas un de plus
    expect(reinforcements.map((r) => r.definitionId)).toEqual(['OM', 'OM']);
  });

  it('les renforts ont des identifiants à eux et des cases libres, hors murs et cases bloquées', () => {
    const ids = [...S1.monsters.map((m) => m.id), ...reinforcements.map((r) => r.monsterId)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of reinforcements) {
      expect(S1.monsters.some((m) => samePos(m.at, r.at))).toBe(false);
      expect(board.holes.some((h) => samePos(h, r.at))).toBe(false);
    }
  });

  it('jamais plus de deux figurines par case, aucune sur une case bloquée ou absente, aucune sur un jeton Spawn', () => {
    const per = new Map<string, number>();
    for (const m of S1.monsters) per.set(key(m.at), (per.get(key(m.at)) ?? 0) + 1);
    expect([...per.values()].every((n) => n <= CELL_CAPACITY)).toBe(true);
    for (const m of S1.monsters) {
      expect(m.at.x).toBeLessThan(board.width);
      expect(m.at.y).toBeLessThan(board.height);
      expect(board.holes.some((h) => samePos(h, m.at)), m.id).toBe(false);
    }
    const spawns = scenarioBoard(S1, ORIGINAL_CONTENT).spawnPoints;
    expect(spawns.some((sp) => S1.monsters.some((m) => samePos(m.at, sp.at)))).toBe(false);
  });

  it('tout est atteignable depuis le départ des héros (une porte, fermée ou ouverte, se franchit)', () => {
    const edge = (a: { x: number; y: number }, b: { x: number; y: number }) => (key(a) < key(b) ? `${key(a)}|${key(b)}` : `${key(b)}|${key(a)}`);
    const walls = new Set(board.walls.map(([a, b]) => edge(a, b)));
    const doors = new Set(board.doors.map((d) => edge(d.a, d.b)));
    const seen = new Set(S1.heroStarts.map(key));
    const queue = [...S1.heroStarts];
    for (let i = 0; i < queue.length; i++) {
      for (const d of [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]) {
        const n = { x: queue[i]!.x + d.x, y: queue[i]!.y + d.y };
        if (n.x < 0 || n.y < 0 || n.x >= board.width || n.y >= board.height || board.holes.some((h) => samePos(h, n)) || seen.has(key(n))) continue;
        if (walls.has(edge(queue[i]!, n)) && !doors.has(edge(queue[i]!, n))) continue;
        seen.add(key(n));
        queue.push(n);
      }
    }
    for (const m of S1.monsters) expect(seen.has(key(m.at)), m.id).toBe(true);
    for (const q of S1.quests) expect(seen.has(key(q.at!)), q.id).toBe(true);
    for (const r of reinforcements) expect(seen.has(key(r.at)), r.monsterId).toBe(true);
  });

  it('le deck liste tous les types présents, au niveau 1', () => {
    expect(S1.monsterCardSet).toBe('1');
    expect([...S1.deck!.listedMonsterIds!].sort()).toEqual(['HB', 'M', 'OC', 'OM', 'SB', 'T']);
    const g = createScenarioGame(S1, start, ORIGINAL_CONTENT);
    expect([...new Set([...g.deck.draw, ...g.deck.discard].map((c) => c.monsterDefId))].sort()).toEqual(['HB', 'M', 'OC', 'OM', 'SB', 'T']);
  });
});

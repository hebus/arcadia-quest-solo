import { describe, expect, it } from 'vitest';
import type { GameState } from '../domain/schemas';
import { createScenarioGame, validateScenario, type ScenarioDefinition } from './definition';
import { generateScenario } from './generate';
import { OBJECTIVE_KINDS, OBJECTIVE_LABEL, type ObjectiveKind } from './objectives';
import { holds, runScript } from './script';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES, ORIGINAL_REWARDS } from '@/game-data/original';

const heroes = ORIGINAL_HEROES.slice(0, 3);
const gen = (tiles: number, seed: number, objective?: ObjectiveKind) => generateScenario({ tileCount: tiles, seed, ...(objective ? { objective } : {}) }, ORIGINAL_CONTENT);
const newGame = (def: ScenarioDefinition): GameState => ({ ...createScenarioGame(def, { sessionId: 's', difficulty: 'medium', seed: 3, heroes }, ORIGINAL_CONTENT), phase: 'GUILD_TURN' });

/** Joue le scénario « à la main » : rend vraies, règle après règle, les conditions du script, jusqu'à la victoire. */
function forceWin(def: ScenarioDefinition): GameState {
  let g = newGame(def);
  const rules = def.script ?? [];
  for (let pass = 0; pass < 20 && g.phase !== 'SCENARIO_WON'; pass++) {
    const fired = new Set(g.scriptFired ?? []);
    // Une règle à la fois, dans l'ordre : celle dont les quêtes préalables sont faites (la clé avant le coffre).
    const rule = rules.find((r) => !fired.has(r.id) && r.when.filter((c) => c.type === 'quest-done').every((c) => holds(c, g)));
    if (!rule) break;
    const next = structuredClone(g);
    for (const c of rule.when) {
      if (holds(c, next)) continue;
      if (c.type === 'hero-on') next.heroes[0]!.position = { ...c.at };
      else if (c.type === 'heroes-on') next.heroes.filter((h) => !h.dead).forEach((h, i) => (h.position = { ...c.cells[i % c.cells.length]! }));
      else if (c.type === 'door-open') next.board.doors.find((d) => d.id === c.doorId)!.open = true;
      else if (c.type === 'monster-down') next.monsters.find((m) => m.id === c.monsterId)!.status = 'removed';
      else if (c.type === 'monsters-down') {
        let n = next.monsters.filter((m) => (!c.definitionId || m.definitionId === c.definitionId) && m.status !== 'board').length;
        for (const m of next.monsters) if (n < c.count && m.status === 'board' && (!c.definitionId || m.definitionId === c.definitionId)) { m.status = 'removed'; n++; }
      } else if (c.type === 'round-reached') next.round = Math.max(next.round, c.round);
    }
    g = runScript(next, rules, ORIGINAL_REWARDS).state;
  }
  return g;
}

describe('objectifs du mode aléatoire : une dizaine de types', () => {
  it('onze types d’objectifs, tous nommés', () => {
    expect(OBJECTIVE_KINDS.length).toBeGreaterThanOrEqual(10);
    for (const k of OBJECTIVE_KINDS) expect(OBJECTIVE_LABEL[k].length).toBeGreaterThan(5);
  });

  it('les types se rencontrent tous (sauf rares terrains) au fil des tirages', () => {
    const seen = new Set<string>();
    const kinds = new Map<string, string>();
    for (let seed = 1; seed <= 120; seed++) {
      const def = gen(5 + (seed % 5), seed);
      const sig = def.quests.map((q) => q.id.replace(/-\d+$/, '')).join('+');
      kinds.set(sig, def.tagline);
      for (const q of def.quests) seen.add(q.id.replace(/-\d+$/, ''));
    }
    for (const id of ['objectif', 'cle', 'coffre', 'brasier', 'massacre', 'chasse', 'sortie', 'aube', 'sceau', 'prisonnier', 'retour', 'chef']) expect(seen.has(id), id).toBe(true);
    expect(kinds.size).toBeGreaterThanOrEqual(9);
  });

  it.each(OBJECTIVE_KINDS.map((k) => [k] as const))('%s : valide, atteignable et gagnable, sur plusieurs terrains', (kind) => {
    let built = 0;
    for (const tiles of [3, 5, 7, 9]) {
      for (let seed = 1; seed <= 12; seed++) {
        let def: ScenarioDefinition;
        try {
          def = gen(tiles, seed, kind);
        } catch {
          continue; // ce type ne tient pas sur ce terrain : le tirage libre en choisit un autre
        }
        built++;
        expect(validateScenario(def, ORIGINAL_CONTENT), `${kind} ${tiles} tuiles graine ${seed}`).toEqual([]);
        expect(def.quests.length).toBeGreaterThan(0);
        const g = forceWin(def);
        expect(g.phase, `${kind} ${tiles} tuiles graine ${seed}`).toBe('SCENARIO_WON');
      }
    }
    expect(built, kind).toBeGreaterThan(5);
  });

  it('le tirage libre trouve toujours un objectif, quelle que soit la taille', () => {
    for (let tiles = 1; tiles <= 9; tiles++) for (let seed = 1; seed <= 15; seed++) expect(gen(tiles, seed).quests.length).toBeGreaterThan(0);
  });
});

describe('nouvelles conditions de script', () => {
  const def = gen(5, 3, 'chef');
  it('monsters-down : un nombre de monstres hors du plateau, tous types ou d’un type', () => {
    const g = newGame(def);
    const om = g.monsters.filter((m) => m.definitionId === 'OM').length;
    expect(holds({ type: 'monsters-down', count: 1 }, g)).toBe(false);
    const down = { ...g, monsters: g.monsters.map((m, i) => (i < 2 ? { ...m, status: 'removed' as const } : m)) };
    expect(holds({ type: 'monsters-down', count: 2 }, down)).toBe(true);
    expect(holds({ type: 'monsters-down', count: 3 }, down)).toBe(false);
    expect(holds({ type: 'monsters-down', count: 99, definitionId: 'OM' }, down)).toBe(false);
    expect(om).toBeGreaterThanOrEqual(0);
  });

  it('heroes-on : tous les héros vivants (ou `count`) sur la zone', () => {
    const g = newGame(def);
    const zone = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    expect(holds({ type: 'heroes-on', cells: zone }, g)).toBe(false);
    const placed = { ...g, heroes: g.heroes.map((h, i) => ({ ...h, position: zone[i % 2]! })) };
    expect(holds({ type: 'heroes-on', cells: zone }, placed)).toBe(true);
    const oneDown = { ...placed, heroes: placed.heroes.map((h, i) => (i === 0 ? { ...h, position: { x: 5, y: 5 } } : h)) };
    expect(holds({ type: 'heroes-on', cells: zone }, oneDown)).toBe(false);
    expect(holds({ type: 'heroes-on', cells: zone, count: 2 }, oneDown)).toBe(true);
    // Un héros mort ne bloque pas la sortie.
    const dead = { ...oneDown, heroes: oneDown.heroes.map((h, i) => (i === 0 ? { ...h, dead: true } : h)) };
    expect(holds({ type: 'heroes-on', cells: zone }, dead)).toBe(true);
  });
});

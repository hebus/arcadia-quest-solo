import { describe, expect, it } from 'vitest';
import { applyCorrection } from './corrections';
import { reachableCells } from './combat/heroMove';
import type { GameState } from './domain/schemas';
import { CELL_CAPACITY } from './movement/board';
import { planMonsterAction } from './movement/plan';
import { validateScenario } from './scenario/definition';
import { runScript, type Rule } from './scenario/script';
import { restGuild, startScenario } from './turn/machine';
import { validateGameState } from './setup';
import { demoGame, testContent } from '@/tests/fixtures/demo';
import { ORIGINAL_CONTENT } from '@/game-data/original';
import { CAVE_AUX_CENDRES } from '@/game-data/original/scenarios/cave-aux-cendres';

const at = (x: number, y: number) => ({ x, y });
const has = (cells: { pos: { x: number; y: number } }[], x: number, y: number) => cells.some((c) => c.pos.x === x && c.pos.y === y);

/** Plateau ouvert 8×5 : Grom (h1) en (0,2), Maya (h2) en (1,2), Zazu loin ; monstres placés par chaque test. */
const world = (monsters: { id: string; definitionId: string; position: { x: number; y: number } }[] = [], heroes: { x: number; y: number }[] = [at(0, 2), at(1, 2), at(0, 4)]) =>
  startScenario(
    demoGame({
      heroes: [
        { id: 'h1', name: 'Grom', life: 4, defense: 0, position: heroes[0]! },
        { id: 'h2', name: 'Maya', life: 3, defense: 0, position: heroes[1]! },
        { id: 'h3', name: 'Zazu', life: 3, defense: 0, position: heroes[2]! },
      ],
      monsters,
    }),
  );

describe('une seule figurine par case', () => {
  it('capacité de la règle : 1', () => {
    expect(CELL_CAPACITY).toBe(1);
  });

  it('un héros ne peut pas s’arrêter sur la case d’un allié, mais peut la traverser', () => {
    const reach = reachableCells(world(), 'h1', 3);
    expect(has(reach, 1, 2)).toBe(false); // Maya occupe la case
    expect(has(reach, 2, 2)).toBe(true); // derrière elle, accessible en la traversant
    expect(reach.find((r) => r.pos.x === 2 && r.pos.y === 2)!.cost).toBe(2);
  });

  it('un monstre remplit sa case : le héros ne s’y arrête pas et ne la traverse pas', () => {
    const g = world([{ id: 'g1', definitionId: 'goblin', position: at(1, 2) }], [at(0, 2), at(0, 0), at(0, 4)]);
    const reach = reachableCells(g, 'h1', 3);
    expect(has(reach, 1, 2)).toBe(false);
    expect(has(reach, 2, 2)).toBe(false); // trop loin en contournant
    expect(has(reach, 1, 1)).toBe(true);
  });

  it('un monstre ne s’arrête pas sur une case occupée et ne traverse pas un héros', () => {
    // Gobelin en (3,2) vise Grom en (5,2) ; un autre monstre occupe (4,2), la case voisine directe de Grom.
    const g = world(
      [
        { id: 'g1', definitionId: 'goblin', position: at(3, 2) },
        { id: 'o1', definitionId: 'orc', position: at(4, 2) },
      ],
      [at(5, 2), at(0, 0), at(0, 4)],
    );
    const plan = planMonsterAction(g, testContent, 'g1', 3, { targetKind: 'hero', onlyTargetId: 'h1', choose: (_p, o) => o[0]! });
    expect(plan.destination).not.toEqual(at(4, 2)); // case occupée
    expect(plan.canAttack).toBe(true); // il contourne
    expect(Math.abs(plan.destination.x - 5) + Math.abs(plan.destination.y - 2)).toBe(1); // adjacent à Grom
    expect(plan.steps.every((st) => !(st.to.x === 5 && st.to.y === 2))).toBe(true); // jamais sur Grom
  });

  describe('corrections et résurrection', () => {
    it('recaler un pion sur la case d’une autre figurine est refusé', () => {
      const g = world([{ id: 'g1', definitionId: 'goblin', position: at(4, 2) }]);
      expect(() => applyCorrection(g, { kind: 'hero-position', heroId: 'h1', to: at(1, 2) })).toThrow(/déjà occupée/);
      expect(() => applyCorrection(g, { kind: 'hero-position', heroId: 'h1', to: at(4, 2) })).toThrow(/déjà occupée/);
      expect(() => applyCorrection(g, { kind: 'monster-position', monsterId: 'g1', to: at(0, 2) })).toThrow(/déjà occupée/);
      expect(() => applyCorrection(g, { kind: 'monster-status', monsterId: 'g1', status: 'board', at: at(1, 2) })).toThrow(/déjà occupée/);
    });

    it('recaler un pion sur sa propre case ou sur une case libre reste permis', () => {
      const g = world([{ id: 'g1', definitionId: 'goblin', position: at(4, 2) }]);
      expect(() => applyCorrection(g, { kind: 'hero-position', heroId: 'h1', to: at(0, 2) })).not.toThrow();
      expect(applyCorrection(g, { kind: 'hero-position', heroId: 'h1', to: at(2, 0) }).heroes[0]!.position).toEqual(at(2, 0));
    });

    it('ressusciter un héros sur la case d’une autre figurine est refusé, sur une case libre non', () => {
      const dead = { ...world(), heroes: world().heroes.map((h) => (h.id === 'h3' ? { ...h, dead: true, position: null } : h)) } as GameState;
      expect(() => restGuild(dead, { h3: at(1, 2) })).toThrow(/déjà occupée/);
      expect(restGuild(dead, { h3: at(3, 3) }).heroes[2]!.position).toEqual(at(3, 3));
    });

    it('deux héros ressuscités ne peuvent pas choisir la même case', () => {
      const w = world();
      const dead = { ...w, heroes: w.heroes.map((h) => (h.id === 'h2' || h.id === 'h3' ? { ...h, dead: true, position: null } : h)) } as GameState;
      expect(() => restGuild(dead, { h2: at(3, 3), h3: at(3, 3) })).toThrow(/déjà occupée/);
    });
  });

  describe('apparitions et renforts', () => {
    it('un renfort du script sur une case occupée par UNE figurine est annulé', () => {
      const g = world();
      const rule: Rule = { id: 'r', when: [{ type: 'round-reached', round: 1 }], then: [{ type: 'spawn', monsterId: 'x', definitionId: 'goblin', at: at(1, 2) }] };
      const r = runScript(g, [rule]);
      expect(r.state.monsters.some((m) => m.id === 'x')).toBe(false);
      expect(r.state.events.some((e) => e.type === 'script-skipped')).toBe(true);
    });

    it('un renfort sur une case libre apparaît', () => {
      const rule: Rule = { id: 'r', when: [{ type: 'round-reached', round: 1 }], then: [{ type: 'spawn', monsterId: 'x', definitionId: 'goblin', at: at(5, 4) }] };
      expect(runScript(world(), [rule]).state.monsters.some((m) => m.id === 'x')).toBe(true);
    });
  });

  describe('validation', () => {
    it('la mise en place refuse deux figurines sur une case', () => {
      const g = demoGame();
      g.monsters[0]!.position = { ...g.heroes[0]!.position! };
      expect(validateGameState(g, testContent).join()).toMatch(/Plus d'un personnage/);
    });

    it('un scénario dont un monstre part sur la case d’un héros est refusé', () => {
      const bad = { ...CAVE_AUX_CENDRES, monsters: [{ id: 'm', definitionId: 'rodeur', at: CAVE_AUX_CENDRES.heroStarts[0]! }] };
      expect(validateScenario(bad, ORIGINAL_CONTENT).join()).toMatch(/Plus d'une figurine/);
    });

    it('deux monstres sur la même case sont refusés dans un scénario', () => {
      const bad = { ...CAVE_AUX_CENDRES, monsters: [{ id: 'a', definitionId: 'rodeur', at: at(4, 8) }, { id: 'b', definitionId: 'rodeur', at: at(4, 8) }] };
      expect(validateScenario(bad, ORIGINAL_CONTENT).join()).toMatch(/Plus d'une figurine/);
    });

    it('le scénario livré respecte la règle', () => {
      expect(validateScenario(CAVE_AUX_CENDRES, ORIGINAL_CONTENT)).toEqual([]);
    });
  });
});

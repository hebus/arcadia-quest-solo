import { describe, expect, it } from 'vitest';
import { applyCorrection } from './corrections';
import { reachableCells } from './combat/heroMove';
import type { GameState } from './domain/schemas';
import { CELL_CAPACITY, monsterView } from './movement/board';
import { canHeroTarget } from './combat/heroMove';
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

describe('deux figurines au maximum par case', () => {
  it('capacité de la règle : 2', () => {
    expect(CELL_CAPACITY).toBe(2);
  });

  it('un héros peut s’arrêter sur la case d’un allié (une seule figurine), pas sur une case pleine, mais la traverse', () => {
    const one = reachableCells(world(), 'h1', 3);
    expect(has(one, 1, 2)).toBe(true); // Maya seule : il reste une place
    // Zazu rejoint Maya : la case (1,2) est pleine.
    const full = world([], [at(0, 2), at(1, 2), at(1, 2)]);
    const reach = reachableCells(full, 'h1', 3);
    expect(has(reach, 1, 2)).toBe(false);
    expect(has(reach, 2, 2)).toBe(true); // derrière, accessible en traversant des alliés
    expect(reach.find((r) => r.pos.x === 2 && r.pos.y === 2)!.cost).toBe(2);
  });

  it('un seul monstre ne bloque pas la case ; deux monstres la bloquent (Blocked Space)', () => {
    const one = world([{ id: 'g1', definitionId: 'goblin', position: at(1, 2) }], [at(0, 2), at(0, 0), at(0, 4)]);
    expect(has(reachableCells(one, 'h1', 3), 1, 2)).toBe(true);
    const two = world(
      [
        { id: 'g1', definitionId: 'goblin', position: at(1, 2) },
        { id: 'o1', definitionId: 'orc', position: at(1, 2) },
      ],
      [at(0, 2), at(0, 0), at(0, 4)],
    );
    const reach = reachableCells(two, 'h1', 3);
    expect(has(reach, 1, 2)).toBe(false); // pleine
    expect(has(reach, 2, 2)).toBe(false); // et non traversable : trop loin en contournant
    expect(has(reach, 1, 1)).toBe(true);
  });

  it('un monstre peut partager la case d’un autre monstre, mais pas une case pleine', () => {
    // Gobelin en (3,2) vise Grom en (5,2) ; un orc occupe (4,2), la case voisine directe de Grom.
    const one = world(
      [
        { id: 'g1', definitionId: 'goblin', position: at(3, 2) },
        { id: 'o1', definitionId: 'orc', position: at(4, 2) },
      ],
      [at(5, 2), at(0, 0), at(0, 4)],
    );
    const plan1 = planMonsterAction(one, testContent, 'g1', 3, { targetKind: 'hero', onlyTargetId: 'h1', choose: (_p, o) => o[0]! });
    expect(plan1.canAttack).toBe(true);
    expect(Math.abs(plan1.destination.x - 5) + Math.abs(plan1.destination.y - 2)).toBeLessThanOrEqual(1); // sur la Space de Grom ou à côté
    // Deux monstres sur (4,2) : case pleine, le gobelin ne s'y arrête pas et contourne.
    const full = world(
      [
        { id: 'g1', definitionId: 'goblin', position: at(3, 2) },
        { id: 'o1', definitionId: 'orc', position: at(4, 2) },
        { id: 'o2', definitionId: 'orc', position: at(4, 2) },
      ],
      [at(5, 2), at(0, 0), at(0, 4)],
    );
    const plan2 = planMonsterAction(full, testContent, 'g1', 3, { targetKind: 'hero', onlyTargetId: 'h1', choose: (_p, o) => o[0]! });
    expect(plan2.destination).not.toEqual(at(4, 2));
    expect(plan2.canAttack).toBe(true); // il atteint quand même Grom (une case voisine libre, ou sa propre case)
  });

  describe('cases pleines : déplacement et ligne de vue', () => {
    // Grom (0,2) ; Maya (1,2) et un monstre g1 la rejoignent : (1,2) contient 1 héros + 1 monstre.
    const mixed = () => world([{ id: 'g1', definitionId: 'goblin', position: at(1, 2) }], [at(0, 2), at(1, 2), at(0, 4)]);
    // Deux monstres (ennemis de Grom) en (1,2).
    const twoEnemies = () =>
      world(
        [
          { id: 'g1', definitionId: 'goblin', position: at(1, 2) },
          { id: 'o1', definitionId: 'orc', position: at(1, 2) },
        ],
        [at(0, 2), at(0, 0), at(0, 4)],
      );

    it('2 ennemis : la case bloque le déplacement, on ne peut ni s’y arrêter ni la traverser (héros comme monstres)', () => {
      const reach = reachableCells(twoEnemies(), 'h1', 3);
      expect(has(reach, 1, 2)).toBe(false);
      expect(has(reach, 2, 2)).toBe(false); // derrière la case : on ne la traverse pas
      // Du point de vue d'un monstre : deux héros bloquent la case.
      const heroes = world([{ id: 'g1', definitionId: 'goblin', position: at(3, 2) }], [at(1, 2), at(1, 2), at(0, 4)]);
      const view = monsterView(heroes, at(1, 2), 'g1');
      expect(view).toMatchObject({ blocked: true, canTraverse: false, canEnd: false });
    });

    it('1 héros + 1 monstre : un autre héros ou monstre peut traverser la case mais pas s’y arrêter', () => {
      const g = mixed();
      // Héros : Grom traverse la case (1,2) pour atteindre (2,2) sans pouvoir s'arrêter sur (1,2).
      const reach = reachableCells(g, 'h1', 3);
      expect(has(reach, 1, 2)).toBe(false);
      expect(has(reach, 2, 2)).toBe(true);
      expect(reach.find((r) => r.pos.x === 2 && r.pos.y === 2)!.cost).toBe(2);
      // Monstre : même chose pour un autre monstre (g2).
      const withG2 = { ...g, monsters: [...g.monsters, { ...g.monsters[0]!, id: 'g2', position: at(3, 2) }] } as GameState;
      expect(monsterView(withG2, at(1, 2), 'g2')).toMatchObject({ blocked: false, canTraverse: true, canEnd: false });
    });

    it('la ligne de vue est bloquée par 2 ennemis, pas par 1 héros + 1 monstre', () => {
      const shot = (blockers: { id: string; definitionId: string; position: { x: number; y: number } }[], heroes: { x: number; y: number }[]) =>
        canHeroTarget(world([{ id: 'g1', definitionId: 'goblin', position: at(4, 2) }, ...blockers], heroes), 'h1', 'g1', 'ranged');
      // Case (2,2) : Maya (héros) + un monstre → ne bloque pas.
      expect(shot([{ id: 'o1', definitionId: 'orc', position: at(2, 2) }], [at(0, 2), at(2, 2), at(0, 4)])).toBe(true);
      // Case (2,2) : deux monstres → bloque.
      expect(shot([{ id: 'o1', definitionId: 'orc', position: at(2, 2) }, { id: 'o2', definitionId: 'orc', position: at(2, 2) }], [at(0, 2), at(0, 0), at(0, 4)])).toBe(false);
    });
  });

  describe('corrections et résurrection', () => {
    const crowded = () =>
      world([
        { id: 'g1', definitionId: 'goblin', position: at(1, 2) }, // avec Maya : (1,2) est pleine
        { id: 'g2', definitionId: 'goblin', position: at(4, 2) },
      ]);

    it('recaler un pion sur une case pleine est refusé', () => {
      const g = crowded();
      expect(() => applyCorrection(g, { kind: 'hero-position', heroId: 'h1', to: at(1, 2) })).toThrow(/pleine/);
      expect(() => applyCorrection(g, { kind: 'monster-position', monsterId: 'g2', to: at(1, 2) })).toThrow(/pleine/);
      expect(() => applyCorrection(g, { kind: 'monster-status', monsterId: 'g2', status: 'board', at: at(1, 2) })).toThrow(/pleine/);
    });

    it('recaler un pion sur sa propre case, sur une case libre ou avec une seule figurine reste permis', () => {
      const g = crowded();
      expect(() => applyCorrection(g, { kind: 'hero-position', heroId: 'h1', to: at(0, 2) })).not.toThrow();
      expect(applyCorrection(g, { kind: 'hero-position', heroId: 'h1', to: at(2, 0) }).heroes[0]!.position).toEqual(at(2, 0));
      expect(applyCorrection(g, { kind: 'hero-position', heroId: 'h1', to: at(4, 2) }).heroes[0]!.position).toEqual(at(4, 2)); // g2 seul
    });

    it('ressusciter un héros sur une case pleine est refusé ; avec une seule figurine ou sur une case libre non', () => {
      const w = crowded();
      const dead = { ...w, heroes: w.heroes.map((h) => (h.id === 'h3' ? { ...h, dead: true, position: null } : h)) } as GameState;
      expect(() => restGuild(dead, { h3: at(1, 2) })).toThrow(/pleine/);
      expect(restGuild(dead, { h3: at(4, 2) }).heroes[2]!.position).toEqual(at(4, 2));
      expect(restGuild(dead, { h3: at(3, 3) }).heroes[2]!.position).toEqual(at(3, 3));
    });

    it('trois héros ressuscités ne peuvent pas choisir la même case, deux oui', () => {
      const w = world();
      const dead = { ...w, heroes: w.heroes.map((h) => ({ ...h, dead: true, position: null })) } as GameState;
      expect(() => restGuild(dead, { h1: at(3, 3), h2: at(3, 3), h3: at(3, 3) })).toThrow(/pleine/);
      expect(() => restGuild(dead, { h1: at(3, 3), h2: at(3, 3), h3: at(4, 3) })).not.toThrow();
    });
  });

  describe('apparitions et renforts', () => {
    it('un renfort du script sur une case pleine est annulé', () => {
      const g = world([{ id: 'g1', definitionId: 'goblin', position: at(1, 2) }]); // Maya + g1
      const rule: Rule = { id: 'r', when: [{ type: 'round-reached', round: 1 }], then: [{ type: 'spawn', monsterId: 'x', definitionId: 'goblin', at: at(1, 2) }] };
      const r = runScript(g, [rule]);
      expect(r.state.monsters.some((m) => m.id === 'x')).toBe(false);
      expect(r.state.events.some((e) => e.type === 'script-skipped')).toBe(true);
    });

    it('un renfort sur une case avec une seule figurine, ou libre, apparaît', () => {
      const one: Rule = { id: 'r', when: [{ type: 'round-reached', round: 1 }], then: [{ type: 'spawn', monsterId: 'x', definitionId: 'goblin', at: at(1, 2) }] };
      expect(runScript(world(), [one]).state.monsters.some((m) => m.id === 'x')).toBe(true); // Maya seule
      const free: Rule = { id: 'r', when: [{ type: 'round-reached', round: 1 }], then: [{ type: 'spawn', monsterId: 'x', definitionId: 'goblin', at: at(5, 4) }] };
      expect(runScript(world(), [free]).state.monsters.some((m) => m.id === 'x')).toBe(true);
    });
  });

  describe('validation', () => {
    it('la mise en place accepte deux figurines sur une case et en refuse trois', () => {
      const g = demoGame();
      g.monsters[0]!.position = { ...g.heroes[0]!.position! };
      expect(validateGameState(g, testContent).join()).not.toMatch(/Plus de 2/);
      g.monsters[1]!.position = { ...g.heroes[0]!.position! };
      expect(validateGameState(g, testContent).join()).toMatch(/Plus de 2 personnages/);
    });

    it('un scénario avec un monstre sur un départ de héros est accepté, avec deux monstres il est refusé', () => {
      const start = CAVE_AUX_CENDRES.heroStarts[0]!;
      const one = { ...CAVE_AUX_CENDRES, monsters: [{ id: 'm', definitionId: 'OM', at: start }] };
      expect(validateScenario(one, ORIGINAL_CONTENT).join()).not.toMatch(/Plus de 2/);
      const bad = { ...CAVE_AUX_CENDRES, monsters: [{ id: 'm', definitionId: 'OM', at: start }, { id: 'n', definitionId: 'OM', at: start }] };
      expect(validateScenario(bad, ORIGINAL_CONTENT).join()).toMatch(/Plus de 2 figurines/);
    });

    it('deux monstres sur la même case sont acceptés dans un scénario, trois sont refusés', () => {
      const m = (id: string) => ({ id, definitionId: 'OM', at: at(4, 8) });
      expect(validateScenario({ ...CAVE_AUX_CENDRES, monsters: [m('a'), m('b')] }, ORIGINAL_CONTENT).join()).not.toMatch(/Plus de 2/);
      expect(validateScenario({ ...CAVE_AUX_CENDRES, monsters: [m('a'), m('b'), m('c')] }, ORIGINAL_CONTENT).join()).toMatch(/Plus de 2 figurines/);
    });

    it('le scénario livré respecte la règle', () => {
      expect(validateScenario(CAVE_AUX_CENDRES, ORIGINAL_CONTENT)).toEqual([]);
    });
  });
});

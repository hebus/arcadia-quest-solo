import { describe, expect, it } from 'vitest';
import type { GameState } from './domain/schemas';
import { createScenarioGame } from './scenario/definition';
import { occupancy } from './movement/board';
import { planMonsterAction } from './movement/plan';
import { runMonsterTurn } from './activation/monsterTurn';
import { startScenario } from './turn/machine';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES } from '@/game-data/original';
import { CAVE_AUX_CENDRES_LEGACY as CAVE_AUX_CENDRES } from '@/tests/fixtures/legacyScenario';

/** Deux héros (dont un furtif) sur la même case : elle est pleine, aucun monstre ne peut s'y arrêter. */
function world(monsterId: string, defId: string, at: { x: number; y: number }, full: { x: number; y: number }): GameState {
  const g = startScenario(createScenarioGame(CAVE_AUX_CENDRES, { sessionId: 's', difficulty: 'medium', seed: 5, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT));
  return {
    ...g,
    heroes: g.heroes.map((h, i) => (i === 0 ? { ...h, position: full, stealth: true } : i === 1 ? { ...h, position: full } : { ...h, position: { x: 8, y: 8 } })),
    monsters: g.monsters.map((m, i) => (i === 0 ? { ...m, id: monsterId, definitionId: defId, position: at, status: 'board' as const, isGuard: false } : { ...m, position: null, status: 'box' as const })),
  };
}

describe('case pleine (2 héros) : aucun monstre ne s’y arrête', () => {
  for (const defId of ['SB', 'OM', 'GA']) {
    it(`${defId}, d'où qu'il parte, ne termine pas son déplacement sur la case des deux héros`, () => {
      const full = { x: 5, y: 5 };
      const probe = world('M1', defId, { x: 0, y: 0 }, full);
      for (let x = 0; x < probe.board.width; x++) {
        for (let y = 0; y < probe.board.height; y++) {
          if (probe.board.holes.some((h) => h.x === x && h.y === y) || (x === full.x && y === full.y)) continue;
          const g = world('M1', defId, { x, y }, full);
          for (const mp of [1, 3, 6]) {
            const plan = planMonsterAction(g, ORIGINAL_CONTENT, 'M1', mp, { targetKind: 'hero', choose: (_p, o) => o[0]! });
            const total = occupancy(g, plan.destination, 'M1');
            expect(total.heroes + total.pets + total.monsters, `${defId} (${x},${y}) mp ${mp} → (${plan.destination.x},${plan.destination.y})`).toBeLessThan(2);
          }
        }
      }
    });
  }
});

describe('tour des monstres complet : jamais plus de deux figurines sur une case', () => {
  it('Spear Beastman (tir puis repli) ne rejoint pas une case occupée par deux héros', () => {
    const full = { x: 5, y: 5 };
    const cells: { x: number; y: number }[] = [];
    const probe = world('M1', 'SB', { x: 0, y: 0 }, full);
    for (let x = 0; x < probe.board.width; x++) for (let y = 0; y < probe.board.height; y++) if (!probe.board.holes.some((h) => h.x === x && h.y === y) && !(x === full.x && y === full.y)) cells.push({ x, y });
    let played = 0;
    for (const at of cells) {
      const g0 = world('M1', 'SB', at, full);
      const g = {
        ...g0,
        phase: 'MONSTER_TURN_SPAWN' as const,
        settings: { ...g0.settings, defenseRoll: 'digital' as const },
        deck: { ...g0.deck, draw: [{ id: 'SB:1', kind: 'monster' as const, monsterDefId: 'SB' }, { id: 'SB:2', kind: 'monster' as const, monsterDefId: 'SB' }], discard: [] },
      };
      let r;
      try {
        r = runMonsterTurn(g, ORIGINAL_CONTENT);
      } catch {
        continue;
      }
      played += 1;
      const end = r.state.monsters.find((m) => m.id === 'M1')!.position!;
      const o = occupancy(r.state, end, 'M1');
      expect(o.heroes + o.pets + o.monsters, `SB parti de (${at.x},${at.y}) finit en (${end.x},${end.y})`).toBeLessThan(2);
    }
    expect(played).toBeGreaterThan(cells.length / 2);
  });
});

describe('étape de déplacement : le trajet annoncé s’arrête là où le monstre est vraiment', () => {
  it('ouvrir une porte avec son dernier PM ne place pas le monstre de l’autre côté (sur la case des héros)', () => {
    const full = { x: 5, y: 5 };
    const g0 = world('M1', 'SB', { x: 4, y: 5 }, full);
    const g = {
      ...g0,
      phase: 'MONSTER_TURN_SPAWN' as const,
      settings: { ...g0.settings, defenseRoll: 'digital' as const },
      board: { ...g0.board, doors: [...g0.board.doors, { id: 'porte-test', a: { x: 4, y: 5 }, b: full, open: false }] },
      deck: { ...g0.deck, draw: [{ id: 'SB:1', kind: 'monster' as const, monsterDefId: 'SB' }, { id: 'SB:2', kind: 'monster' as const, monsterDefId: 'SB' }], discard: [] },
    };
    const r = runMonsterTurn(g, ORIGINAL_CONTENT);
    const end = r.state.monsters.find((m) => m.id === 'M1')!.position!;
    for (const i of r.instructions.filter((x) => x.kind === 'move' && x.actorId === 'M1')) {
      const last = i.path![i.path!.length - 1]!;
      expect(last, `trajet annoncé ${JSON.stringify(i.path)} ; position réelle (${end.x},${end.y})`).toEqual(end);
    }
  });
});

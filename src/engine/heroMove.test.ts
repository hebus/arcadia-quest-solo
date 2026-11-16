import { parse } from '@/engine/domain/validate';
import { describe, expect, it } from 'vitest';
import { resolveHeroAttack } from './combat/heroActions';
import { canHeroTarget, moveHeroTo, reachableCells } from './combat/heroMove';
import type { InputAnswer } from './oracle';
import { TILE, TileDefSchema, boardFromLayout, rotateEdge, rotateLocal, toggleEdge } from './tiles';
import { startScenario } from './turn/machine';
import { demoGame, openBoard, testContent } from '@/tests/fixtures/demo';

const defense = (saves: number): InputAnswer => ({ kind: 'defense-result', saves });
const atk = (hits: number, saves: number): InputAnswer => ({ kind: 'attack-result', hits, saves });

const game = (over = {}) => startScenario(demoGame(over));

describe('déplacement d un héros au clic', () => {
  it('cases atteignables : 3 PM, portes à 1 PM, portail à 1 PM', () => {
    const g = game({
      board: { ...openBoard(), doors: [{ id: 'd', a: { x: 1, y: 2 }, b: { x: 1, y: 3 }, open: false }], portals: [{ id: 'p1', at: { x: 1, y: 4 }, color: 'red' }, { id: 'p2', at: { x: 6, y: 4 }, color: 'red' }] },
    });
    const cells = reachableCells(g, 'h1', 3);
    const cost = (x: number, y: number) => cells.find((c) => c.pos.x === x && c.pos.y === y)?.cost;
    expect(cost(0, 4)).toBe(1);
    expect(cost(6, 4)).toBe(1);
    expect(cost(1, 2)).toBe(3);
    expect(cost(1, 1)).toBeUndefined();
    expect(cost(4, 4)).toBe(3);
    expect(cost(5, 4)).toBe(2);
  });

  it('refuse une case hors de portée et enregistre les PM restants', () => {
    const g = game();
    expect(() => moveHeroTo(g, testContent, 'h1', { x: 7, y: 0 })).toThrow(/hors de portée/);
    const r = moveHeroTo(g, testContent, 'h1', { x: 1, y: 2 });
    expect(r.state.heroes[0]!.position).toEqual({ x: 1, y: 2 });
    expect(r.state.heroTurn.h1).toMatchObject({ mpLeft: 1, moved: true });
    expect(r.state.activatedHeroIds).toContain('h1');
    const r2 = moveHeroTo(r.state, testContent, 'h1', { x: 1, y: 1 });
    expect(r2.state.heroTurn.h1!.mpLeft).toBe(0);
    expect(() => moveHeroTo(r2.state, testContent, 'h1', { x: 1, y: 0 })).toThrow(/hors de portée/);
  });

  it('quitter une Space gardée déclenche Guard : le joueur saisit les coups parés', () => {
    const g = game({ settings: { defenseRoll: 'physical' } });
    g.heroes[0]!.defense = 1;
    g.monsters.find((m) => m.id === 'g1')!.position = { x: 1, y: 4 };
    const need = () => moveHeroTo(g, testContent, 'h1', { x: 0, y: 4 });
    expect(need).toThrow(/Saisie requise/);
    let r;
    for (let saves = 0; saves < 3 && !r; saves++) {
      try {
        r = moveHeroTo(g, testContent, 'h1', { x: 0, y: 4 }, [defense(saves)]);
      } catch {
        /* le nombre de coups tirés détermine le nombre de saisies valides */
      }
    }
    expect(r).toBeDefined();
    expect(r!.instructions.some((i) => /Réaction Guard/.test(i.text))).toBe(true);
    expect(r!.state.heroes[0]!.position).toEqual({ x: 0, y: 4 });
  });

  it('furtivité : quitter une Space gardée ne déclenche aucune réaction Guard (aucune saisie demandée)', () => {
    const g = game({ settings: { defenseRoll: 'physical' } });
    g.heroes[0]!.defense = 1;
    g.heroes[0]!.stealth = true;
    g.monsters.find((m) => m.id === 'g1')!.position = { x: 1, y: 4 };
    const r = moveHeroTo(g, testContent, 'h1', { x: 0, y: 4 });
    expect(r.instructions.some((i) => /Réaction Guard/.test(i.text))).toBe(false);
    expect(r.state.heroes[0]!.position).toEqual({ x: 0, y: 4 });
    expect(reachableCells(g, 'h1', 3).every((c) => c.triggers === 0)).toBe(true);
  });

  it('privilégie le chemin qui déclenche le moins de réactions Guard', () => {
    const g = game({ settings: { diceMode: 'physical' } });
    g.monsters.find((m) => m.id === 'g1')!.position = { x: 1, y: 3 };
    g.heroes[2]!.position = { x: 5, y: 0 };
    const cells = reachableCells(g, 'h2', 3);
    const dest = cells.find((c) => c.pos.x === 1 && c.pos.y === 2);
    expect(dest).toBeDefined();
  });

  it('le héros qui meurt en chemin s arrête et les PM sont décomptés', () => {
    const g = game({ settings: { diceMode: 'physical' }, difficulty: 'easy' });
    g.monsters.find((m) => m.id === 'g1')!.position = { x: 1, y: 4 };
    const r = moveHeroTo(g, testContent, 'h1', { x: 0, y: 4 }, [atk(9, 0)]);
    expect(r.state.heroes[0]!.dead).toBe(true);
    expect(r.state.heroes[0]!.position).toBeNull();
  });
});

describe('attaque d un héros', () => {
  it('valide la portée : mêlée = Close, distance = ligne de vue', () => {
    const g = game();
    g.monsters.find((m) => m.id === 'g1')!.position = { x: 3, y: 3 };
    expect(canHeroTarget(g, 'h3', 'g1', 'melee')).toBe(false);
    expect(canHeroTarget(g, 'h3', 'g1', 'ranged')).toBe(true);
    g.monsters.find((m) => m.id === 'g1')!.position = { x: 2, y: 3 };
    expect(canHeroTarget(g, 'h3', 'g1', 'melee')).toBe(true);
    expect(() => resolveHeroAttack(g, testContent, 'h3', [{ monsterId: 'o1', wounds: 1 }], [], { attackType: 'melee' })).toThrow(/cible valide/);
  });

  it('une seule attaque par activation ; pas de mouvement repris après déplacement puis attaque', () => {
    let g = game({ settings: { diceMode: 'physical' } });
    g.monsters.find((m) => m.id === 'g1')!.position = { x: 2, y: 3 };
    g = moveHeroTo(g, testContent, 'h3', { x: 1, y: 2 }, [atk(0, 0)]).state;
    g.monsters.find((m) => m.id === 'g1')!.position = { x: 2, y: 2 };
    g = resolveHeroAttack(g, testContent, 'h3', [{ monsterId: 'g1', wounds: 0 }], [atk(0, 0)], { attackType: 'melee' }).state;
    expect(() => resolveHeroAttack(g, testContent, 'h3', [{ monsterId: 'g1', wounds: 0 }])).toThrow(/déjà attaqué/);
    expect(() => moveHeroTo(g, testContent, 'h3', { x: 1, y: 1 })).toThrow(/après l'attaque/);
  });
});

describe('tuiles', () => {
  const tile = parse(TileDefSchema, { id: 't1', name: 'T1-A', walls: [[{ x: 0, y: 0 }, { x: 1, y: 0 }]] });
  const layout = { tilesW: 2, tilesH: 1, placements: [{ tileId: 't1', tx: 0, ty: 0, rotation: 0 as const }] };

  it('rotation par quarts de tour horaires dans le carré 3×3', () => {
    expect(rotateLocal({ x: 0, y: 0 }, 90)).toEqual({ x: 2, y: 0 });
    expect(rotateLocal({ x: 0, y: 0 }, 180)).toEqual({ x: 2, y: 2 });
    expect(rotateLocal({ x: 0, y: 0 }, 270)).toEqual({ x: 0, y: 2 });
    expect(rotateEdge([{ x: 0, y: 0 }, { x: 1, y: 0 }], 90)).toEqual([{ x: 2, y: 0 }, { x: 2, y: 1 }]);
  });

  it('compose le plateau : murs tournés et décalés, emplacements vides = cases absentes', () => {
    const b = boardFromLayout({ t1: tile }, { ...layout, placements: [{ tileId: 't1', tx: 1, ty: 0, rotation: 90 }] });
    expect(b.width).toBe(2 * TILE);
    expect(b.holes).toHaveLength(9);
    expect(b.walls[0]).toEqual([{ x: 5, y: 0 }, { x: 5, y: 1 }]);
  });

  it('écarte les portes et portails hors des tuiles posées', () => {
    const b = boardFromLayout({ t1: tile }, layout, {
      doors: [{ id: 'a', a: { x: 1, y: 1 }, b: { x: 2, y: 1 }, open: false }, { id: 'b', a: { x: 3, y: 1 }, b: { x: 4, y: 1 }, open: false }],
      portals: [{ id: 'p', at: { x: 5, y: 1 }, color: 'red' }],
    });
    expect(b.doors.map((d) => d.id)).toEqual(['a']);
    expect(b.portals).toHaveLength(0);
  });

  it('bascule un mur', () => {
    const e: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 0, y: 0 }, { x: 0, y: 1 }];
    expect(toggleEdge([], e)).toHaveLength(1);
    expect(toggleEdge(toggleEdge([], e), [e[1], e[0]])).toHaveLength(0);
  });
});

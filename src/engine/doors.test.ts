import { describe, expect, it } from 'vitest';
import { resolveHeroAttack } from './combat/heroActions';
import { adjacentClosedDoors, adjacentDoors, canHeroTarget, closeDoorAsHero, moveHeroTo, openDoorAsHero, reachableCells } from './combat/heroMove';
import type { GameState } from './domain/schemas';
import { createScenarioGame } from './scenario/definition';
import { startScenario } from './turn/machine';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES } from '@/game-data/original';
import { CAVE_AUX_CENDRES } from '@/game-data/original/scenarios/cave-aux-cendres';

const DOOR = 'porte-remise'; // porte fermée entre (2,6) dans la rue et (2,5) dans la remise

/** Mira (h1) en (2,6), au bord de la porte fermée de la remise ; rôdeur 1 collé à elle en (3,6). */
function started(): GameState {
  const g = startScenario(createScenarioGame(CAVE_AUX_CENDRES, { sessionId: 's', difficulty: 'medium', seed: 4, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT));
  return {
    ...g,
    settings: { ...g.settings, defenseRoll: 'digital' as const },
    heroes: g.heroes.map((h) => (h.id === 'h1' ? { ...h, position: { x: 2, y: 6 } } : h)),
    monsters: g.monsters.map((m) => (m.id === 'OM1' ? { ...m, position: { x: 3, y: 6 } } : m)),
  };
}
const door = (g: GameState) => g.board.doors.find((d) => d.id === DOOR)!;
const open = (g: GameState, id = 'h1') => openDoorAsHero(g, ORIGINAL_CONTENT, id, DOOR);

describe('ouvrir une porte : 1 point de mouvement, pas une action', () => {
  it('au déplacement, la porte coûte 1 PM et n’empêche pas d’avancer avec les points restants', () => {
    const g = started();
    const reach = reachableCells(g, 'h1', 3);
    expect(reach.find((r) => r.pos.x === 2 && r.pos.y === 5)?.cost).toBe(2); // 1 PM la porte + 1 PM le pas
    expect(reachableCells(g, 'h1', 1).some((r) => r.pos.x === 2 && r.pos.y === 5)).toBe(false); // avec 1 PM : porte seulement
    const r = moveHeroTo(g, ORIGINAL_CONTENT, 'h1', { x: 2, y: 5 });
    expect(r.state.heroes[0]!.position).toEqual({ x: 2, y: 5 });
    expect(door(r.state).open).toBe(true);
    expect(r.state.heroTurn.h1).toMatchObject({ mpLeft: 1, moved: true, attacked: false });
    expect(r.instructions[0]!.visual).toMatchObject({ type: 'move', doorIds: [DOOR] });
  });

  it('ouvrir la porte seule : 1 PM dépensé, le héros reste sur sa case, la porte est ouverte', () => {
    const r = open(started());
    expect(door(r.state).open).toBe(true);
    expect(r.state.heroes[0]!.position).toEqual({ x: 2, y: 6 });
    expect(r.state.heroTurn.h1!.mpLeft).toBe(2);
    expect(r.instructions).toHaveLength(1);
    expect(r.instructions[0]!.visual).toEqual({ type: 'door', doorId: DOOR, open: true });
    expect(r.state.events.some((e) => e.type === 'hero-door')).toBe(true);
  });

  it('ce n’est pas une action : l’attaque reste disponible', () => {
    const opened = open(started()).state;
    expect(opened.heroTurn.h1!.attacked).toBe(false);
    const hit = resolveHeroAttack(opened, ORIGINAL_CONTENT, 'h1', [{ monsterId: 'OM1', wounds: 1 }], [], { weaponId: 'lame' });
    expect(hit.state.heroTurn.h1!.attacked).toBe(true);
  });

  it('ce n’est pas la fin du mouvement : le héros avance ensuite avec les points restants', () => {
    const opened = open(started()).state;
    const r = moveHeroTo(opened, ORIGINAL_CONTENT, 'h1', { x: 2, y: 5 });
    expect(r.state.heroes[0]!.position).toEqual({ x: 2, y: 5 });
    expect(r.state.heroTurn.h1!.mpLeft).toBe(1); // 3 − 1 (porte) − 1 (pas)
  });

  it('aucune réaction Guard : le héros ne quitte pas sa case, même avec un monstre collé à lui', () => {
    const r = open(started());
    expect(r.instructions.map((i) => i.id).some((id) => id.startsWith('Réaction Guard'))).toBe(false);
    expect(r.state.heroes[0]!.wounds).toBe(0);
  });

  it('attaque puis porte : permis tant que le mouvement n’avait pas commencé ; ensuite plus de déplacement', () => {
    const attacked = resolveHeroAttack(started(), ORIGINAL_CONTENT, 'h1', [{ monsterId: 'OM1', wounds: 1 }], [], { weaponId: 'lame' }).state;
    const r = open(attacked);
    expect(door(r.state).open).toBe(true);
    expect(() => moveHeroTo(r.state, ORIGINAL_CONTENT, 'h1', { x: 2, y: 5 })).toThrow(/ne peut pas être repris/);
  });

  it('déplacement puis attaque puis porte : refusé, le mouvement ne se reprend pas après l’attaque', () => {
    const g0 = started();
    const moved = moveHeroTo({ ...g0, heroes: g0.heroes.map((h) => (h.id === 'h1' ? { ...h, position: { x: 2, y: 7 } } : h)) }, ORIGINAL_CONTENT, 'h1', { x: 2, y: 6 }).state;
    const attacked = resolveHeroAttack(moved, ORIGINAL_CONTENT, 'h1', [{ monsterId: 'OM1', wounds: 1 }], [], { weaponId: 'lame' }).state;
    expect(() => open(attacked)).toThrow(/ne peut pas être repris/);
  });

  it('refus : porte éloignée, déjà ouverte, plus de PM, héros mort, porte inconnue', () => {
    const g = started();
    expect(() => open(g, 'h2')).toThrow(/pas au bord/); // h2 est en (1,8)
    expect(() => open(open(g).state)).toThrow(/déjà ouverte/);
    expect(() => open({ ...g, heroTurn: { h1: { mpLeft: 0, moved: false, attacked: false } }, activatedHeroIds: ['h1'] })).toThrow(/Aucun point de mouvement/);
    expect(() => open({ ...g, heroes: g.heroes.map((h) => (h.id === 'h1' ? { ...h, dead: true } : h)) })).toThrow();
    expect(() => openDoorAsHero(g, ORIGINAL_CONTENT, 'h1', 'fantome')).toThrow(/inconnue/);
  });

  it('adjacentClosedDoors : seulement les portes fermées au bord de la case du héros', () => {
    const g = started();
    expect(adjacentClosedDoors(g, 'h1')).toEqual([DOOR]);
    expect(adjacentClosedDoors(g, 'h2')).toEqual([]);
    expect(adjacentClosedDoors(open(g).state, 'h1')).toEqual([]);
  });

  it('ouvrir la porte active le héros comme tout premier geste', () => {
    const r = open(started());
    expect(r.state.activatedHeroIds).toContain('h1');
  });
});

describe('fermer une porte : 1 point de mouvement, pas une action', () => {
  const opened = () => open(started()).state;
  const close = (g: GameState, id = 'h1') => closeDoorAsHero(g, ORIGINAL_CONTENT, id, DOOR);

  it('referme la porte ouverte : 1 PM de plus, le héros reste sur sa case', () => {
    const r = close(opened());
    expect(door(r.state).open).toBe(false);
    expect(r.state.heroes[0]!.position).toEqual({ x: 2, y: 6 });
    expect(r.state.heroTurn.h1!.mpLeft).toBe(1); // 3 − 1 (ouvrir) − 1 (fermer)
    expect(r.instructions[0]!.visual).toEqual({ type: 'door', doorId: DOOR, open: false });
    expect(r.instructions[0]!.label).toBe('Fermer la porte');
  });

  it('ouvrir puis fermer coûte 2 PM ; il reste 1 PM pour agir autrement', () => {
    const g = close(opened()).state;
    expect(g.heroTurn.h1!.mpLeft).toBe(1);
    expect(g.heroTurn.h1!.attacked).toBe(false);
  });

  it('ce n’est pas une action : l’attaque reste disponible, sans réaction Guard', () => {
    const r = close(opened());
    expect(r.state.heroTurn.h1!.attacked).toBe(false);
    expect(r.instructions.map((i) => i.id).some((id) => id.startsWith('Réaction Guard'))).toBe(false);
    const hit = resolveHeroAttack(r.state, ORIGINAL_CONTENT, 'h1', [{ monsterId: 'OM1', wounds: 1 }], [], { weaponId: 'lame' });
    expect(hit.state.heroTurn.h1!.attacked).toBe(true);
  });

  it('une porte fermée coupe la ligne de vue et le mouvement, comme un mur', () => {
    const g = opened();
    // Brute 1 est dans la remise en (2,4) : visible à travers la porte ouverte, plus une fois refermée.
    expect(canHeroTarget(g, 'h1', 'OM4', 'ranged')).toBe(true);
    const shut = close(g).state;
    expect(canHeroTarget(shut, 'h1', 'OM4', 'ranged')).toBe(false);
    expect(reachableCells(shut, 'h1', 1).some((r) => r.pos.x === 2 && r.pos.y === 5)).toBe(false);
  });

  it('refus : déjà fermée, plus de PM, éloignée, mouvement repris après l’attaque', () => {
    const g = started();
    expect(() => close(g)).toThrow(/déjà fermée/);
    expect(() => close({ ...opened(), heroTurn: { h1: { mpLeft: 0, moved: true, attacked: false } } })).toThrow(/Aucun point de mouvement/);
    // Maya (h2), éloignée : porte ouverte mais pas au bord de sa case (tour neuf, pour ne pas être refusée par « un héros par tour »).
    const freshTurn = { ...opened(), activatedHeroIds: [], heroTurn: {} };
    expect(() => closeDoorAsHero(freshTurn, ORIGINAL_CONTENT, 'h2', DOOR)).toThrow(/pas au bord/);
    const attacked = resolveHeroAttack(opened(), ORIGINAL_CONTENT, 'h1', [{ monsterId: 'OM1', wounds: 1 }], [], { weaponId: 'lame' }).state;
    expect(() => close(attacked)).toThrow(/ne peut pas être repris/); // déjà déplacé (porte ouverte) puis attaqué
  });

  it('adjacentDoors : portes au bord de la case, selon leur état', () => {
    const g = started();
    expect(adjacentDoors(g, 'h1', 'closed')).toEqual([DOOR]);
    expect(adjacentDoors(g, 'h1', 'open')).toEqual([]);
    expect(adjacentDoors(g, 'h1')).toEqual([DOOR]);
    const o = opened();
    expect(adjacentDoors(o, 'h1', 'open')).toEqual([DOOR]);
    expect(adjacentDoors(o, 'h1', 'closed')).toEqual([]);
    expect(adjacentDoors(o, 'h2')).toEqual([]);
    expect(adjacentClosedDoors(o, 'h1')).toEqual([]);
  });

  it('le même tour peut ouvrir, traverser puis la porte reste ouverte derrière', () => {
    const r = moveHeroTo(opened(), ORIGINAL_CONTENT, 'h1', { x: 2, y: 5 });
    expect(door(r.state).open).toBe(true);
    expect(r.state.heroTurn.h1!.mpLeft).toBe(1);
  });
});


import { describe, expect, it } from 'vitest';
import { resolveHeroAttack } from './combat/heroActions';
import type { GameState } from './domain/schemas';
import type { InputAnswer } from './oracle';
import { SPAWN_TILE_SLOTS } from './spawn/spawn';
import { startScenario } from './turn/machine';
import { demoGame, testContent } from '@/tests/fixtures/demo';

const die = (value: string): InputAnswer => ({ kind: 'die', value });
const physical = { diceMode: 'physical', cardMode: 'physical' } as const;

/** Tuile de capacité 2 avec `m1` déjà dessus ; Zazu (h3) tue ensuite g1, ce qui remplit la tuile. Jetons : S1 = A+B en (0,0), S2 = C+D en (7,4). */
function game(over: Parameters<typeof demoGame>[0] = {}): GameState {
  const s = startScenario(
    demoGame({
      settings: physical,
      spawnTileCapacity: 2,
      monsters: [
        { id: 'm1', definitionId: 'goblin', position: { x: 6, y: 4 } },
        { id: 'g1', definitionId: 'goblin', position: { x: 2, y: 3 } },
      ],
      ...over,
    }),
  );
  const m1 = s.monsters.find((m) => m.id === 'm1')!;
  m1.status = 'spawn-tile';
  m1.position = null;
  s.spawnTile = ['m1'];
  return s;
}
const kill = (s: GameState, answers: InputAnswer[]) => resolveHeroAttack(s, testContent, 'h3', [{ monsterId: 'g1', wounds: 9 }], answers);
const at = (r: ReturnType<typeof kill>, id: string) => r.state.monsters.find((m) => m.id === id)!;

describe('tuile d’apparition', () => {
  it('compte 5 emplacements', () => {
    expect(SPAWN_TILE_SLOTS).toBe(5);
    expect(demoGame().spawnTileCapacity).toBe(5);
  });

  it('un monstre tué prend le premier emplacement libre ; tant qu’elle n’est pas pleine, personne n’apparaît', () => {
    const s = game({ spawnTileCapacity: 5 });
    const r = kill(s, []); // aucun jet de dés demandé
    expect(r.state.spawnTile).toEqual(['m1', 'g1']);
    expect(at(r, 'g1').status).toBe('spawn-tile');
    expect(at(r, 'm1').status).toBe('spawn-tile');
  });

  it('dès que la tuile est pleine, chaque monstre apparaît dans l’ordre des emplacements, sur le jeton désigné par ses 2 dés', () => {
    const r = kill(game(), [die('A'), die('B'), die('C'), die('D')]); // m1 → S1 (0,0), g1 → S2 (7,4)
    expect(r.state.spawnTile).toEqual([]);
    expect(at(r, 'm1')).toMatchObject({ status: 'board', position: { x: 0, y: 0 } });
    expect(at(r, 'g1')).toMatchObject({ status: 'board', position: { x: 7, y: 4 } });
    const ids = r.instructions.map((i) => i.id);
    expect(ids.indexOf('spawn-m1')).toBeLessThan(ids.indexOf('spawn-g1'));
    expect(ids.indexOf('spawn-m1')).toBeGreaterThan(ids.indexOf('hit-g1')); // le monstre tué d'abord, puis l'apparition
  });

  it('pas de jeton correspondant : le monstre est retiré définitivement du jeu', () => {
    const r = kill(game(), [die('A'), die('D'), die('C'), die('D')]); // A+D n'existe pas
    expect(at(r, 'm1')).toMatchObject({ status: 'box', position: null });
    expect(at(r, 'g1')).toMatchObject({ status: 'board', position: { x: 7, y: 4 } });
    expect(r.instructions.find((i) => i.id === 'box-m1')?.visual).toMatchObject({ type: 'remove' });
    expect(r.state.spawnTile).toEqual([]);
  });

  it('case du jeton occupée (2 figurines) : le monstre se place sur une case adjacente', () => {
    // Grom et Maya occupent (0,0), la case du jeton S1.
    const s = game();
    s.heroes = s.heroes.map((h) => (h.id === 'h1' || h.id === 'h2' ? { ...h, position: { x: 0, y: 0 } } : h));
    const r = kill(s, [die('A'), die('B'), die('C'), die('D')]);
    const m1 = at(r, 'm1');
    expect(m1.status).toBe('board');
    expect([{ x: 1, y: 0 }, { x: 0, y: 1 }]).toContainEqual(m1.position);
    expect(r.instructions.find((i) => i.id === 'spawn-m1')?.text).toMatch(/Space voisine du jeton S1/);
  });

  it('case du jeton occupée par une seule figurine : le monstre s’y place', () => {
    const s = game();
    s.heroes = s.heroes.map((h) => (h.id === 'h1' ? { ...h, position: { x: 0, y: 0 } } : h));
    const r = kill(s, [die('A'), die('B'), die('C'), die('D')]);
    expect(at(r, 'm1').position).toEqual({ x: 0, y: 0 });
  });

  it('case du jeton pleine et aucune case voisine libre : le monstre est retiré du jeu', () => {
    const s = game();
    // (0,0) pleine (Grom et Maya) ; ses voisines (1,0) et (0,1) pleines aussi (deux monstres chacune), loin de Zazu.
    s.heroes = s.heroes.map((h) => (h.id === 'h1' || h.id === 'h2' ? { ...h, position: { x: 0, y: 0 } } : h));
    s.monsters = s.monsters.concat(
      [
        ['x1', { x: 1, y: 0 }],
        ['x2', { x: 1, y: 0 }],
        ['x3', { x: 0, y: 1 }],
        ['x4', { x: 0, y: 1 }],
      ].map(([id, position]) => ({ id: id as string, definitionId: 'goblin', position: position as { x: number; y: number }, status: 'board' as const, isGuard: false, wounds: 0 })),
    );
    const r = kill(s, [die('A'), die('B'), die('C'), die('D')]);
    expect(at(r, 'm1').status).toBe('box');
  });
});

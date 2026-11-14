import { describe, expect, it } from 'vitest';
import { isClose, key, samePos } from '../movement/board';
import { boxProblems, boxRemaining } from '../figurines';
import { heroStartsEnclosed } from '../startArea';
import { tilePlacementProblems } from '../tileCatalog';
import { createScenarioGame, scenarioBoard, validateScenario } from './definition';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES } from '@/game-data/original';
import { TERRAIN_ESSAI } from '@/game-data/original/scenarios/terrain-essai';
import { startScenario } from '../turn/machine';

const def = TERRAIN_ESSAI;
const board = scenarioBoard(def, ORIGINAL_CONTENT).board;
const has = (list: { x: number; y: number }[] | undefined, p: { x: number; y: number }) => (list ?? []).some((c) => samePos(c, p));
const monster = (id: string) => def.monsters.find((m) => m.id === id)!;
const countByType = (): Record<string, number> => Object.fromEntries([...def.monsters.reduce((m, x) => m.set(x.definitionId, (m.get(x.definitionId) ?? 0) + 1), new Map<string, number>())]);

describe('terrain d’essai : le plateau', () => {
  it('est valide et construit depuis 6 tuiles du jeu, chacune sur une seule face', () => {
    expect(validateScenario(def, ORIGINAL_CONTENT)).toEqual([]);
    const ids = def.tiles!.placements.map((p) => p.tileId);
    expect(ids).toEqual(['5A', '4A', '2A', '7A', '1B', '3B']);
    expect(tilePlacementProblems(ids).errors).toEqual([]);
    expect(new Set(ids.map((id) => id[0])).size).toBe(6);
    expect(def.sandbox).toBe(true);
    expect(def.monsterCardSet).toBe('1');
  });

  it('reprend les définitions des tuiles : la case bloquée de la 4A, la salle de la 1B, les bâtiments des 2A et 7A', () => {
    expect(has(board.blocked, { x: 4, y: 1 })).toBe(true);
    expect(has(board.holes, { x: 4, y: 1 })).toBe(true);
    expect(board.rooms).toHaveLength(9);
    expect(has(board.rooms, { x: 4, y: 4 })).toBe(true);
    for (const p of [{ x: 8, y: 0 }, { x: 8, y: 1 }, { x: 8, y: 2 }, { x: 7, y: 2 }, { x: 6, y: 2 }]) expect(has(board.interior, p), JSON.stringify(p)).toBe(true); // chapelle en L
    for (const p of def.heroStarts) expect(has(board.interior, p)).toBe(true); // bâtiment de départ
  });

  it('la tuile 3B est décalée d’une case : une colonne vide, bloquante, apparaît et le plateau s’élargit', () => {
    expect(board.width).toBe(10);
    expect(board.height).toBe(6);
    for (const y of [3, 4, 5]) expect(has(board.holes, { x: 6, y })).toBe(true);
    expect(has(board.blocked, { x: 6, y: 4 })).toBe(false); // un vide, pas un bloc dessiné
    expect(has(board.holes, { x: 7, y: 4 })).toBe(false); // la tuile 3B
    expect(def.board).toContain('size 10x6');
  });

  it('trois pions porte (≤ 22) : chapelle fermée et spéciale, salle fermée, sortie du départ ouverte', () => {
    const doors = Object.fromEntries(board.doors.map((d) => [d.id, d]));
    expect(Object.keys(doors).sort()).toEqual(['porte-chapelle', 'porte-depart', 'porte-salle']);
    expect(doors['porte-chapelle']).toMatchObject({ open: false, special: true });
    expect(doors['porte-salle']).toMatchObject({ open: false });
    expect(doors['porte-salle']!.special).toBeUndefined();
    expect(doors['porte-depart']).toMatchObject({ open: true });
  });

  it('cinq jetons Spawn, un de chaque type, sur des cases de rue distinctes', () => {
    const tokens = def.board.split('\n').filter((l) => l.startsWith('spawn'));
    expect(tokens).toHaveLength(5);
    const types = tokens.map((l) => l.split(' ')[3]!.split('+').sort().join('+'));
    expect(new Set(types).size).toBe(5);
    expect(types.sort()).toEqual(['bow+bow', 'bow+crit', 'bow+sword', 'crit+sword', 'sword+sword']);
    const cells = tokens.map((l) => l.split(' ')[2]!);
    expect(new Set(cells).size).toBe(5);
    for (const c of cells) {
      const [x, y] = c.split(',').map(Number);
      const p = { x: x!, y: y! };
      expect(has(board.holes, p) || has(board.interior, p) || has(board.rooms, p), c).toBe(false);
    }
    // Les préréglages de dés du terrain visent S1 (épée+épée) et S2 (arc+arc).
    expect(tokens.find((l) => l.startsWith('spawn S1'))).toContain('sword+sword');
    expect(tokens.find((l) => l.startsWith('spawn S2'))).toContain('bow+bow');
  });
});

describe('terrain d’essai : la population', () => {
  it('un monstre de chaque type du niveau 1 : trois Marauder, un Captain, un Minotaur, un Troll, un Spear et un Hammer Beastman', () => {
    expect(countByType()).toEqual({ OM: 3, OC: 1, M: 1, T: 1, SB: 1, HB: 1 });
    expect(def.deck?.listedMonsterIds?.slice().sort()).toEqual(['HB', 'M', 'OC', 'OM', 'SB', 'T']);
  });

  it('les boîtes sont respectées, il reste de la place pour en ajouter par le menu', () => {
    const inPlay = new Map(Object.entries(countByType()));
    expect(boxProblems(inPlay, ORIGINAL_CONTENT.monsters)).toEqual([]);
    // 4 Orcs en jeu sur 8 (boîte commune au Marauder et au Captain) : il en reste 4 ; le Minotaur et le Troll n'ont plus de figurine.
    expect(boxRemaining(ORIGINAL_CONTENT.monsters.OM!, ORIGINAL_CONTENT.monsters, inPlay)).toBe(4);
    expect(boxRemaining(ORIGINAL_CONTENT.monsters.OC!, ORIGINAL_CONTENT.monsters, inPlay)).toBe(4);
    expect(boxRemaining(ORIGINAL_CONTENT.monsters.M!, ORIGINAL_CONTENT.monsters, inPlay)).toBe(0);
    expect(boxRemaining(ORIGINAL_CONTENT.monsters.T!, ORIGINAL_CONTENT.monsters, inPlay)).toBe(0);
    expect(boxRemaining(ORIGINAL_CONTENT.monsters.SB!, ORIGINAL_CONTENT.monsters, inPlay)).toBe(1);
    expect(boxRemaining(ORIGINAL_CONTENT.monsters.HB!, ORIGINAL_CONTENT.monsters, inPlay)).toBe(1);
  });

  it('aucun monstre sur un mur, une case bloquée ou un vide ; au plus 2 figurines par case', () => {
    const cells = [...def.monsters.map((m) => m.at), ...def.heroStarts];
    for (const p of cells) {
      expect(p.x >= 0 && p.y >= 0 && p.x < board.width && p.y < board.height, JSON.stringify(p)).toBe(true);
      expect(has(board.holes, p), JSON.stringify(p)).toBe(false);
    }
    const count = new Map<string, number>();
    for (const p of cells) count.set(key(p), (count.get(key(p)) ?? 0) + 1);
    expect(Math.max(...count.values())).toBeLessThanOrEqual(2);
  });

  it('placés pour essayer chaque compétence : Spear près d’un monstre, Troll Close à deux héros, Hammer à portée du départ', () => {
    const sb = monster('SB1').at;
    expect(def.monsters.some((m) => m.id !== 'SB1' && isClose(board, m.at, sb))).toBe(true); // un dé d'attaque en plus
    const troll = monster('T1').at;
    const close = def.heroStarts.filter((h) => isClose(board, troll, h));
    expect(close.length).toBeGreaterThanOrEqual(2); // son attaque cible tous les héros adjacents
    const g = startScenario(createScenarioGame(def, { sessionId: 's', difficulty: 'easy', seed: 1, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT));
    expect(g.monsters.find((m) => m.id === 'T1')!.position).toEqual(troll);
    // Gardes : le Captain à la porte de la chapelle, le Minotaur au fond.
    expect(monster('OC1').guard).toBe(true);
    expect(monster('M1').guard).toBe(true);
    expect(monster('OM3').guard).toBeUndefined();
  });

  it('les héros sortent de leur bâtiment de départ, et tout est atteignable depuis le départ (une porte, même fermée, se franchit)', () => {
    expect(heroStartsEnclosed(board, def.heroStarts)).toBe(false);
    const reach = new Set<string>(def.heroStarts.map(key));
    const queue = [...def.heroStarts];
    const edge = (a: { x: number; y: number }, b: { x: number; y: number }) => (key(a) < key(b) ? `${key(a)}|${key(b)}` : `${key(b)}|${key(a)}`);
    const walls = new Set(board.walls.map(([a, b]) => edge(a, b)));
    for (let i = 0; i < queue.length; i++) {
      for (const d of [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]) {
        const n = { x: queue[i]!.x + d.x, y: queue[i]!.y + d.y };
        if (n.x < 0 || n.y < 0 || n.x >= board.width || n.y >= board.height || has(board.holes, n) || reach.has(key(n)) || walls.has(edge(queue[i]!, n))) continue;
        reach.add(key(n));
        queue.push(n);
      }
    }
    for (const m of def.monsters) expect(reach.has(key(m.at)), m.id).toBe(true);
    expect(reach.has(key(def.quests[0]!.at!))).toBe(true);
  });

  it('garde sa quête « essai » (drapeau) sur une case de rue', () => {
    expect(def.quests).toHaveLength(1);
    expect(def.quests[0]).toMatchObject({ id: 'essai', icon: 'flag' });
    const at = def.quests[0]!.at!;
    expect(has(board.holes, at) || has(board.interior, at) || has(board.rooms, at)).toBe(false);
  });
});

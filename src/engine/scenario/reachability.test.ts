import { describe, expect, it } from 'vitest';
import { key } from '../movement/board';
import { scenarioBoard, validateScenario } from './definition';
import { generateScenario } from './generate';
import { connectBoard, reachableCells, unreachableCells, walkDistances } from './reachability';
import { portalProblems } from '../portals';
import { ORIGINAL_CONTENT, ORIGINAL_SCENARIOS, scenarioById } from '@/game-data/original';

const reachOf = (id: string) => {
  const def = scenarioById(id)!;
  const { board, spawnPoints } = scenarioBoard(def, ORIGINAL_CONTENT);
  return { def, board, spawnPoints, reach: reachableCells(board, def.heroStarts) };
};

describe('atteignabilité : un chemin relie le départ des héros à tout ce qui compte', () => {
  it.each(ORIGINAL_SCENARIOS.filter((s) => !s.sandbox).map((s) => [s.id, s] as const))('%s : objectifs, monstres, renforts et jetons Spawn sont atteignables', (id) => {
    const { def, spawnPoints, reach } = reachOf(id);
    for (const q of def.quests) if (q.at) expect(reach.has(key(q.at)), `objectif ${q.id}`).toBe(true);
    for (const m of def.monsters) expect(reach.has(key(m.at)), m.id).toBe(true);
    for (const s of spawnPoints) expect(reach.has(key(s.at)), s.id).toBe(true);
    for (const e of (def.script ?? []).flatMap((r) => r.then)) if (e.type === 'spawn') expect(reach.has(key(e.at)), e.monsterId).toBe(true);
    expect(validateScenario(def, ORIGINAL_CONTENT).filter((p) => /inatteignable/.test(p))).toEqual([]);
  });

  it('Le Corridor des Ombres : la tuile 5B (au milieu) se traverse jusqu’à la tuile 8B', () => {
    const { def, reach } = reachOf('corridor-des-ombres');
    expect(def.quests.every((q) => !q.at || reach.has(key(q.at)))).toBe(true);
    for (const x of [3, 4, 5]) for (const y of [0, 1, 2]) expect(reach.has(key({ x, y })), `${x},${y}`).toBe(true);
  });

  it('L’Évasion du Quartier : la porte violette et la sortie à l’Est se rejoignent', () => {
    const { def, board, reach } = reachOf('evasion-du-quartier');
    const special = board.doors.find((d) => d.special)!;
    expect(reach.has(key(special.a)) && reach.has(key(special.b))).toBe(true);
    const exit = def.quests.find((q) => q.id === 'sortie')!;
    expect(reach.has(key(exit.at!))).toBe(true);
  });

  it('un objectif enfermé derrière des murs est signalé par la validation', () => {
    const def = scenarioById('corridor-des-ombres')!;
    // Sans les portes ajoutées, la tuile du milieu est coupée du départ : le scénario serait refusé.
    const cut = { ...def, board: def.board.split('\n').filter((l) => !/^door porte-ombre-/.test(l)).join('\n') };
    expect(validateScenario(cut, ORIGINAL_CONTENT).join('\n')).toMatch(/inatteignable depuis le départ des héros/);
  });

  it('les scénarios aléatoires sont toujours atteignables de bout en bout, tous niveaux et toutes tailles', () => {
    const bad: string[] = [];
    for (const level of ['1', '2-3', '4-5', '6'] as const) {
      for (let tiles = 1; tiles <= 9; tiles++) {
        for (let seed = 1; seed <= 25; seed++) {
          const def = generateScenario({ tileCount: tiles, seed, level }, ORIGINAL_CONTENT);
          const p = validateScenario(def, ORIGINAL_CONTENT);
          if (p.length) bad.push(`${level}/${tiles}/${seed}: ${p[0]}`);
        }
      }
    }
    expect(bad).toEqual([]);
  }, 180_000);
});

describe('portails : 8 jetons violet / bleu, reliés par couleur', () => {
  const board = () => scenarioBoard(scenarioById('corridor-des-ombres')!, ORIGINAL_CONTENT).board;

  it('les règles : 8 jetons au plus, violet ou bleu, au moins deux de la même couleur', () => {
    const p = (id: string, color: string) => ({ id, color });
    expect(portalProblems([p('a', 'violet'), p('b', 'violet'), p('c', 'blue'), p('d', 'blue')])).toEqual([]);
    expect(portalProblems(Array.from({ length: 9 }, (_, i) => p(`p${i}`, i % 2 ? 'blue' : 'violet')))[0]).toMatch(/9 pour 8 jetons/);
    expect(portalProblems([p('a', 'violet')])[0]).toMatch(/Un seul portail violet/);
    expect(portalProblems([p('a', 'red'), p('b', 'red')])[0]).toMatch(/violets ou bleus/);
  });

  it('un portail relie les zones isolées : une case murée devient atteignable, par couleur seulement', () => {
    const def = scenarioById('corridor-des-ombres')!;
    const b = board();
    const walled: typeof b = { ...b, doors: b.doors.filter((d) => !/^porte-(ombre|liaison)-/.test(d.id)) }; // retire les portes ajoutées
    const cut = { ...walled, portals: [] };
    const isolated = unreachableCells(cut, def.heroStarts);
    expect(isolated.length).toBeGreaterThan(0);
    const target = isolated[0]!;
    const via = (color: string) => reachableCells({ ...cut, portals: [{ id: 'a', at: def.heroStarts[0]!, color: 'violet' }, { id: 'b', at: target, color }] }, def.heroStarts);
    expect(via('violet').has(key(target))).toBe(true);
    expect(via('blue').has(key(target))).toBe(false); // couleur différente : pas de téléportation
  });

  it('connectBoard : des portes d’abord, des portails pour le reste, dans la limite des jetons', () => {
    const def = scenarioById('corridor-des-ombres')!;
    const b = board();
    const cut = { ...b, doors: b.doors.filter((d) => !/^porte-(ombre|liaison)-/.test(d.id)), portals: [] };
    const c = connectBoard(cut, def.heroStarts, { maxDoors: 1 });
    expect(c.doors).toHaveLength(1);
    expect(c.portals.length).toBeGreaterThan(0);
    expect(c.portals.length).toBeLessThanOrEqual(8);
    const after = {
      ...cut,
      walls: cut.walls.filter(([p, q]) => !c.doors.some((d) => (key(d.a) === key(p) && key(d.b) === key(q)) || (key(d.a) === key(q) && key(d.b) === key(p)))),
      doors: [...cut.doors, ...c.doors.map((d, i) => ({ id: `n${i}`, a: d.a, b: d.b, open: false }))],
      portals: c.portals.map((p, i) => ({ id: `q${i}`, ...p })),
    };
    expect(unreachableCells(after, def.heroStarts)).toEqual([]);
  });

  it('aucun scénario livré ne pose de portail qui ne mène à rien : chaque portail a un jumeau de sa couleur, et chaque couleur sert', () => {
    for (const def of ORIGINAL_SCENARIOS.filter((s) => !s.sandbox)) {
      const b = scenarioBoard(def, ORIGINAL_CONTENT).board;
      expect(portalProblems(b.portals), def.id).toEqual([]);
      // Un portail n'a de sens que s'il relie quelque chose : l'un des deux bouts au moins est une zone hors d'atteinte sans lui.
      for (const color of new Set(b.portals.map((p) => p.color))) {
        const without = { ...b, portals: b.portals.filter((p) => p.color !== color) };
        const gain = [...reachableCells(b, def.heroStarts)].length - [...reachableCells(without, def.heroStarts)].length;
        expect(gain, `${def.id} : portails ${color}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('un scénario fondé sur les portails : Le Caveau des Brumes', () => {
  it('le coffre n’est atteignable que par le portail violet : sans lui, le scénario est refusé', () => {
    const def = scenarioById('caveau-des-brumes')!;
    const { board } = scenarioBoard(def, ORIGINAL_CONTENT);
    const chest = def.quests.find((q) => q.id === 'coffre')!.at!;
    expect(validateScenario(def, ORIGINAL_CONTENT)).toEqual([]);
    expect(reachableCells(board, def.heroStarts).has(key(chest))).toBe(true);
    // Sans portail : le caveau est muré.
    expect(reachableCells({ ...board, portals: [] }, def.heroStarts).has(key(chest))).toBe(false);
    // Un portail d'une autre couleur ne mène pas au caveau.
    expect(reachableCells({ ...board, portals: board.portals.map((p, i) => (i === 0 ? { ...p, color: 'blue' } : p)) }, def.heroStarts).has(key(chest))).toBe(false);
    // Et le scénario sans portail est signalé.
    const noPortal = { ...def, board: def.board.split('\n').filter((l) => !/^portal /.test(l)).join('\n') };
    expect(validateScenario(noPortal, ORIGINAL_CONTENT).join('\n')).toMatch(/Coffre du caveau.*inatteignable|inatteignable/);
  });

  it('huit jetons portail au plus, deux couleurs, jamais un portail seul', () => {
    const { board } = scenarioBoard(scenarioById('caveau-des-brumes')!, ORIGINAL_CONTENT);
    expect(board.portals.map((p) => p.color).sort()).toEqual(['violet', 'violet']);
    expect(portalProblems(board.portals)).toEqual([]);
  });
});

describe('mode aléatoire : des portails à partir de 5 tuiles', () => {
  const gen = (tiles: number, seed: number) => generateScenario({ tileCount: tiles, seed }, ORIGINAL_CONTENT);
  const portalsOf = (tiles: number, seed: number) => scenarioBoard(gen(tiles, seed), ORIGINAL_CONTENT).board.portals;
  const seeds = Array.from({ length: 20 }, (_, i) => i + 1);

  it('pas de portail sur un petit terrain (1 à 4 tuiles)', () => {
    for (const n of [1, 2, 3, 4]) for (const s of seeds) expect(portalsOf(n, s), `${n} tuiles, graine ${s}`).toEqual([]);
  });

  it('de 5 à 9 tuiles : en général un couple violet, qui raccourcit vraiment le trajet ; jamais un portail seul ni plus de 8', () => {
    let withPortals = 0;
    for (const n of [5, 6, 7, 8, 9]) {
      for (const s of seeds) {
        const def = gen(n, s);
        const { board } = scenarioBoard(def, ORIGINAL_CONTENT);
        expect(portalProblems(board.portals), `${n} tuiles, graine ${s}`).toEqual([]);
        expect(board.portals.length).toBeLessThanOrEqual(8);
        if (board.portals.length > 0) {
          withPortals++;
          expect(board.portals.some((p) => p.color === 'violet')).toBe(true);
          // Un portail doit servir : sans lui, une case au moins est plus loin (ou hors d'atteinte).
          const walk = walkDistances({ ...board, portals: [] }, def.heroStarts);
          const reach = reachableCells(board, def.heroStarts);
          const reachBare = reachableCells({ ...board, portals: [] }, def.heroStarts);
          const farPortal = board.portals.some((p) => (walk.get(key(p.at)) ?? 99) >= 4);
          expect(farPortal || reach.size > reachBare.size, `${n} tuiles, graine ${s}`).toBe(true);
        }
        if (n >= 7 && board.portals.some((p) => p.color === 'blue')) expect(board.portals.filter((p) => p.color === 'blue')).toHaveLength(2);
        if (n < 7) expect(board.portals.some((p) => p.color === 'blue')).toBe(false);
      }
    }
    expect(withPortals).toBeGreaterThan(60); // sur 100 tirages, la grande majorité en pose
  });
});

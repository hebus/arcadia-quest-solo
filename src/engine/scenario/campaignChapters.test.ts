import { describe, expect, it } from 'vitest';
import { statsOfMonster } from '../monsters';
import { boxProblems } from '../figurines';
import { CELL_CAPACITY, key, samePos } from '../movement/board';
import { heroStartsEnclosed } from '../startArea';
import { tilePlacementProblems } from '../tileCatalog';
import { layoutExtent } from '../tiles';
import { createScenarioGame, scenarioBoard, validateScenario, type ScenarioDefinition } from './definition';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES, ORIGINAL_SCENARIOS, scenarioById } from '@/game-data/original';
import { CHUTE_DES_BRAISES } from '@/game-data/original/campaigns/chute-des-braises';
import { CAVE_AUX_CENDRES as CH1 } from '@/game-data/original/scenarios/cave-aux-cendres';
import { MARCHE_AUX_OMBRES as CH2 } from '@/game-data/original/scenarios/marche-aux-ombres';
import { FORGE_DU_MAITRE_FER as CH3 } from '@/game-data/original/scenarios/forge-du-maitre-fer';

const CHAPTERS = [CH1, CH2, CH3];
const start = { sessionId: 's', difficulty: 'medium' as const, seed: 1, heroes: ORIGINAL_HEROES.slice(0, 3) };
const count = (def: ScenarioDefinition, id: string) => def.monsters.filter((m) => m.definitionId === id).length;
const reinforcements = (def: ScenarioDefinition) => (def.script ?? []).flatMap((r) => r.then).flatMap((e) => (e.type === 'spawn' ? [e] : []));
const has = (list: { x: number; y: number }[] | undefined, c: { x: number; y: number }) => (list ?? []).some((x) => samePos(x, c));

/** Cases atteignables depuis le départ : un mur arrête le passage, une porte (fermée ou ouverte) le laisse passer. */
function reachable(def: ScenarioDefinition): Set<string> {
  const { board } = scenarioBoard(def, ORIGINAL_CONTENT);
  const wall = new Set(board.walls.map(([a, b]) => [key(a), key(b)].sort().join('|')));
  const seen = new Set(def.heroStarts.map(key));
  const queue = [...def.heroStarts];
  for (let i = 0; i < queue.length; i++) {
    for (const d of [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]) {
      const n = { x: queue[i]!.x + d.x, y: queue[i]!.y + d.y };
      if (n.x < 0 || n.y < 0 || n.x >= board.width || n.y >= board.height || board.holes.some((h) => samePos(h, n)) || seen.has(key(n))) continue;
      if (wall.has([key(queue[i]!), key(n)].sort().join('|'))) continue;
      seen.add(key(n));
      queue.push(n);
    }
  }
  return seen;
}

describe('la petite campagne « La Chute des Braises »', () => {
  it('trois chapitres, dans l’ordre : le scénario 1 existant puis deux nouveaux', () => {
    expect(CHUTE_DES_BRAISES.chapters.map((c) => c.scenarioId)).toEqual(['cave-aux-cendres', 'marche-aux-ombres', 'forge-du-maitre-fer']);
    for (const c of CHUTE_DES_BRAISES.chapters) {
      expect(scenarioById(c.scenarioId), c.scenarioId).toBeDefined();
      expect(c.bridge.length).toBeGreaterThan(20);
    }
    expect(CHUTE_DES_BRAISES.chapters[0]!.scenarioId).toBe(CH1.id);
    expect(ORIGINAL_SCENARIOS.map((s) => s.id)).toEqual(expect.arrayContaining(CHAPTERS.map((c) => c.id)));
  });

  it.each(CHAPTERS.map((c) => [c.id, c] as const))('%s : valide, une partie se crée avec les trois héros de la guilde', (_id, def) => {
    expect(validateScenario(def, ORIGINAL_CONTENT)).toEqual([]);
    const g = createScenarioGame(def, start, ORIGINAL_CONTENT);
    expect(g.heroes).toHaveLength(3);
    expect(g.monsters).toHaveLength(def.monsters.length);
    // Chapitres 1 et 2 : niveau de cartes « 1 » ; chapitre 3 : niveau « 2-3 » (la campagne monte en puissance).
    expect(g.monsterCardSet).toBe(def.id === 'forge-du-maitre-fer' ? '2-3' : '1');
  });

  it.each(CHAPTERS.map((c) => [c.id, c] as const))('%s : boîtes respectées, renforts du script compris', (_id, def) => {
    const counts = new Map<string, number>();
    for (const m of [...def.monsters, ...reinforcements(def)]) {
      const d = ORIGINAL_CONTENT.monsters[m.definitionId]!;
      counts.set(d.group ?? d.id, (counts.get(d.group ?? d.id) ?? 0) + 1);
    }
    expect(boxProblems(counts, ORIGINAL_CONTENT.monsters)).toEqual([]);
    // Le Goblin Archer n'a de stats qu'au niveau 2-3 : il ne peut figurer que dans le chapitre 3 (et n'y figure pas pour l'instant).
    if (def.monsterCardSet === '1') expect(counts.get('GA') ?? 0).toBe(0);
  });

  it.each(CHAPTERS.map((c) => [c.id, c] as const))('%s : tout est atteignable depuis le départ (monstres, objectifs, renforts, jetons Spawn)', (_id, def) => {
    const reach = reachable(def);
    const { spawnPoints } = scenarioBoard(def, ORIGINAL_CONTENT);
    for (const m of def.monsters) expect(reach.has(key(m.at)), m.id).toBe(true);
    for (const q of def.quests) expect(reach.has(key(q.at!)), q.id).toBe(true);
    for (const r of reinforcements(def)) expect(reach.has(key(r.at)), r.monsterId).toBe(true);
    for (const sp of spawnPoints) expect(reach.has(key(sp.at)), sp.id).toBe(true);
    // Les héros peuvent sortir de leur bâtiment de départ (au moins une porte sur son contour).
    expect(heroStartsEnclosed(scenarioBoard(def, ORIGINAL_CONTENT).board, def.heroStarts)).toBe(false);
  });

  it.each(CHAPTERS.map((c) => [c.id, c] as const))('%s : pions porte (22 au plus, un seul spécial), 1 à 5 jetons Spawn, une face par tuile', (_id, def) => {
    const { board, spawnPoints } = scenarioBoard(def, ORIGINAL_CONTENT);
    expect(board.doors.length).toBeGreaterThanOrEqual(1);
    expect(board.doors.length).toBeLessThanOrEqual(22);
    expect(board.doors.filter((d) => d.special).length).toBeLessThanOrEqual(1);
    expect(spawnPoints.length).toBeGreaterThanOrEqual(1);
    expect(spawnPoints.length).toBeLessThanOrEqual(5);
    expect(tilePlacementProblems(def.tiles!.placements.map((p) => p.tileId)).errors).toEqual([]);
  });

  it.each(CHAPTERS.map((c) => [c.id, c] as const))('%s : jamais plus de 2 figurines par case, aucune sur un mur, une case bloquée ou un jeton Spawn', (_id, def) => {
    const { board, spawnPoints } = scenarioBoard(def, ORIGINAL_CONTENT);
    const per = new Map<string, number>();
    for (const m of def.monsters) per.set(key(m.at), (per.get(key(m.at)) ?? 0) + 1);
    for (const h of def.heroStarts) per.set(key(h), (per.get(key(h)) ?? 0) + 1);
    expect([...per.values()].every((n) => n <= CELL_CAPACITY)).toBe(true);
    for (const m of def.monsters) {
      expect(has(board.holes, m.at), m.id).toBe(false);
      expect(spawnPoints.some((sp) => samePos(sp.at, m.at)), m.id).toBe(false);
    }
  });

  it.each(CHAPTERS.map((c) => [c.id, c] as const))('%s : chaque quête a sa règle de script, et le script ne cite que des portes et des monstres qui existent', (_id, def) => {
    const doors = scenarioBoard(def, ORIGINAL_CONTENT).board.doors.map((d) => d.id);
    const monsters = [...def.monsters.map((m) => m.id), ...reinforcements(def).map((r) => r.monsterId)];
    const completed = (def.script ?? []).flatMap((r) => r.then).flatMap((e) => (e.type === 'complete-quest' ? [e.questId] : []));
    expect(completed.sort()).toEqual(def.quests.map((q) => q.id).sort());
    for (const rule of def.script ?? []) {
      for (const c of rule.when) {
        if (c.type === 'door-open') expect(doors, rule.id).toContain(c.doorId);
        if (c.type === 'monster-down') expect(monsters, rule.id).toContain(c.monsterId);
      }
    }
    // Chaque type de monstre présent (au départ ou en renfort) a sa carte dans le deck.
    const types = new Set([...def.monsters.map((m) => m.definitionId), ...reinforcements(def).map((r) => r.definitionId)]);
    expect(new Set(def.deck!.listedMonsterIds)).toEqual(types);
  });

  it('chapitre 2 : le Marché des Ombres (6 tuiles), le Troll chef, le coffre-fort au pion violet, un mur supprimé par un pion ouvert', () => {
    expect(CH2.tiles!.placements.map((p) => p.tileId).sort()).toEqual(['2A', '4A', '5A', '6B', '7B', '9B']);
    expect(layoutExtent(CH2.tiles!)).toEqual({ width: 9, height: 6 });
    expect({ T: count(CH2, 'T'), OC: count(CH2, 'OC'), SB: count(CH2, 'SB'), HB: count(CH2, 'HB'), OM: count(CH2, 'OM'), M: count(CH2, 'M') }).toEqual({ T: 1, OC: 2, SB: 2, HB: 2, OM: 4, M: 0 });
    const chief = CH2.monsters.find((m) => m.definitionId === 'T')!;
    expect(chief.guard).toBe(true);
    expect(CH2.script!.find((r) => r.id === 'troll-tombe')!.when).toEqual([{ type: 'monster-down', monsterId: chief.id }]);
    const { board } = scenarioBoard(CH2, ORIGINAL_CONTENT);
    expect(board.doors.find((d) => d.special)!.id).toBe('porte-coffre');
    expect(board.doors.find((d) => d.id === 'ouverture')!.open).toBe(true);
    // Le pion ouvert entre la salle du marché et la maison de comptes supprime leur mur commun.
    expect(board.walls.some(([a, b]) => samePos(a, { x: 7, y: 2 }) && samePos(b, { x: 7, y: 3 }))).toBe(false);
    expect(CH2.quests.map((q) => q.id)).toEqual(['coffre', 'bourse', 'troll']);
    expect(reinforcements(CH2).map((r) => r.definitionId)).toEqual(['OM', 'OM']);
    expect(CH2.recommended).toBe('medium');
  });

  it('chapitre 3 : la Forge du Maître-Fer (9 tuiles, une décalée), Minotaur et Troll, les 8 Orcs, une île derrière un écart bloquant', () => {
    expect(CH3.tiles!.placements).toHaveLength(9);
    expect(new Set(CH3.tiles!.placements.map((p) => p.tileId.slice(0, 1))).size).toBe(9);
    const shifted = CH3.tiles!.placements.filter((p) => p.dx || p.dy);
    expect(shifted).toEqual([expect.objectContaining({ tileId: '9A', dx: 1 })]);
    expect(layoutExtent(CH3.tiles!)).toEqual({ width: 10, height: 9 });
    const { board } = scenarioBoard(CH3, ORIGINAL_CONTENT);
    for (const y of [3, 4, 5]) expect(has(board.holes, { x: 6, y }), `écart (6,${y})`).toBe(true); // la colonne vide entre la forge et la rue
    expect({ M: count(CH3, 'M'), T: count(CH3, 'T'), OC: count(CH3, 'OC'), SB: count(CH3, 'SB'), HB: count(CH3, 'HB'), OM: count(CH3, 'OM'), GA: count(CH3, 'GA') }).toEqual({ M: 1, T: 1, OC: 2, SB: 2, HB: 2, OM: 3, GA: 3 });
    expect(count(CH3, 'OC') + count(CH3, 'OM') + reinforcements(CH3).length).toBe(8); // toute la boîte d'Orcs
    const chief = CH3.monsters.find((m) => m.definitionId === 'M')!;
    expect(chief.guard).toBe(true);
    expect(has(board.interior, chief.at)).toBe(true); // dans la forge
    expect(CH3.script!.find((r) => r.id === 'maitre-tombe')!.when).toEqual([{ type: 'monster-down', monsterId: chief.id }]);
    expect(board.doors.find((d) => d.special)!.id).toBe('porte-forge');
    expect(CH3.quests.map((q) => q.id)).toEqual(['brasero-nord', 'brasero-sud', 'maitre']);
    expect(CH3.recommended).toBe('hard');
  });

  it('la forge n’est atteignable que par une porte : sans les pions porte, l’île est coupée du départ', () => {
    const noDoors = { ...CH3, board: CH3.board.split('\n').filter((l) => !l.startsWith('door') || l.includes('porte-depart')).join('\n') };
    const reach = reachable(noDoors);
    expect(reach.has(key(CH3.monsters.find((m) => m.id === 'M1')!.at))).toBe(false);
    expect(reachable(CH3).has(key(CH3.monsters.find((m) => m.id === 'M1')!.at))).toBe(true);
  });

  it('chaque chapitre a sa propre histoire (intro, victoire, défaite) et le chapitre suivant reprend le précédent', () => {
    for (const def of CHAPTERS) {
      expect(def.story.intro.length).toBeGreaterThanOrEqual(1);
      expect(def.story.win.length).toBeGreaterThanOrEqual(1);
      expect(def.story.lose.length).toBeGreaterThanOrEqual(1);
    }
    expect(CH2.story.intro.join(' ')).toMatch(/Seigneur Cendre/); // reprend la fin du chapitre 1
    expect(CH3.story.intro.join(' ')).toMatch(/Gorge-Sombre/); // reprend la fin du chapitre 2
    expect(CH2.story.win.join(' ')).toMatch(/Maître-Fer/); // annonce le chapitre 3
  });
});

const ids = (deck: { draw: { id: string }[]; discard: { id: string }[] }) => [...deck.draw, ...deck.discard].map((c) => c.id);

describe('chapitre 3 au niveau 2-3', () => {
  it('les monstres du chapitre 3 ont leurs statistiques de niveau 2-3', () => {
    const g = createScenarioGame(CHAPTERS[2]!, start, ORIGINAL_CONTENT);
    expect(g.monsterCardSet).toBe('2-3');
    const stats = (id: string) => statsOfMonster(ORIGINAL_CONTENT, g, g.monsters.find((m) => m.id === id)!)!;
    const chef = g.monsters.find((m) => m.definitionId === 'M')!;
    expect(stats(chef.id)).toMatchObject({ life: 6, overkill: 7, defense: 1 }); // Minotaur niveau 2-3 (5 de vie au niveau 1)
    const troll = g.monsters.find((m) => m.definitionId === 'T')!;
    expect(stats(troll.id)).toMatchObject({ life: 5, overkill: 7, defense: 2 });
    const hammer = g.monsters.find((m) => m.definitionId === 'HB')!;
    expect(stats(hammer.id)).toMatchObject({ life: 4, overkill: 6 });
  });

  it('le deck d’activation du chapitre 3 compte les cartes des autres niveaux : 1, 4-5 et 6', () => {
    const g = createScenarioGame(CHAPTERS[2]!, start, ORIGINAL_CONTENT);
    const ids = [...g.deck.draw, ...g.deck.discard].filter((c) => c.monsterDefId === 'M').map((c) => c.id).sort();
    expect(ids).toEqual(['M:1', 'M:4-5', 'M:6']);
  });

  it('trois Goblin Archer au chapitre 3 : leurs statistiques de niveau 2-3, dans la limite de leur boîte (6)', () => {
    const g = createScenarioGame(CHAPTERS[2]!, start, ORIGINAL_CONTENT);
    const archers = g.monsters.filter((m) => m.definitionId === 'GA');
    expect(archers).toHaveLength(3);
    for (const a of archers) expect(statsOfMonster(ORIGINAL_CONTENT, g, a)).toEqual({ life: 2, overkill: 3, movement: 1, reward: 1, attackType: 'ranged', attackDice: 2 });
    expect(ORIGINAL_CONTENT.monsters.GA!.copies).toBe(6);
    expect(ids(g.deck)).toContain('GA:1'); // une carte du Goblin Archer par autre niveau
    expect(ids(g.deck).filter((c) => c.startsWith('GA:')).sort()).toEqual(['GA:1', 'GA:4-5', 'GA:6']);
  });

  it('les Goblin Archer n’apparaissent qu’au chapitre 3 : les chapitres 1 et 2 sont au niveau 1, où ils n’ont pas de fiche', () => {
    for (const def of [CHAPTERS[0]!, CHAPTERS[1]!]) expect(def.monsters.some((m) => m.definitionId === 'GA')).toBe(false);
  });

  it('les chapitres 1 et 2 restent au niveau 1', () => {
    for (const def of [CHAPTERS[0]!, CHAPTERS[1]!]) expect(createScenarioGame(def, start, ORIGINAL_CONTENT).monsterCardSet).toBe('1');
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import type { GameState } from '@/engine/domain/schemas';
import { createScenarioGame, validateScenario, type ScenarioDefinition } from '@/engine/scenario/definition';
import { startScenario } from '@/engine/turn/machine';
import { CAVE_AUX_CENDRES } from '@/game-data/original/scenarios/cave-aux-cendres';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES } from '@/game-data/original';
import { runScript, type Rule } from './script';

const rules = CAVE_AUX_CENDRES.script!;

function started(): GameState {
  const g = createScenarioGame(CAVE_AUX_CENDRES, { sessionId: 's', difficulty: 'medium', seed: 3, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT);
  return startScenario(g);
}

const withHeroAt = (g: GameState, at: { x: number; y: number }): GameState => ({ ...g, heroes: g.heroes.map((h, i) => (i === 0 ? { ...h, position: at } : h)) });
const openDoor = (g: GameState, id: string): GameState => ({ ...g, board: { ...g.board, doors: g.board.doors.map((d) => (d.id === id ? { ...d, open: true } : d)) } });

let g0: GameState;
beforeEach(() => {
  g0 = started();
});

describe('moteur de scénario scripté', () => {
  it('ne fait rien tant qu’aucune condition n’est remplie, et ne modifie jamais l’état reçu', () => {
    const r = runScript(g0, rules);
    expect(r.state).toBe(g0);
    expect(r.beats).toEqual([]);
    expect(r.instructions).toEqual([]);
  });

  it('un héros sur la case de la clé valide la quête et raconte', () => {
    const before = withHeroAt(g0, { x: 1, y: 3 });
    const r = runScript(before, rules);
    expect(r.state.quests.find((q) => q.id === 'cle')!.done).toBe(true);
    expect(r.beats).toHaveLength(1);
    expect(r.beats[0]).toMatchObject({ tone: 'quest', title: 'Reprendre la Clé de Braise' });
    expect(before.quests.find((q) => q.id === 'cle')!.done).toBe(false); // état d'origine intact
    expect(r.state.events.some((e) => e.type === 'quest-completed')).toBe(true);
  });

  it('chaque règle ne se déclenche qu’une fois, même si les conditions restent vraies', () => {
    const first = runScript(withHeroAt(g0, { x: 1, y: 3 }), rules);
    const again = runScript(first.state, rules);
    expect(again.beats).toEqual([]);
    expect(again.state).toBe(first.state);
    expect(first.state.scriptFired).toContain('cle-reprise');
  });

  it('une porte ouverte déclenche récit et renfort, montré comme un pion à poser', () => {
    const r = runScript(openDoor(g0, 'porte-chapelle'), rules);
    expect(r.beats[0]).toMatchObject({ tone: 'danger' });
    const spawn = r.state.monsters.find((m) => m.id === 'OM7')!;
    expect(spawn).toMatchObject({ status: 'board', definitionId: 'OM', position: { x: 4, y: 2 } });
    expect(r.instructions).toHaveLength(1);
    expect(r.instructions[0]!.visual).toEqual({ type: 'place', actorId: 'OM7', at: { x: 4, y: 2 } });
  });

  it('le brasero exige la clé : sans elle rien ; avec elle, la quête et le renfort', () => {
    const noKey = runScript(withHeroAt(g0, { x: 8, y: 0 }), rules);
    expect(noKey.state.quests.find((q) => q.id === 'brasero')!.done).toBe(false);
    const hasKey = runScript({ ...withHeroAt(g0, { x: 8, y: 0 }), quests: g0.quests.map((q) => (q.id === 'cle' ? { ...q, done: true } : q)) }, rules);
    expect(hasKey.state.quests.find((q) => q.id === 'brasero')!.done).toBe(true);
    expect(hasKey.state.monsters.some((m) => m.id === 'OM8')).toBe(true);
  });

  it('cascade : une seule évaluation enchaîne clé puis brasero si le héros est déjà sur place', () => {
    // Deux héros : l'un sur la clé, l'autre sur le brasero. La clé débloque le brasero dans la même évaluation.
    const g = { ...g0, heroes: g0.heroes.map((h, i) => ({ ...h, position: i === 0 ? { x: 1, y: 3 } : i === 1 ? { x: 8, y: 0 } : h.position })) };
    const r = runScript(g, rules);
    expect(r.state.quests.filter((q) => q.done).map((q) => q.id).sort()).toEqual(['brasero', 'cle']);
  });

  it('un monstre tombé valide la quête associée, et la dernière quête donne la victoire', () => {
    const almost: GameState = { ...g0, quests: g0.quests.map((q) => (q.id === 'seigneur' ? q : { ...q, done: true })), monsters: g0.monsters.map((m) => (m.id === 'OM6' ? { ...m, status: 'spawn-tile' as const } : m)) };
    const r = runScript(almost, rules);
    expect(r.state.phase).toBe('SCENARIO_WON');
  });

  it('un renfort sur une case pleine est annulé et journalisé, sans planter', () => {
    const crowded: GameState = { ...openDoor(g0, 'porte-chapelle'), heroes: g0.heroes.map((h, i) => (i < 2 ? { ...h, position: { x: 4, y: 2 } } : h)) };
    const r = runScript(crowded, rules);
    expect(r.state.monsters.some((m) => m.id === 'OM7')).toBe(false);
    expect(r.state.events.some((e) => e.type === 'script-skipped')).toBe(true);
  });

  it('la manche 3 fait tomber la cendre', () => {
    const r = runScript({ ...g0, round: 3 }, rules);
    expect(r.beats[0]!.title).toBe('La cendre tombe');
    // La boîte ne contient que 8 Orc Marauder : la cendre ne fait plus apparaître de monstre supplémentaire.
    expect(r.state.monsters.filter((m) => m.definitionId === 'OM')).toHaveLength(g0.monsters.length);
  });

  it('rien ne se déclenche en mise en place ni après la fin de partie', () => {
    expect(runScript({ ...withHeroAt(g0, { x: 1, y: 3 }), phase: 'SCENARIO_SETUP' }, rules).beats).toEqual([]);
    expect(runScript({ ...withHeroAt(g0, { x: 1, y: 3 }), phase: 'SCENARIO_LOST' }, rules).beats).toEqual([]);
  });
});

describe('validation du script', () => {
  const bad = (script: Rule[]): ScenarioDefinition => ({ ...CAVE_AUX_CENDRES, script });
  const problems = (script: Rule[]) => validateScenario(bad(script), ORIGINAL_CONTENT);

  it('le script du scénario livré est cohérent', () => {
    expect(problems(rules)).toEqual([]);
  });

  it('références inconnues et doublons sont signalés', () => {
    const p = problems([
      { id: 'a', when: [{ type: 'door-open', doorId: 'fantome' }], then: [{ type: 'complete-quest', questId: 'nope' }] },
      { id: 'a', when: [], then: [{ type: 'spawn', monsterId: 'x', definitionId: 'dragon', at: { x: 99, y: 0 } }] },
    ]);
    expect(p.join('\n')).toMatch(/porte inconnue fantome/);
    expect(p.join('\n')).toMatch(/quête inconnue nope/);
    expect(p.join('\n')).toMatch(/règle en double/);
    expect(p.join('\n')).toMatch(/aucune condition/);
    expect(p.join('\n')).toMatch(/monstre inconnu dragon/);
    expect(p.join('\n')).toMatch(/renfort hors du plateau/);
  });

  it('un renfort ne peut pas réutiliser l’identifiant d’un monstre déjà placé', () => {
    const p = problems([{ id: 'r', when: [{ type: 'round-reached', round: 2 }], then: [{ type: 'spawn', monsterId: 'OM1', definitionId: 'OM', at: { x: 0, y: 0 } }] }]);
    expect(p.join('\n')).toMatch(/identifiant déjà pris/);
  });
});

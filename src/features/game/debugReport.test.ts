import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '@/stores/gameStore';
import { skillContent, skillGame } from '@/tests/fixtures/skillGame';
import { buildDebugReport } from './debugReport';

beforeEach(() => {
  const g = skillGame([{ id: 'P1', definitionId: 'plain', position: { x: 6, y: 2 } }]);
  useGameStore.setState({ game: g, content: skillContent, history: [], instructions: [], answers: [], beats: [], script: [], selectedId: null, placing: null, correctionMode: false, error: null, agent: { status: 'ready' }, actionLog: [], logStart: structuredClone(g) });
});

describe('journal d’actions et rapport de débogage', () => {
  it('chaque action est journalisée avec ses arguments et un résumé de l’état obtenu', () => {
    const st = useGameStore.getState();
    st.moveHero('h2', { x: 3, y: 4 });
    st.correct({ kind: 'monster-wounds', monsterId: 'P1', wounds: 2 });
    const log = useGameStore.getState().actionLog;
    expect(log.map((e) => e.action)).toEqual(['moveHero', 'correct']);
    expect(log[0]!.args).toEqual(['h2', { x: 3, y: 4 }]);
    expect(log[0]!.after!.heroes.find((h) => h.id === 'h2')!.at).toEqual({ x: 3, y: 4 });
    expect(log[0]!.after!.heroTurn.h2).toMatchObject({ moved: true });
    expect(log[1]!.after!.monsters.find((m) => m.id === 'P1')!.wounds).toBe(2);
    expect(log[1]!.n).toBeGreaterThan(log[0]!.n);
  });

  it('une action refusée garde son message d’erreur dans le journal', () => {
    useGameStore.getState().moveHero('h2', { x: 7, y: 0 });
    const e = useGameStore.getState().actionLog[0]!;
    expect(e.error).toMatch(/hors de portée/);
  });

  it('une action qui en déclenche d’autres les imbrique (profondeur) : fin de tour → tour des monstres', () => {
    const st = useGameStore.getState();
    st.activateHero('h1');
    st.endTurn();
    const log = useGameStore.getState().actionLog;
    const end = log.find((e) => e.action === 'endTurn')!;
    expect(log.filter((e) => e.depth > end.depth).map((e) => e.action)).toContain('finishActivations');
  });

  it('le rapport contient de quoi rejouer : état de départ, journal, état courant, événements, graine et dés', () => {
    const st = useGameStore.getState();
    st.moveHero('h2', { x: 3, y: 4 });
    const r = JSON.parse(buildDebugReport()) as Record<string, any>;
    expect(r.format).toBe('aq-solo-debug');
    expect(r.startState.heroes).toHaveLength(3);
    expect(r.actionLog[0]).toMatchObject({ action: 'moveHero' });
    expect(r.current).toMatchObject({ phase: 'GUILD_TURN', error: null });
    expect(typeof r.current.rngSeed).toBe('number');
    expect(r.events.length).toBeGreaterThan(0);
    expect(r.state.heroes[1].position).toEqual({ x: 3, y: 4 });
    expect(r.dice.attackDie.length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';
import { runMonsterTurn } from './activation/monsterTurn';
import type { GameState } from './domain/schemas';
import { validateGameState } from './setup';
import { activateHero, finishHeroActivations, restGuild, startScenario } from './turn/machine';
import { demoGame, testContent } from '@/tests/fixtures/demo';

/** Partie complète sans interface : le moteur seul, plusieurs manches, avec contrôle des invariants. */
function play(seed: number, difficulty: 'easy' | 'legendary'): { final: GameState; rounds: number } {
  let g = startScenario(demoGame({ seed, difficulty }));
  for (let i = 0; i < 100 && g.phase === 'GUILD_TURN'; i++) {
    const dead = g.heroes.filter((h) => h.dead);
    if (dead.length) {
      // Une seule figurine par case : chaque héros revient sur une case libre différente.
      const taken = new Set([...g.heroes.filter((h) => !h.dead && h.position).map((h) => `${h.position!.x},${h.position!.y}`), ...g.monsters.filter((m) => m.status === 'board' && m.position).map((m) => `${m.position!.x},${m.position!.y}`)]);
      const free: { x: number; y: number }[] = [];
      for (let y = g.board.height - 1; y >= 0; y--) for (let x = 0; x < g.board.width; x++) if (!taken.has(`${x},${y}`)) free.push({ x, y });
      g = restGuild(g, Object.fromEntries(dead.map((h, i) => [h.id, free[i]!])));
    } else {
      for (const h of g.heroes) g = activateHero(g, h.id);
      g = finishHeroActivations(g);
    }
    g = runMonsterTurn(g, testContent).state;
    expect(validateGameState(g, testContent), `manche ${g.round}`).toEqual([]);
  }
  return { final: g, rounds: g.round };
}

describe('simulation de bout en bout', () => {
  it.each([1, 2, 3, 4, 5])('graine %i : se termine ou reste cohérente sur plusieurs manches', (seed) => {
    const { final, rounds } = play(seed, 'easy');
    expect(rounds).toBeGreaterThan(1);
    expect(['GUILD_TURN', 'SCENARIO_LOST', 'SCENARIO_WON']).toContain(final.phase);
    expect(final.events.length).toBeGreaterThan(rounds);
  });

  it('Legendary : une seule mort suffit à perdre', () => {
    const { final } = play(7, 'legendary');
    if (final.phase === 'SCENARIO_LOST') expect(final.deaths).toBe(1);
  });

  it('rejouable à l identique avec la même graine', () => {
    expect(JSON.stringify(play(9, 'easy').final)).toBe(JSON.stringify(play(9, 'easy').final));
  });
});

import { describe, expect, it } from 'vitest';
import type { GameState } from '../domain/schemas';
import { boxProblems } from '../figurines';
import { createSeededRandom } from '../random';
import { createScenarioGame, validateScenario } from './definition';
import { EVENT_IDS, drawEvent, occupants } from './events';
import { generateScenario } from './generate';
import { runScript, type Rule } from './script';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES, ORIGINAL_REWARDS, ORIGINAL_SCENARIOS, scenarioById } from '@/game-data/original';

const heroes = ORIGINAL_HEROES.slice(0, 3);
const game = (id = 'cave-aux-cendres', seed = 1): GameState => ({ ...createScenarioGame(scenarioById(id)!, { sessionId: 's', difficulty: 'medium', seed, heroes }, ORIGINAL_CONTENT), phase: 'GUILD_TURN' });
const ctxOf = (s: GameState, seed = 1) => ({ s, rng: createSeededRandom(seed), monsters: ORIGINAL_CONTENT.monsters, rewards: ORIGINAL_REWARDS, tag: 'ev', ruleId: 'evenement-1' });
const rule = (round = 1): Rule[] => [{ id: 'evenement', when: [{ type: 'round-reached', round }], then: [{ type: 'random-event' }] }];
const play = (s: GameState, rules = rule()) => runScript({ ...s, round: 1 }, rules, ORIGINAL_REWARDS, ORIGINAL_CONTENT.monsters);

describe('événements aléatoires', () => {
  it('huit événements possibles', () => {
    expect(EVENT_IDS.length).toBeGreaterThanOrEqual(8);
  });

  it('même partie, même événement ; des parties différentes en tirent d’autres', () => {
    const a = play(game('cave-aux-cendres', 5));
    const b = play(game('cave-aux-cendres', 5));
    expect(a.state.eventsDone).toEqual(b.state.eventsDone);
    expect(a.beats[0]!.title).toBe(b.beats[0]!.title);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) seen.add(play(game('cave-aux-cendres', seed)).state.eventsDone![0]!);
    expect(seen.size).toBeGreaterThanOrEqual(5); // de la surprise : plusieurs événements différents selon la partie
  });

  it('l’événement est annoncé (récit) et noté au journal, une seule fois par règle', () => {
    const r = play(game());
    expect(r.beats).toHaveLength(1);
    expect(['danger', 'story', 'reward']).toContain(r.beats[0]!.tone);
    expect(r.state.events.some((e) => e.type === 'event')).toBe(true);
    expect(runScript(r.state, rule(), ORIGINAL_REWARDS, ORIGINAL_CONTENT.monsters).beats).toHaveLength(0);
  });

  it('un même événement ne se produit qu’une fois par partie : on épuise le catalogue sans doublon', () => {
    let s = game();
    const got: string[] = [];
    for (let i = 0; i < EVENT_IDS.length + 3; i++) {
      const ev = drawEvent(ctxOf(structuredClone(s), i + 1));
      if (!ev) break;
      s = { ...s, eventsDone: [...(s.eventsDone ?? []), ev.id] };
      got.push(ev.id);
    }
    expect(new Set(got).size).toBe(got.length);
    expect(got.length).toBeLessThanOrEqual(EVENT_IDS.length);
  });

  it('un renfort apparaît sur un jeton Spawn libre, dans la limite des boîtes et de deux figurines par case', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = structuredClone(game('cave-aux-cendres', seed));
      const before = s.monsters.length;
      const ev = drawEvent({ ...ctxOf(s, seed), s });
      if (!ev) continue;
      if (ev.id === 'renfort' || ev.id === 'embuscade') {
        expect(s.monsters.length).toBeGreaterThan(before);
        const added = s.monsters.slice(before);
        for (const m of added) {
          expect(s.spawnPoints.some((p) => p.at.x === m.position!.x && p.at.y === m.position!.y)).toBe(true);
          expect(occupants(s, m.position!)).toBeLessThanOrEqual(2);
          expect(m.status).toBe('board');
        }
        const counts = new Map<string, number>();
        for (const m of s.monsters) counts.set(m.definitionId, (counts.get(m.definitionId) ?? 0) + 1);
        expect(boxProblems(counts, ORIGINAL_CONTENT.monsters)).toEqual([]);
      }
    }
  });

  it('plus aucune figurine dans la boîte : pas de renfort ni d’embuscade', () => {
    const s = structuredClone(game());
    const orcs = s.monsters.filter((m) => m.definitionId === 'OM' || m.definitionId === 'OC').length;
    // On remplit la boîte des Orcs (8) et les autres types : plus aucun renfort possible.
    const extra = (id: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${id}x${i}`, definitionId: id, position: { x: 0, y: 0 }, status: 'spawn-tile' as const, isGuard: false, wounds: 0 }));
    s.monsters.push(...extra('OM', Math.max(0, 8 - orcs)), ...extra('GA', 6), ...extra('SB', 2), ...extra('HB', 2));
    for (let seed = 1; seed <= 30; seed++) {
      const t = structuredClone(s);
      const ev = drawEvent({ ...ctxOf(t, seed), s: t });
      expect(['renfort', 'embuscade']).not.toContain(ev?.id);
    }
  });

  it('alarme : une porte fermée s’ouvre ; la porte qui claque en ferme une ouverte ; la porte spéciale n’est jamais touchée', () => {
    let opened = 0;
    let closed = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const s = structuredClone(game('cave-aux-cendres', seed));
      const special = s.board.doors.filter((d) => d.special).map((d) => [d.id, d.open] as const);
      const open0 = s.board.doors.filter((d) => d.open).length;
      const ev = drawEvent({ ...ctxOf(s, seed), s });
      if (ev?.id === 'alarme') {
        opened++;
        expect(s.board.doors.filter((d) => d.open).length).toBe(open0 + 1);
        expect(ev.instructions[0]!.visual).toMatchObject({ type: 'door', open: true });
      }
      if (ev?.id === 'porte-claque') {
        closed++;
        expect(s.board.doors.filter((d) => d.open).length).toBe(open0 - 1);
      }
      for (const [id, open] of special) expect(s.board.doors.find((d) => d.id === id)!.open).toBe(open);
    }
    expect(opened).toBeGreaterThan(0);
    expect(closed).toBeGreaterThan(0);
  });

  it('bourse : +1 pièce ; butin : une carte Récompense en plus ; réveil : plus aucun garde', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200 && seen.size < 3; seed++) {
      const s = structuredClone(game('cave-aux-cendres', seed));
      const coins = s.coins;
      const ev = drawEvent({ ...ctxOf(s, seed), s });
      if (ev?.id === 'bourse') {
        seen.add('bourse');
        expect(s.coins).toBe(coins + 1);
      }
      if (ev?.id === 'butin') {
        seen.add('butin');
        expect(s.rewards).toHaveLength(1);
      }
      if (ev?.id === 'reveil') {
        seen.add('reveil');
        expect(s.monsters.every((m) => !m.isGuard)).toBe(true);
      }
    }
    expect([...seen].sort()).toEqual(['bourse', 'butin', 'reveil']);
  });
});

describe('événements : dans les scénarios', () => {
  it('chaque scénario livré (hors terrain d’essai) a ses événements aux manches 3 et 5', () => {
    for (const def of ORIGINAL_SCENARIOS.filter((s) => !s.sandbox)) {
      const events = (def.script ?? []).filter((r) => r.then.some((e) => e.type === 'random-event'));
      expect(events.map((r) => r.when[0]), def.id).toEqual([{ type: 'round-reached', round: 3 }, { type: 'round-reached', round: 5 }]);
      expect(validateScenario(def, ORIGINAL_CONTENT), def.id).toEqual([]);
    }
  });

  it('les scénarios aléatoires ont de 1 à 3 événements selon la taille', () => {
    const count = (tiles: number) => (generateScenario({ tileCount: tiles, seed: 4 }, ORIGINAL_CONTENT).script ?? []).filter((r) => r.then.some((e) => e.type === 'random-event')).length;
    expect(count(1)).toBe(1);
    expect(count(4)).toBe(2);
    expect(count(8)).toBe(3);
  });

  it('jouer plusieurs manches : les événements s’enchaînent sans doublon et la partie reste valide', () => {
    const def = scenarioById('cave-aux-cendres')!;
    let s = game('cave-aux-cendres', 9);
    for (const round of [3, 4, 5, 6]) s = runScript({ ...s, round }, def.script!, ORIGINAL_REWARDS, ORIGINAL_CONTENT.monsters).state;
    expect(new Set(s.eventsDone).size).toBe(s.eventsDone!.length);
    expect(s.eventsDone!.length).toBe(2);
  });
});

import { describe, expect, it } from 'vitest';
import { runMonsterTurn } from './activation/monsterTurn';
import { applyCorrection } from './corrections';
import { DEFAULT_ATTACK_DIE } from '@/game-data/dice';
import type { GameState } from './domain/schemas';
import { addMonster, DICE_PRESETS, presetOf } from './sandbox';
import { createScenarioGame, validateScenario } from './scenario/definition';
import { skipGuildTurn, startScenario } from './turn/machine';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES, ORIGINAL_SCENARIOS } from '@/game-data/original';
import { TERRAIN_ESSAI } from '@/game-data/original/scenarios/terrain-essai';

const at = (x: number, y: number) => ({ x, y });

/** Terrain d'essai prêt à jouer (graine variable). Défense numérique : ces tests ne portent pas sur la saisie des boucliers. */
function sandbox(seed = 1, over: Partial<GameState['settings']> = {}): GameState {
  const g = createScenarioGame(TERRAIN_ESSAI, { sessionId: 's', difficulty: 'easy', seed, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT);
  const s = startScenario(g);
  return { ...s, settings: { ...s.settings, defenseRoll: 'digital', ...over } };
}

describe('terrain d’essai : le scénario', () => {
  it('est valide, marqué « terrain d’essai », et propose un monstre de chaque type', () => {
    expect(validateScenario(TERRAIN_ESSAI, ORIGINAL_CONTENT)).toEqual([]);
    expect(TERRAIN_ESSAI.sandbox).toBe(true);
    expect(ORIGINAL_SCENARIOS.filter((s) => s.sandbox).map((s) => s.id)).toEqual(['terrain-essai']);
    const types = new Set(TERRAIN_ESSAI.monsters.map((m) => m.definitionId));
    expect([...types].sort()).toEqual(Object.keys(ORIGINAL_CONTENT.monsters).sort());
  });

  it('le deck d’activation contient des cartes de tous les types, même ceux ajoutés ensuite', () => {
    const g = sandbox();
    const inDeck = new Set([...g.deck.draw, ...g.deck.discard].flatMap((c) => (c.monsterDefId ? [c.monsterDefId] : [])));
    expect([...inDeck].sort()).toEqual(Object.keys(ORIGINAL_CONTENT.monsters).sort());
  });
});

describe('terrain d’essai : ajouter un monstre', () => {
  it('pose un monstre du type choisi, avec un identifiant unique, sans toucher à l’état d’origine', () => {
    const g = sandbox();
    const a = addMonster(g, ORIGINAL_CONTENT, 'rodeur', at(5, 8));
    const b = addMonster(a, ORIGINAL_CONTENT, 'rodeur', at(6, 8));
    expect(a.monsters.find((m) => m.id === 'rodeur2')).toMatchObject({ definitionId: 'rodeur', position: at(5, 8), status: 'board', wounds: 0, isGuard: false });
    expect(b.monsters.map((m) => m.id)).toContain('rodeur3');
    expect(g.monsters.some((m) => m.id === 'rodeur2')).toBe(false);
    expect(a.events.at(-1)!.type).toBe('sandbox-add');
  });

  it('refuse une case occupée, hors du plateau, ou un type inconnu', () => {
    const g = sandbox();
    expect(() => addMonster(g, ORIGINAL_CONTENT, 'rodeur', at(0, 7))).toThrow(/déjà occupée/); // un héros s'y tient
    expect(() => addMonster(g, ORIGINAL_CONTENT, 'rodeur', at(4, 6))).toThrow(/déjà occupée/); // un monstre s'y tient
    expect(() => addMonster(g, ORIGINAL_CONTENT, 'rodeur', at(4, 4))).toThrow(/pas sur le plateau/); // le puits
    expect(() => addMonster(g, ORIGINAL_CONTENT, 'rodeur', at(40, 4))).toThrow(/pas sur le plateau/);
    expect(() => addMonster(g, ORIGINAL_CONTENT, 'dragon', at(5, 8))).toThrow(/inconnu/);
  });
});

describe('terrain d’essai : blessures, tour et dés', () => {
  it('correction des blessures d’un monstre : valeur entière, jamais négative', () => {
    const g = sandbox();
    expect(applyCorrection(g, { kind: 'monster-wounds', monsterId: 'brute1', wounds: 3 }).monsters.find((m) => m.id === 'brute1')!.wounds).toBe(3);
    expect(applyCorrection(g, { kind: 'monster-wounds', monsterId: 'brute1', wounds: -2 }).monsters.find((m) => m.id === 'brute1')!.wounds).toBe(0);
    expect(applyCorrection(g, { kind: 'monster-wounds', monsterId: 'brute1', wounds: 2.7 }).monsters.find((m) => m.id === 'brute1')!.wounds).toBe(2);
  });

  it('sauter le tour de guilde mène directement au Monster Turn, sans activation', () => {
    const g = sandbox();
    expect(g.phase).toBe('GUILD_TURN');
    const s = skipGuildTurn(g);
    expect(s.phase).toBe('MONSTER_TURN_SPAWN');
    expect(s.activatedHeroIds).toEqual([]);
    expect(s.events.at(-1)!.type).toBe('guild-skip');
    expect(() => skipGuildTurn(s)).toThrow(/Pas de tour de guilde/);
  });

  it('préréglages de dés : retrouvés à partir des faces, « aléatoires » par défaut', () => {
    expect(presetOf(DEFAULT_ATTACK_DIE).id).toBe('random');
    for (const p of DICE_PRESETS) expect(presetOf(p.faces ?? DEFAULT_ATTACK_DIE).id).toBe(p.id);
  });
});

describe('terrain d’essai : une situation se rejoue à l’identique', () => {
  /** Grom (h1) collé au rôdeur 1 (en (4,6)) ; cartes choisies à la main : le rôdeur agit aux deux activations. */
  const situation = (seed: number) => {
    const g = sandbox(seed, { cardMode: 'physical' });
    return skipGuildTurn({ ...g, heroes: g.heroes.map((h) => (h.id === 'h1' ? { ...h, position: at(4, 7) } : h)) });
  };
  const card = { kind: 'card', value: 'rodeur' } as const;
  const run = (seed: number, presetId: string) => {
    const faces = DICE_PRESETS.find((p) => p.id === presetId)!.faces!;
    return runMonsterTurn(situation(seed), { ...ORIGINAL_CONTENT, attackDie: faces }, [card, card]);
  };

  it('dés « toujours S1 » : même jeton de référence et mêmes étapes quelle que soit la graine', () => {
    const a = run(1, 'hit-s1');
    const b = run(99, 'hit-s1');
    const ref = (r: ReturnType<typeof run>) => r.instructions.filter((i) => i.visual?.type === 'spawn-point').map((i) => (i.visual as { pointId: string }).pointId);
    expect(ref(a)).toEqual(['S1', 'S1']);
    expect(ref(b)).toEqual(['S1', 'S1']);
    expect(a.instructions.map((i) => i.id)).toEqual(b.instructions.map((i) => i.id));
  });

  it('dés « toujours S2 » : le jeton de référence change', () => {
    const r = run(3, 'hit-s2');
    expect(r.instructions.filter((i) => i.visual?.type === 'spawn-point').map((i) => (i.visual as { pointId: string }).pointId)).toEqual(['S2', 'S2']);
  });

  it('« touchent toujours » : le rôdeur blesse Grom à chaque attaque ; « ratent toujours » : jamais', () => {
    const wounds = (r: ReturnType<typeof run>) => r.instructions.filter((i) => i.visual?.type === 'attack').map((i) => (i.visual as { wounds: number }).wounds);
    expect(wounds(run(5, 'hit-s1')).every((w) => w > 0)).toBe(true);
    expect(wounds(run(5, 'hit-s1')).length).toBeGreaterThan(0);
    expect(wounds(run(5, 'miss-s1'))).toEqual(wounds(run(5, 'miss-s1')).map(() => 0));
    expect(wounds(run(5, 'miss-s1')).length).toBeGreaterThan(0);
  });

  it('le monstre choisi à la main est celui qui agit : le rôdeur, pas les autres', () => {
    const r = run(7, 'hit-s1');
    const actors = r.instructions.filter((i) => i.visual?.type === 'activate').map((i) => i.actorId);
    expect(actors).toEqual(['rodeur1', 'rodeur1']);
    expect(r.instructions.filter((i) => i.group === 'Activation 1').length).toBeGreaterThan(0);
  });
});

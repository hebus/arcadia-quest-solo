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
  it('est valide, marqué « terrain d’essai », et ne propose que des monstres dont les stats existent au niveau du scénario', () => {
    expect(validateScenario(TERRAIN_ESSAI, ORIGINAL_CONTENT)).toEqual([]);
    expect(TERRAIN_ESSAI.sandbox).toBe(true);
    expect(ORIGINAL_SCENARIOS.filter((s) => s.sandbox).map((s) => s.id)).toEqual(['terrain-essai']);
    const types = TERRAIN_ESSAI.monsters.map((m) => m.definitionId);
    expect([...new Set(types)].sort()).toEqual(['HB', 'M', 'OC', 'OM', 'SB', 'T']); // un monstre de chaque type du niveau 1 (3 Marauder)
  });

  it('le deck d’activation contient les cartes des monstres jouables au niveau du scénario', () => {
    const g = sandbox();
    const inDeck = new Set([...g.deck.draw, ...g.deck.discard].flatMap((c) => (c.monsterDefId ? [c.monsterDefId] : [])));
    expect([...inDeck].sort()).toEqual(['HB', 'M', 'OC', 'OM', 'SB', 'T']); // tous les monstres du niveau 1, même ceux ajoutés ensuite
  });
});

describe('terrain d’essai : ajouter un monstre', () => {
  it('pose un monstre du type choisi, avec un identifiant unique, sans toucher à l’état d’origine', () => {
    const g = sandbox();
    const a = addMonster(g, ORIGINAL_CONTENT, 'OM', at(3, 1));
    const b = addMonster(a, ORIGINAL_CONTENT, 'OM', at(2, 1));
    expect(a.monsters.find((m) => m.id === 'OM2')).toMatchObject({ definitionId: 'OM', position: at(3, 1), status: 'board', wounds: 0, isGuard: false });
    expect(b.monsters.map((m) => m.id)).toContain('OM1');
    expect(g.monsters.some((m) => m.id === 'OM2')).toBe(false);
    expect(a.events.at(-1)!.type).toBe('sandbox-add');
  });

  it('refuse une case occupée, hors du plateau, ou un type inconnu', () => {
    const g = sandbox();
    // Deux figurines au maximum par case : un héros seul laisse une place, pas héros + monstre.
    const shared = addMonster(g, ORIGINAL_CONTENT, 'OM', at(0, 5)); // Grom seul sur sa case de départ
    expect(() => addMonster(shared, ORIGINAL_CONTENT, 'OM', at(0, 5))).toThrow(/pleine/);
    const twoMonsters = addMonster(g, ORIGINAL_CONTENT, 'OM', at(3, 0)); // OM1 s'y tenait déjà
    expect(() => addMonster(twoMonsters, ORIGINAL_CONTENT, 'OM', at(3, 0))).toThrow(/pleine/);
    expect(() => addMonster(g, ORIGINAL_CONTENT, 'OM', at(6, 4))).toThrow(/pas sur le plateau/); // hors du plateau 6×6
    expect(() => addMonster(g, ORIGINAL_CONTENT, 'OM', at(-1, 2))).toThrow(/pas sur le plateau/);
    expect(() => addMonster(g, ORIGINAL_CONTENT, 'OM', at(40, 4))).toThrow(/pas sur le plateau/);
    expect(() => addMonster(g, ORIGINAL_CONTENT, 'dragon', at(5, 8))).toThrow(/inconnu/);
  });
});

describe('terrain d’essai : blessures, tour et dés', () => {
  it('correction des blessures d’un monstre : valeur entière, jamais négative', () => {
    const g = sandbox();
    expect(applyCorrection(g, { kind: 'monster-wounds', monsterId: 'OM1', wounds: 3 }).monsters.find((m) => m.id === 'OM1')!.wounds).toBe(3);
    expect(applyCorrection(g, { kind: 'monster-wounds', monsterId: 'OM1', wounds: -2 }).monsters.find((m) => m.id === 'OM1')!.wounds).toBe(0);
    expect(applyCorrection(g, { kind: 'monster-wounds', monsterId: 'OM1', wounds: 2.7 }).monsters.find((m) => m.id === 'OM1')!.wounds).toBe(2);
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
  /** OM1 en (1,1), collé à Grom (h1) : c'est la figurine la mieux placée pour attaquer ; cartes choisies à la main : OM (activation 1), puis OM (plus de Marauder disponible, écartée) et T (activation 2). */
  const situation = (seed: number) => {
    const g = sandbox(seed, { cardMode: 'physical' });
    return skipGuildTurn({
      ...g,
      heroes: g.heroes.map((h) => (h.id === 'h1' ? { ...h, position: at(1, 2) } : h)),
      monsters: g.monsters.map((m) => (m.id === 'OM1' ? { ...m, position: at(1, 1) } : m)),
    });
  };
  const cards = [{ kind: 'card', value: 'OM' }, { kind: 'card', value: 'OM' }, { kind: 'card', value: 'T' }] as const;
  const run = (seed: number, presetId: string) => {
    const faces = DICE_PRESETS.find((p) => p.id === presetId)!.faces!;
    return runMonsterTurn(situation(seed), { ...ORIGINAL_CONTENT, attackDie: faces }, cards);
  };

  it('mêmes dés « toujours S1 » : mêmes étapes quelle que soit la graine', () => {
    const a = run(1, 'hit-s1');
    const b = run(99, 'hit-s1');
    expect(a.instructions.map((i) => i.id)).toEqual(b.instructions.map((i) => i.id));
    expect(a.instructions.some((i) => i.visual?.type === 'spawn-point')).toBe(false);
  });

  it('« touchent toujours » : l’Orc Marauder blesse Grom à chaque attaque ; « ratent toujours » : jamais', () => {
    const wounds = (r: ReturnType<typeof run>) => r.instructions.filter((i) => i.visual?.type === 'attack').map((i) => (i.visual as { wounds: number }).wounds);
    expect(wounds(run(5, 'hit-s1')).every((w) => w > 0)).toBe(true);
    expect(wounds(run(5, 'hit-s1')).length).toBeGreaterThan(0);
    expect(wounds(run(5, 'miss-s1'))).toEqual(wounds(run(5, 'miss-s1')).map(() => 0));
    expect(wounds(run(5, 'miss-s1')).length).toBeGreaterThan(0);
  });

  it('la figurine la mieux placée pour attaquer est celle qui agit en premier, l’autre activation revient à un autre monstre', () => {
    const r = run(7, 'hit-s1');
    const actors = r.instructions.filter((i) => i.visual?.type === 'activate').map((i) => i.actorId);
    expect(actors).toHaveLength(2);
    expect(actors[0]).toBe('OM1');
    expect(actors[1]).toBe('T1'); // un seul Marauder : la 2e carte OM est écartée, c'est le Troll qui agit
    expect(r.instructions.find((i) => i.id === 'R1-A1-attack')).toBeDefined();
    expect(r.instructions.filter((i) => i.group === 'Activation 1').length).toBeGreaterThan(0);
  });
});

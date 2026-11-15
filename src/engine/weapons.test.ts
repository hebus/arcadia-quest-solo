import { describe, expect, it } from 'vitest';
import { resolveHeroAttack } from './combat/heroActions';
import type { GameState } from './domain/schemas';
import { createScenarioGame } from './scenario/definition';
import { planMonsterAction } from './movement/plan';
import { restGuild, startScenario } from './turn/machine';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES } from '@/game-data/original';
import { TEST_ORIGINAL_CONTENT } from '@/tests/fixtures/originalContent';
import { CAVE_AUX_CENDRES_LEGACY as CAVE_AUX_CENDRES } from '@/tests/fixtures/legacyScenario';

/** Mira (h1) en (3,2), à côté du rôdeur 1 en (3,1). */
function started(): GameState {
  const g = createScenarioGame(CAVE_AUX_CENDRES, { sessionId: 's', difficulty: 'medium', seed: 5, heroes: ORIGINAL_HEROES.slice(0, 3) }, ORIGINAL_CONTENT);
  const s = startScenario(g);
  // Ces tests portent sur le combat des héros : la défense est tirée numériquement pour ne pas demander de saisie.
  return { ...s, settings: { ...s.settings, defenseRoll: 'digital' as const }, heroes: s.heroes.map((h) => (h.id === 'h1' ? { ...h, position: { x: 3, y: 2 } } : h)) };
}
const target = [{ monsterId: 'OM1', wounds: 1 }];
const weapon = (g: GameState, id: string) => g.heroes[0]!.weapons!.find((w) => w.id === id)!;
const nextTurn = (g: GameState): GameState => ({ ...g, heroTurn: {}, activatedHeroIds: [] });

describe('cartes arme', () => {
  it('chaque carte indique un nombre de dés et un type d’attaque', () => {
    for (const h of ORIGINAL_HEROES) {
      expect(h.weapons!.length).toBeGreaterThan(0);
      for (const w of h.weapons!) {
        expect(w.attackDice).toBeGreaterThan(0);
        expect(['melee', 'ranged']).toContain(w.attackType);
      }
    }
  });

  it('attaquer épuise la carte utilisée, pas les autres', () => {
    const r = resolveHeroAttack(started(), ORIGINAL_CONTENT, 'h1', target, [], { weaponId: 'lame' });
    expect(weapon(r.state, 'lame').exhausted).toBe(true);
    expect(weapon(r.state, 'arbalete').exhausted).toBe(false);
  });

  it('une carte épuisée ne peut pas rejouer, même au tour suivant, tant que la guilde ne s’est pas reposée', () => {
    const r = resolveHeroAttack(started(), ORIGINAL_CONTENT, 'h1', target, [], { weaponId: 'lame' });
    expect(() => resolveHeroAttack(nextTurn(r.state), ORIGINAL_CONTENT, 'h1', target, [], { weaponId: 'lame' })).toThrow(/épuisée/);
    // Une autre carte reste jouable.
    expect(() => resolveHeroAttack(nextTurn(r.state), ORIGINAL_CONTENT, 'h1', target, [], { weaponId: 'arbalete' })).not.toThrow();
  });

  it('le repos retire tous les jetons : on peut rejouer la carte, puis les monstres jouent', () => {
    let g = resolveHeroAttack(started(), ORIGINAL_CONTENT, 'h1', target, [], { weaponId: 'lame' }).state;
    g = resolveHeroAttack(nextTurn(g), ORIGINAL_CONTENT, 'h1', target, [], { weaponId: 'arbalete' }).state;
    expect(g.heroes[0]!.weapons!.every((w) => w.exhausted)).toBe(true);
    // Les ripostes aléatoires ont pu blesser Mira : le repos se teste sur des héros en vie.
    g = { ...g, heroes: g.heroes.map((h) => ({ ...h, dead: false, wounds: 0 })) };
    const rested = restGuild(nextTurn(g));
    expect(rested.phase).toBe('MONSTER_TURN_SPAWN');
    expect(rested.heroes.flatMap((h) => h.weapons ?? []).every((w) => !w.exhausted)).toBe(true);
    expect(rested.events.some((e) => e.type === 'guild-rest')).toBe(true);
  });

  it('les cartes sont gérées par les joueurs : sans carte désignée, l’attaque passe et n’épuise rien', () => {
    const r = resolveHeroAttack(started(), ORIGINAL_CONTENT, 'h1', target, [], { attackType: 'melee' });
    expect(r.state.heroes[0]!.weapons!.every((w) => !w.exhausted)).toBe(true);
    expect(() => resolveHeroAttack(started(), ORIGINAL_CONTENT, 'h1', target, [], { weaponId: 'inconnue' })).toThrow(/Carte arme inconnue/);
  });

  it('le type de la carte impose la portée : une arme de mêlée ne touche pas à distance', () => {
    const far = { ...started(), monsters: started().monsters.map((m) => (m.id === 'OM1' ? { ...m, position: { x: 3, y: 0 } } : m)) };
    expect(() => resolveHeroAtt(far, 'lame')).toThrow(/corps à corps|mêlée|cible valide/i);
    expect(() => resolveHeroAtt(far, 'arbalete')).not.toThrow();
  });
});

function resolveHeroAtt(g: GameState, weaponId: string) {
  return resolveHeroAttack(g, ORIGINAL_CONTENT, 'h1', target, [], { weaponId });
}

describe('combat d’un héros : le joueur indique les blessures du monstre', () => {
  it('les blessures saisies s’appliquent telles quelles, sans parade calculée par l’application', () => {
    const r = resolveHeroAttack(started(), ORIGINAL_CONTENT, 'h1', [{ monsterId: 'OM1', wounds: 1 }], [], { weaponId: 'lame' });
    expect(r.state.monsters.find((m) => m.id === 'OM1')!.wounds).toBe(1);
  });

  it('au seuil de mort sur le coup, le monstre est tué sans riposte', () => {
    const r = resolveHeroAttack(started(), ORIGINAL_CONTENT, 'h1', [{ monsterId: 'OM1', wounds: 4 }], [], { weaponId: 'lame' });
    expect(r.state.monsters.find((m) => m.id === 'OM1')!.status).not.toBe('board');
    expect(r.instructions.some((i) => i.id.startsWith('Payback'))).toBe(false);
  });

  it('Payback : un monstre qui perd son dernier point de vie riposte quand même, puis est retiré de sa case finale', () => {
    // Orc Marauder niveau 1 : 2 points de vie, tué sur le coup à 3 blessures. À 2 blessures il tombe mais riposte.
    const r = resolveHeroAttack(started(), ORIGINAL_CONTENT, 'h1', [{ monsterId: 'OM1', wounds: 2 }], [], { weaponId: 'lame' });
    expect(r.state.monsters.find((m) => m.id === 'OM1')!.status).not.toBe('board');
    const ids = r.instructions.map((i) => i.id);
    const payback = ids.findIndex((id) => id.startsWith('Payback'));
    const removal = ids.indexOf('kill-OM1');
    expect(payback).toBeGreaterThanOrEqual(0);
    expect(removal).toBeGreaterThan(payback); // retiré après sa riposte
  });

  it('juste sous le seuil de mort sur le coup il riposte ; au seuil exact il ne riposte pas', () => {
    const under = resolveHeroAttack(started(), ORIGINAL_CONTENT, 'h1', [{ monsterId: 'OM1', wounds: 2 }], [], { weaponId: 'lame' });
    expect(under.instructions.some((i) => i.id.startsWith('Payback'))).toBe(true);
    const exact = resolveHeroAttack(started(), ORIGINAL_CONTENT, 'h1', [{ monsterId: 'OM1', wounds: 3 }], [], { weaponId: 'lame' });
    expect(exact.instructions.some((i) => i.id.startsWith('Payback'))).toBe(false);
  });

  it('Payback : seul le monstre attaqué riposte, pas un voisin non ciblé', () => {
    const s0 = started();
    // Un second rôdeur colle Mira (en (2,2)) mais n'est pas attaqué ; l'attaque au corps à corps vise OM1.
    const s = { ...s0, monsters: s0.monsters.map((m) => (m.id === 'OM2' ? { ...m, position: { x: 2, y: 2 } } : m)) };
    const r = resolveHeroAttack(s, ORIGINAL_CONTENT, 'h1', [{ monsterId: 'OM1', wounds: 1 }], [], { weaponId: 'lame' });
    const ids = r.instructions.map((i) => i.id);
    expect(ids.some((id) => id.startsWith('Payback') && id.includes('OM1'))).toBe(true);
    expect(ids.some((id) => id.includes('OM2'))).toBe(false);
  });

  it('réaction Guard (règle distincte du Payback) : une attaque ne déclenche plus de Guard (seulement un déplacement)', () => {
    const s0 = started();
    // Cible éloignée en (3,0), trait dégagé ; un rôdeur non ciblé est adjacent en (2,2) : il ne réagit pas (Guard ne se déclenche que quand le héros se déplace) et ne fait pas de Payback.
    const s = { ...s0, monsters: s0.monsters.map((m) => (m.id === 'OM1' ? { ...m, position: { x: 3, y: 0 } } : m.id === 'OM2' ? { ...m, position: { x: 2, y: 2 } } : m)) };
    const r = resolveHeroAttack(s, ORIGINAL_CONTENT, 'h1', [{ monsterId: 'OM1', wounds: 1 }], [], { weaponId: 'arbalete' });
    const ids = r.instructions.map((i) => i.id);
    expect(ids.some((id) => id.startsWith('Réaction Guard'))).toBe(false);
    expect(ids.some((id) => id.startsWith('Payback') && id.includes('OM2'))).toBe(false);
  });

  it('des blessures négatives ou fractionnaires sont refusées', () => {
    expect(() => resolveHeroAttack(started(), ORIGINAL_CONTENT, 'h1', [{ monsterId: 'OM1', wounds: -1 }], [], { weaponId: 'lame' })).toThrow(/invalides/);
    expect(() => resolveHeroAttack(started(), ORIGINAL_CONTENT, 'h1', [{ monsterId: 'OM1', wounds: 1.5 }], [], { weaponId: 'lame' })).toThrow(/invalides/);
  });
});

describe('monstre : cinq caractéristiques', () => {
  it('vie, blessures pour tuer sur le coup, mouvement, dés d’attaque + type, récompense — rien d’autre', () => {
    for (const m of Object.values(ORIGINAL_CONTENT.monsters)) {
      for (const stats of Object.values(m.levels)) {
        // Les cinq caractéristiques de base ; en plus, seulement défense, relances et compétences quand le monstre en a.
        const base = ['attackDice', 'attackType', 'life', 'movement', 'overkill', 'reward'];
        expect(Object.keys(stats).filter((k) => !['defense', 'rerolls', 'skills'].includes(k)).sort()).toEqual(base);
      }
    }
  });
});

describe('Payback : le monstre se déplace de son potentiel puis attaque son attaquant si c’est possible', () => {
  /** Mira (h1) en (6,8) sur la rue du sud ; les autres héros écartés ; le monstre `id` placé en `at`. */
  const arena = (id: string, at: { x: number; y: number }): GameState => {
    const s0 = started();
    return {
      ...s0,
      heroes: s0.heroes.map((h) => (h.id === 'h1' ? { ...h, position: { x: 6, y: 8 } } : h.id === 'h2' ? { ...h, position: { x: 8, y: 5 } } : { ...h, position: { x: 8, y: 6 } })),
      monsters: s0.monsters.map((m) => (m.id === id ? { ...m, position: at } : m)),
    };
  };
  const shoot = (g: GameState, id: string) => resolveHeroAttack(g, ORIGINAL_CONTENT, 'h1', [{ monsterId: id, wounds: 1 }], [], { weaponId: 'arbalete' });
  const shoot2 = (g: GameState, targets: { monsterId: string; wounds: number }[]) => resolveHeroAttack(g, ORIGINAL_CONTENT, 'h1', targets, [], { weaponId: 'arbalete' });
  const ids = (r: ReturnType<typeof shoot>) => r.instructions.map((i) => i.id);

  it('à portée de son mouvement : il avance jusqu’à une case d’où il peut frapper, puis attaque', () => {
    // Orc Marauder (mêlée, mouvement 1) à 2 cases : 1 pas suffit pour être adjacent.
    const r = shoot(arena('OM1', { x: 4, y: 8 }), 'OM1');
    const move = r.instructions.find((i) => i.id === 'payback-move-OM1');
    expect(move?.path).toEqual([{ x: 4, y: 8 }, { x: 5, y: 8 }]);
    const order = ids(r);
    expect(order.indexOf('Payback-OM1')).toBeGreaterThan(order.indexOf('payback-move-OM1'));
    expect(r.state.monsters.find((m) => m.id === 'OM1')!.position).toEqual({ x: 5, y: 8 });
  });

  it('trop loin : il se déplace de tout son mouvement vers l’attaquant mais ne peut pas attaquer', () => {
    const r = shoot(arena('OM1', { x: 0, y: 8 }), 'OM1');
    const move = r.instructions.find((i) => i.id === 'payback-move-OM1');
    expect(move?.path).toHaveLength(2); // départ + 1 pas (mouvement de l'Orc Marauder)
    expect(r.state.monsters.find((m) => m.id === 'OM1')!.position).toEqual({ x: 1, y: 8 });
    expect(ids(r).some((id) => id.startsWith('Payback-'))).toBe(false);
  });

  it('un monstre à distance qui voit déjà son attaquant riposte sans bouger', () => {
    // Seul le Goblin Archer attaque à distance ; pour les tests, son niveau 1 reprend les stats du niveau 2-3.
    const base = arena('OM1', { x: 3, y: 8 });
    const g = { ...base, monsters: base.monsters.map((m) => (m.id === 'OM1' ? { ...m, definitionId: 'GA' } : m)) };
    const r = resolveHeroAttack(g, TEST_ORIGINAL_CONTENT, 'h1', [{ monsterId: 'OM1', wounds: 1 }], [], { weaponId: 'arbalete' });
    const order = r.instructions.map((i) => i.id);
    expect(order).not.toContain('payback-move-OM1');
    expect(order).toContain('Payback-OM1');
  });

  it('seul l’attaquant est visé par la riposte, jamais un autre héros plus proche', () => {
    const g = arena('OM1', { x: 4, y: 8 });
    // Maya (h2) se tient juste à côté du monstre, bien plus près que Mira.
    const near = { ...g, heroes: g.heroes.map((h) => (h.id === 'h2' ? { ...h, position: { x: 3, y: 8 } } : h)) };
    const r = shoot(near, 'OM1');
    const attack = r.instructions.find((i) => i.id === 'Payback-OM1');
    expect(attack?.visual).toMatchObject({ type: 'attack', attackerId: 'OM1', targetId: 'h1' });
  });

  it('il ouvre une porte fermée sur son chemin en dépensant 1 point de mouvement, puis attaque', () => {
    // Rôdeur enfermé dans la remise en (2,5) ; l'attaquant est dans la rue en (2,7). La porte (2,5)-(2,6) est fermée.
    const s0 = arena('OM1', { x: 2, y: 5 });
    const g = { ...s0, heroes: s0.heroes.map((h) => (h.id === 'h1' ? { ...h, position: { x: 2, y: 7 } } : h)) };
    const plan = planMonsterAction(g, ORIGINAL_CONTENT, 'OM1', 3, { targetKind: 'hero', onlyTargetId: 'h1', choose: (_p, o) => o[0]! });
    expect(plan.steps.map((st) => st.kind)).toEqual(['open-door', 'move']);
    expect(plan.steps[0]!.doorId).toBe('porte-remise');
    expect(plan.mpUsed).toBe(2); // 1 PM pour la porte + 1 PM pour sortir
    expect(plan.canAttack).toBe(true);
    expect(plan.destination).toEqual({ x: 2, y: 6 });
  });

  it('avec un seul point de mouvement, il ouvre la porte mais ne peut ni sortir ni attaquer', () => {
    const s0 = arena('OM1', { x: 2, y: 5 });
    const g = { ...s0, heroes: s0.heroes.map((h) => (h.id === 'h1' ? { ...h, position: { x: 2, y: 7 } } : h)) };
    const plan = planMonsterAction(g, ORIGINAL_CONTENT, 'OM1', 1, { targetKind: 'hero', onlyTargetId: 'h1', choose: (_p, o) => o[0]! });
    expect(plan.canAttack).toBe(false);
    expect(plan.mpUsed).toBe(1);
    expect(plan.steps.map((st) => st.kind)).toEqual(['open-door']);
  });

  it('un monstre tombé qui ne peut pas attaquer, même en se déplaçant, est retiré directement sur place', () => {
    // Orc Marauder (2 PV, mouvement 1) à 6 cases : il tombe à 2 blessures mais ne pourrait jamais atteindre son attaquant.
    const r = shoot2(arena('OM1', { x: 0, y: 8 }), [{ monsterId: 'OM1', wounds: 2 }]);
    const ids = r.instructions.map((i) => i.id);
    expect(ids).toContain('kill-OM1');
    expect(ids).not.toContain('payback-move-OM1'); // aucun déplacement inutile
    expect(ids.some((id) => id.startsWith('Payback-'))).toBe(false);
    const removal = r.instructions.find((i) => i.id === 'kill-OM1')!;
    expect(removal.visual).toEqual({ type: 'remove', actorId: 'OM1', at: { x: 0, y: 8 } }); // retiré là où il se tenait
    expect(r.state.monsters.find((m) => m.id === 'OM1')!.status).not.toBe('board');
  });

  it('retiré tout de suite, juste après le coup, avant toute riposte d’un autre monstre', () => {
    const r = shoot2(arena('OM1', { x: 0, y: 8 }), [{ monsterId: 'OM1', wounds: 2 }]);
    const ids = r.instructions.map((i) => i.id);
    expect(ids.indexOf('kill-OM1')).toBe(ids.indexOf('hit-OM1') + 1);
  });

  it('un monstre tombé qui ne peut pas riposter ne prend pas la place de la riposte d’un autre monstre ciblé', () => {
    // OM4 tombé à 6 cases, hors d'atteinte ; OM2 vivant, collé à Mira : c'est lui qui riposte.
    const base = arena('OM4', { x: 0, y: 8 });
    const g = { ...base, monsters: base.monsters.map((m) => (m.id === 'OM2' ? { ...m, position: { x: 6, y: 7 } } : m)) };
    const r = shoot2(g, [{ monsterId: 'OM4', wounds: 2 }, { monsterId: 'OM2', wounds: 1 }]);
    const ids = r.instructions.map((i) => i.id);
    expect(ids).toContain('kill-OM4');
    expect(ids).not.toContain('payback-move-OM4');
    expect(ids).toContain('Payback-OM2');
  });

  it('un monstre tombé qui peut encore riposter en se déplaçant le fait, puis est retiré de sa case d’arrivée', () => {
    // Orc Marauder à 2 cases : 1 pas lui suffit pour frapper.
    const r = shoot2(arena('OM1', { x: 4, y: 8 }), [{ monsterId: 'OM1', wounds: 2 }]);
    const ids = r.instructions.map((i) => i.id);
    expect(ids).toContain('payback-move-OM1');
    expect(ids).toContain('Payback-OM1');
    expect(r.instructions.find((i) => i.id === 'kill-OM1')!.visual).toMatchObject({ type: 'remove', at: { x: 5, y: 8 } });
    expect(ids.indexOf('kill-OM1')).toBeGreaterThan(ids.indexOf('Payback-OM1'));
  });

  it('un monstre non tombé qui ne peut pas attaquer reste sur le plateau', () => {
    const r = shoot2(arena('OM1', { x: 0, y: 8 }), [{ monsterId: 'OM1', wounds: 1 }]);
    expect(r.instructions.map((i) => i.id)).not.toContain('kill-OM1');
    expect(r.state.monsters.find((m) => m.id === 'OM1')!.status).toBe('board');
  });
});


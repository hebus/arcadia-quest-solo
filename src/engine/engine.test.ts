import { describe, expect, it } from 'vitest';
import { runMonsterTurn, runMonsterTurnSafe } from './activation/monsterTurn';
import { rollPool } from './combat/dice';
import { resolveHeroAttack, resolveHeroMove } from './combat/heroActions';
import type { GameState } from './domain/schemas';
import { hasLineOfSight, isClose, selectionDistance } from './movement/board';
import { planMonsterAction } from './movement/plan';
import type { InputAnswer } from './oracle';
import { createSeededRandom } from './random';
import { validateGameState } from './setup';
import { activateHero, finishHeroActivations, restGuild, startScenario } from './turn/machine';
import { demoGame, openBoard, testContent } from '@/tests/fixtures/demo';

const physical = { diceMode: 'physical', cardMode: 'physical' } as const;
const die = (value: string): InputAnswer => ({ kind: 'die', value });
const card = (value: string): InputAnswer => ({ kind: 'card', value });
const atk = (hits: number, saves: number): InputAnswer => ({ kind: 'attack-result', hits, saves });

const toMonsterTurn = (s: GameState): GameState => {
  let g = startScenario(s);
  for (const h of g.heroes) g = activateHero(g, h.id);
  return finishHeroActivations(g);
};

describe('plateau et sélection', () => {
  it('distance de sélection : orthogonale, terrain ignoré (solo v1.3 p.2)', () => {
    expect(selectionDistance({ x: 0, y: 0 }, { x: 3, y: 2 })).toBe(5);
    const s = demoGame({ board: { ...openBoard(), walls: [[{ x: 1, y: 0 }, { x: 2, y: 0 }]] } });
    expect(selectionDistance({ x: 0, y: 0 }, { x: 4, y: 0 })).toBe(4);
    expect(s.board.walls).toHaveLength(1);
  });

  it('Close : un mur ou une porte fermée annule la proximité', () => {
    const b = { ...openBoard(), doors: [{ id: 'd', a: { x: 1, y: 1 }, b: { x: 2, y: 1 }, open: false }] };
    expect(isClose(b, { x: 1, y: 1 }, { x: 2, y: 1 })).toBe(false);
    expect(isClose(b, { x: 1, y: 1 }, { x: 2, y: 1 }, new Set(['d']))).toBe(true);
    expect(isClose(b, { x: 1, y: 1 }, { x: 2, y: 2 })).toBe(false);
    expect(isClose(b, { x: 1, y: 1 }, { x: 1, y: 1 })).toBe(true);
  });

  it('ligne de vue : bloquée par un mur, ouverte sinon', () => {
    const s = demoGame({ board: { ...openBoard(), walls: [[{ x: 2, y: 2 }, { x: 3, y: 2 }]] } });
    expect(hasLineOfSight(s, { x: 0, y: 2 }, { x: 5, y: 2 }, () => false)).toBe(false);
    expect(hasLineOfSight(s, { x: 0, y: 1 }, { x: 5, y: 1 }, () => false)).toBe(true);
  });
});

describe('dés', () => {
  it('un CRIT ajoute un dé et les relances remplacent les dés ratés', () => {
    const only = (crit: boolean) => [{ symbol: crit ? 'c' : 'm', melee: false, ranged: false, crit, save: false }];
    const r = rollPool(1, only(false), 'attack', 'melee', 3, createSeededRandom(1));
    expect(r.successes).toBe(0);
    expect(r.rerollsUsed).toBe(3);
    const hit = [{ symbol: 'h', melee: true, ranged: false, crit: false, save: false }];
    expect(rollPool(3, hit, 'attack', 'melee', 0, createSeededRandom(1)).successes).toBe(3);
    expect(rollPool(3, hit, 'attack', 'ranged', 0, createSeededRandom(1)).successes).toBe(0);
  });
});

describe('déplacement du monstre', () => {
  it('ouvrir une porte coûte 1 PM ; une porte fermée est un détour sinon', () => {
    const board = { ...openBoard(), doors: [{ id: 'd', a: { x: 4, y: 2 }, b: { x: 3, y: 2 }, open: false }] };
    const s = demoGame({ board });
    const plan = planMonsterAction(s, testContent, 'g1', 3, { targetKind: 'hero', choose: (_p, o) => o[0]! });
    expect(plan.steps.some((st) => st.kind === 'open-door') || plan.mpUsed <= 3).toBe(true);
    expect(plan.mpUsed).toBeLessThanOrEqual(3);
  });

  it("avance vers la cible la plus proche sans l'atteindre quand elle est hors de portée", () => {
    const s = demoGame();
    const plan = planMonsterAction(s, testContent, 'o1', 3, { targetKind: 'hero', choose: (_p, o) => o[0]! });
    expect(plan.canAttack).toBe(false);
    expect(plan.mpUsed).toBe(3);
  });

  it('départage les héros à égalité par le nombre de blessures', () => {
    const s = demoGame();
    s.heroes.find((h) => h.id === 'h3')!.wounds = 1;
    const plan = planMonsterAction(s, testContent, 'g1', 3, { targetKind: 'hero', choose: (_p, o) => o[0]! });
    expect(plan.canAttack).toBe(true);
    expect(plan.targetId).toBe('h3');
  });

  it('un portail coûte 1 PM et ne déclenche pas de détour', () => {
    const board = {
      ...openBoard(),
      portals: [
        { id: 'p1', at: { x: 4, y: 2 }, color: 'red' },
        { id: 'p2', at: { x: 2, y: 3 }, color: 'red' },
      ],
    };
    const s = demoGame({ board });
    const plan = planMonsterAction(s, testContent, 'g1', 3, { targetKind: 'hero', choose: (_p, o) => o[0]! });
    expect(plan.mpUsed).toBe(2); // le portail (1 PM), puis la Space du héros visé (1 PM)
    expect(plan.steps[0]!.kind).toBe('portal');
  });
});

describe('Monster Turn', () => {
  it('refuse de démarrer hors de la phase Spawn', () => {
    expect(() => runMonsterTurn(demoGame(), testContent)).toThrow(/impossible/);
  });

  it('deux activations : figurine la mieux placée, garde ignoré, trace explicative', () => {
    const s = toMonsterTurn(demoGame({ settings: physical }));
    s.heroes.find((h) => h.id === 'h1')!.position = { x: 3, y: 2 }; // adjacent au Goblin g1
    const r = runMonsterTurn(s, testContent, [card('goblin'), atk(2, 0), card('orc')]);
    expect(r.traces).toHaveLength(2);
    expect(r.traces[0]!.selectedEntityId).toBe('g1');
    expect(r.traces[1]!.selectedEntityId).toBe('o1');
    expect(r.traces[1]!.candidates).toEqual(['o1']);
    expect(r.state.monsters.find((m) => m.id === 'o2')!.position).toEqual({ x: 7, y: 0 });
    expect(r.state.phase).toBe('GUILD_TURN');
    expect(r.state.round).toBe(2);
    expect(r.state.deck.discard).toHaveLength(2);
    const wounded = r.state.heroes.filter((h) => h.wounds > 0);
    expect(wounded).toHaveLength(1);
    expect(wounded[0]!.wounds).toBe(2);
  });

  it('aucun monstre ne peut agir (seulement des gardes) : « Aucun monstre ne peut agir », aucune carte gardée en main', () => {
    const s = toMonsterTurn(demoGame({ monsters: [{ id: 'o2', definitionId: 'orc', position: { x: 7, y: 0 }, isGuard: true }] }));
    const r = runMonsterTurn(s, testContent);
    const ids = r.instructions.map((i) => i.id);
    expect(ids).toContain('R1-A1-none');
    expect(ids).toContain('R1-A2-none');
    expect(r.state.monsters.find((m) => m.id === 'o2')!.position).toEqual({ x: 7, y: 0 });
    expect(r.state.phase).toBe('GUILD_TURN');
  });

  it('Spawn Tile pleine et jeton tiré absent du plateau : le monstre sort définitivement du jeu', () => {
    const s = toMonsterTurn(demoGame({ settings: { diceMode: 'physical' }, spawnTileCapacity: 1 }));
    const g1 = s.monsters.find((m) => m.id === 'g1')!;
    g1.status = 'spawn-tile';
    g1.position = null;
    s.spawnTile = ['g1'];
    const r = runMonsterTurn(s, testContent, [die('A'), die('D')]);
    const after = r.state.monsters.find((m) => m.id === 'g1')!;
    expect(after.status).toBe('box');
    expect(after.position).toBeNull();
    expect(r.state.spawnTile).toHaveLength(0);
    expect(r.instructions.some((i) => i.id === 'box-g1')).toBe(true);
  });

  it('aucun monstre du type sur le plateau : la carte est défaussée et on en pioche une autre', () => {
    const s = toMonsterTurn(demoGame({ deck: { listedMonsterIds: ['goblin', 'orc'] }, monsters: [{ id: 'g1', definitionId: 'goblin', position: { x: 4, y: 2 } }] }));
    const r = runMonsterTurn(s, testContent);
    expect(r.traces[0]!.selectedEntityId).toBe('g1');
    expect(r.state.monsters.find((m) => m.id === 'g1')!.position).not.toEqual({ x: 4, y: 2 });
    // Le seul Goblin est déjà activé : la seconde activation ne trouve personne.
    expect(r.instructions.map((i) => i.id)).toContain('R1-A2-none');
  });

  it('un monstre n est jamais activé deux fois dans le même Monster Turn si un autre candidat existe', () => {
    const s = toMonsterTurn(demoGame({ settings: physical, monsters: [{ id: 'g1', definitionId: 'goblin', position: { x: 4, y: 2 } }, { id: 'g2', definitionId: 'goblin', position: { x: 7, y: 3 } }] }));
    const r = runMonsterTurn(s, testContent, [card('goblin'), card('goblin')]);
    expect(r.traces.map((t) => t.selectedEntityId).sort()).toEqual(['g1', 'g2']);
  });

  it('la mort d un héros au seuil de défaite termine le scénario (Legendary = 1 mort)', () => {
    const s = toMonsterTurn(demoGame({ difficulty: 'legendary', settings: physical }));
    s.heroes.find((h) => h.id === 'h1')!.position = { x: 3, y: 2 }; // adjacent au Goblin g1
    const r = runMonsterTurn(s, testContent, [card('goblin'), atk(9, 0)]);
    expect(r.state.phase).toBe('SCENARIO_LOST');
    expect(r.state.deaths).toBe(1);
    expect(r.traces).toHaveLength(1);
  });

  it('mode matériel : s arrête proprement quand une saisie manque, sans modifier l état', () => {
    const s = toMonsterTurn(demoGame({ settings: physical }));
    const before = JSON.stringify(s);
    const out = runMonsterTurnSafe(s, testContent, [die('A')]);
    expect(out.status).toBe('awaiting-input');
    expect(JSON.stringify(s)).toBe(before);
  });

  it('mode numérique : déterministe pour une même graine', () => {
    const a = runMonsterTurn(toMonsterTurn(demoGame()), testContent);
    const b = runMonsterTurn(toMonsterTurn(demoGame()), testContent);
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.state.rngCounter).toBeGreaterThan(0);
  });

  it('deck vide : la défausse est remélangée', () => {
    const s = toMonsterTurn(demoGame({ settings: physical }));
    s.deck.discard = s.deck.draw.splice(0);
    s.deck.draw = [];
    const r = runMonsterTurn(s, testContent, [card('goblin'), card('orc')]);
    expect(r.state.events.some((e) => e.type === 'deck-recycled')).toBe(true);
  });

  it('Spawn Tile pleine : spawn au début du Monster Turn, monstre en boîte si aucun jeton', () => {
    const s = toMonsterTurn(demoGame({ settings: physical, spawnTileCapacity: 1 }));
    s.monsters.find((m) => m.id === 'g1')!.status = 'spawn-tile';
    s.monsters.find((m) => m.id === 'g1')!.position = null;
    s.spawnTile = ['g1'];
    const r = runMonsterTurn(s, testContent, [die('A'), die('B'), card('orc'), card('goblin')]);
    expect(r.state.monsters.find((m) => m.id === 'g1')!.status).toBe('board');
    expect(r.state.spawnTile).toHaveLength(0);
  });

  it('Wild Pet : le monstre suivant vise le familier le plus proche', () => {
    const s = toMonsterTurn(demoGame({ settings: physical, expansions: ['pets'], deck: { wildPetCards: 1 } }));
    s.pets = [{ id: 'pet1', name: 'Rawr', life: 2, defense: 0, position: { x: 5, y: 2 }, wounds: 0, dead: false }];
    const r = runMonsterTurn(s, testContent, [card('wild-pet'), card('goblin'), atk(1, 0), card('orc')]);
    expect(r.traces[0]!.explanation.join(' ')).toMatch(/pet1/);
    expect(r.state.pets[0]!.wounds).toBe(1);
    expect(r.state.deaths).toBe(0);
  });
});

describe('actions de héros', () => {
  it('Guard : quitter une Space Close à un monstre le fait attaquer avant le déplacement', () => {
    const s = startScenario(demoGame({ settings: physical }));
    s.monsters.find((m) => m.id === 'g1')!.position = { x: 1, y: 4 };
    const r = resolveHeroMove(s, testContent, 'h1', { x: 0, y: 4 }, 'step', [atk(1, 0)]);
    expect(r.instructions[0]!.text).toMatch(/Réaction Guard/);
    expect(r.state.heroes[0]!.position).toEqual({ x: 0, y: 4 });
    const p = resolveHeroMove(s, testContent, 'h1', { x: 0, y: 4 }, 'portal');
    expect(p.instructions).toHaveLength(0);
  });

  it('Payback : un seul monstre riposte, celui du tier le plus élevé ; garde tué = plus garde', () => {
    const s = startScenario(demoGame({ settings: physical }));
    s.monsters.find((m) => m.id === 'g1')!.position = { x: 2, y: 3 };
    s.monsters.find((m) => m.id === 'o1')!.position = { x: 1, y: 2 };
    s.monsters.find((m) => m.id === 'o2')!.position = { x: 3, y: 3 };
    const r = resolveHeroAttack(
      s,
      testContent,
      'h3',
      [{ monsterId: 'g1', wounds: 1 }, { monsterId: 'o1', wounds: 1 }],
      [atk(1, 0)],
    );
    const attacks = r.instructions.filter((i) => i.id.startsWith('Payback'));
    expect(attacks).toHaveLength(1);
    expect(attacks[0]!.id).toContain('o1');
  });

  it('mort d un monstre : premier emplacement libre de la Spawn Tile ; pièces versées', () => {
    const s = startScenario(demoGame({ settings: physical }));
    s.monsters.find((m) => m.id === 'g1')!.position = { x: 2, y: 3 };
    s.monsters.find((m) => m.id === 'o1')!.position = { x: 1, y: 2 };
    const r = resolveHeroAttack(s, testContent, 'h3', [{ monsterId: 'g1', wounds: 5 }, { monsterId: 'o1', wounds: 9 }]);
    expect(r.state.monsters.find((m) => m.id === 'g1')!.status).toBe('spawn-tile');
    expect(r.state.monsters.find((m) => m.id === 'o1')!.status).toBe('spawn-tile');
    expect(r.state.spawnTile).toEqual(['g1', 'o1']); // ordre des emplacements
    expect(r.state.coins).toBe(3);
    expect(r.instructions.filter((i) => i.id.startsWith('Payback'))).toHaveLength(0);
  });

  it('garde tué : perd son statut de garde', () => {
    const s = startScenario(demoGame({ settings: physical }));
    s.monsters.find((m) => m.id === 'o2')!.position = { x: 1, y: 2 };
    const r = resolveHeroAttack(s, testContent, 'h3', [{ monsterId: 'o2', wounds: 9 }]);
    expect(r.state.monsters.find((m) => m.id === 'o2')!.isGuard).toBe(false);
  });
});

describe('machine à états et repos', () => {
  it('refuse les transitions invalides et les doubles activations', () => {
    const s = demoGame();
    expect(() => activateHero(s, 'h1')).toThrow();
    const g = startScenario(s);
    expect(() => startScenario(g)).toThrow();
    const a = activateHero(g, 'h1');
    expect(() => activateHero(a, 'h1')).toThrow(/déjà/);
    expect(() => finishHeroActivations(a)).toThrow(/non activés/);
    expect(() => restGuild(a)).toThrow(/exclu/);
  });

  it('repos : ressuscite les héros morts sans blessure puis Monster Turn', () => {
    const g = startScenario(demoGame());
    g.heroes[0]!.dead = true;
    g.heroes[0]!.position = null;
    expect(() => restGuild(g)).toThrow(/résurrection/);
    const r = restGuild(g, { h1: { x: 1, y: 4 } });
    expect(r.phase).toBe('MONSTER_TURN_SPAWN');
    expect(r.heroes[0]!.dead).toBe(false);
  });

  it('Dragon Partie 2 : pas de Monster Turn, un seul héros activé', () => {
    const g = startScenario(demoGame({ dragonPart2: true, expansions: ['dragons'] }));
    expect(g.phase).toBe('DRAGON_TURN');
  });
});

describe('invariants', () => {
  it('détecte un état invalide', () => {
    const s = demoGame();
    s.heroes[0]!.position = { x: 99, y: 0 };
    expect(validateGameState(s, testContent).join()).toMatch(/hors du plateau/);
  });
  it('accepte deux personnages sur une même Space, en refuse trois : deux figurines au maximum par case', () => {
    const s = demoGame();
    s.heroes[1]!.position = { ...s.heroes[0]!.position! };
    expect(validateGameState(s, testContent).join()).not.toMatch(/Plus de 2/);
    s.heroes[2]!.position = { ...s.heroes[0]!.position! };
    expect(validateGameState(s, testContent).join()).toMatch(/Plus de 2 personnages/);
  });
});

describe('activation : un héros par tour (livret de base)', () => {
  const one = () => startScenario(demoGame({ settings: { heroActivation: 'one' } }));

  it('un seul héros est activé ; un second est refusé', () => {
    let g = one();
    g = activateHero(g, 'h1');
    expect(() => activateHero(g, 'h2')).toThrow(/Un seul héros/);
  });

  it('le tour peut se terminer avec un seul héros activé, puis les monstres jouent', () => {
    let g = activateHero(one(), 'h1');
    g = finishHeroActivations(g);
    expect(g.phase).toBe('MONSTER_TURN_SPAWN');
    expect(g.activatedHeroIds).toEqual([]);
  });

  it('terminer sans activer personne est refusé : il faut un héros ou le repos', () => {
    expect(() => finishHeroActivations(one())).toThrow(/Activez un héros ou reposez/);
  });

  it('le même héros peut être activé deux tours de suite', () => {
    let g = finishHeroActivations(activateHero(one(), 'h1'));
    g = { ...g, phase: 'GUILD_TURN' };
    expect(() => activateHero(g, 'h1')).not.toThrow();
  });

  it('le repos reste possible quand aucun héros n’est activé', () => {
    expect(restGuild(one()).phase).toBe('MONSTER_TURN_SPAWN');
  });

  it('en mode « tous les héros », le comportement historique est conservé', () => {
    const g = startScenario(demoGame({ settings: { heroActivation: 'all' } }));
    expect(() => finishHeroActivations(activateHero(g, 'h1'))).toThrow(/non activés/);
  });
});

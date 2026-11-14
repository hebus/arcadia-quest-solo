import { describe, expect, it } from 'vitest';
import { runMonsterTurn } from '../activation/monsterTurn';
import type { PhysicalInstruction } from '../activation/monsterTurn';
import { createOracle } from '../oracle';
import { CountingRandom } from '../random';
import { black, oracleFor, scripted, skillContent, skillGame, tryRun, white } from '@/tests/fixtures/skillGame';
import { monsterAttacksHero } from './heroActions';
import { monsterStrike } from './monsterAttack';

/** Troll en (4,2) ; h1 en (3,2) et h2 en (5,2) lui sont adjacents, h3 est loin. */
const world = (monster = 'troll', over: Parameters<typeof skillGame>[1] = {}) =>
  skillGame([{ id: 'T1', definitionId: monster, position: { x: 4, y: 2 } }], { heroes: [{ x: 3, y: 2 }, { x: 5, y: 2 }, { x: 0, y: 0 }], ...over });
const strike = (s: ReturnType<typeof world>, rng = scripted([]), answers: Parameters<typeof oracleFor>[2] = []) =>
  monsterStrike(s, skillContent, oracleFor(s, rng, answers), 'T1', 'h1', { purpose: 't', cause: 't' });

describe('Troll : une attaque cible tous les héros adjacents', () => {
  it('un seul jet d’attaque : chaque héros adjacent subit les mêmes touches (la cible principale d’abord)', () => {
    const rng = scripted(black('sword', 'sword', 'blank', 'sword'));
    const results = strike(world(), rng);
    expect(results.map((r) => r.targetId)).toEqual(['h1', 'h2']); // pas h3, loin
    expect(results.map((r) => r.outcome.hits)).toEqual([3, 3]);
    expect(results.map((r) => r.outcome.attackFaces)).toEqual([['sword', 'sword', 'blank', 'sword'], ['sword', 'sword', 'blank', 'sword']]);
    expect(rng.rolled()).toBe(4); // les 4 dés d'attaque, lancés une seule fois (héros sans dé de défense)
  });

  it('chaque héros se défend séparément contre les mêmes touches', () => {
    const s = world('troll');
    s.heroes[0]!.defense = 1;
    s.heroes[1]!.defense = 2;
    // Attaque : 3 touches. Défense de Grom : 1 bouclier ; défense de Maya : bouclier, bouclier.
    const rng = scripted([...black('sword', 'sword', 'sword', 'blank'), ...white('shield'), ...white('shield', 'shield')]);
    const [grom, maya] = strike(s, rng);
    expect(grom!.outcome).toMatchObject({ hits: 3, saves: 1, wounds: 2 });
    expect(maya!.outcome).toMatchObject({ hits: 3, saves: 2, wounds: 1 });
    expect(s.heroes.map((h) => h.wounds)).toEqual([2, 1, 0]);
  });

  it('un héros adjacent peut mourir sans empêcher les autres d’être touchés ; un héros mort n’est pas ciblé', () => {
    const s = world();
    const [first] = [strike(s, scripted(black('sword', 'sword', 'sword', 'sword')))];
    expect(first!.map((r) => [r.targetId, r.died])).toEqual([['h1', true], ['h2', true]]); // 4 touches ≥ 3 vies
    const again = world();
    again.heroes[1]!.dead = true;
    again.heroes[1]!.position = null;
    expect(strike(again, scripted(black('sword', 'blank', 'blank', 'blank'))).map((r) => r.targetId)).toEqual(['h1']);
  });

  it('sans autre héros adjacent, c’est une attaque ordinaire (une seule cible)', () => {
    const s = world('troll', { heroes: [{ x: 3, y: 2 }, { x: 0, y: 4 }, { x: 0, y: 0 }] });
    const results = strike(s, scripted(black('sword', 'sword', 'sword', 'sword')));
    expect(results).toHaveLength(1);
    expect(results[0]!.targetId).toBe('h1');
  });

  it('un héros séparé par un mur n’est pas adjacent', () => {
    const s = world();
    s.board.walls = [[{ x: 4, y: 2 }, { x: 5, y: 2 }]];
    expect(strike(s, scripted(black('sword', 'blank', 'blank', 'blank'))).map((r) => r.targetId)).toEqual(['h1']);
  });

  it('un monstre ordinaire n’attaque que sa cible', () => {
    expect(strike(world('plain'), scripted(black('sword', 'sword', 'sword'))).map((r) => r.targetId)).toEqual(['h1']);
  });

  it('une cible principale qui ne serait pas Close est quand même attaquée (tir à distance, riposte)', () => {
    const s = skillGame([{ id: 'T1', definitionId: 'troll', position: { x: 4, y: 2 } }], { heroes: [{ x: 0, y: 2 }, { x: 5, y: 2 }, { x: 0, y: 0 }] });
    expect(strike(s, scripted(black('sword', 'blank', 'blank', 'blank'))).map((r) => r.targetId)).toEqual(['h1', 'h2']);
  });

  it('dés matériels : la saisie du jet d’attaque, puis la défense de chaque autre héros', () => {
    const s = world('troll', { settings: { diceMode: 'physical' } });
    s.heroes[1]!.defense = 2;
    const rng = scripted([]);
    const ask = (answers: Parameters<typeof oracleFor>[2]) => tryRun(() => strike(s, rng, answers));
    const a = ask([]);
    expect('need' in a && a.need).toMatchObject({ kind: 'attack-result', targetId: 'h1' });
    const b = ask([{ kind: 'attack-result', hits: 3, saves: 1 }]);
    expect('need' in b && b.need).toMatchObject({ kind: 'defense-result', hits: 3, targetId: 'h2', defenseDice: 2 });
    const c = ask([{ kind: 'attack-result', hits: 3, saves: 1 }, { kind: 'defense-result', saves: 2 }]);
    expect('result' in c && c.result.map((r) => [r.targetId, r.outcome.hits, r.outcome.saves, r.outcome.wounds])).toEqual([['h1', 3, 1, 2], ['h2', 3, 2, 1]]);
  });

  it('défense lancée par le joueur : une demande par héros ciblé, avec les mêmes touches', () => {
    const s = world('troll', { settings: { defenseRoll: 'physical' } });
    s.heroes[0]!.defense = 1;
    s.heroes[1]!.defense = 1;
    const answer = (answers: Parameters<typeof oracleFor>[2]) => tryRun(() => strike(s, scripted(black('sword', 'sword', 'blank', 'blank')), answers));
    const first = answer([]);
    expect('need' in first && first.need).toMatchObject({ kind: 'defense-result', hits: 2, targetName: 'Grom' });
    const second = answer([{ kind: 'defense-result', saves: 1 }]);
    expect('need' in second && second.need).toMatchObject({ kind: 'defense-result', hits: 2, targetName: 'Maya' });
    const done = answer([{ kind: 'defense-result', saves: 1 }, { kind: 'defense-result', saves: 0 }]);
    expect('result' in done && done.result.map((r) => r.outcome.wounds)).toEqual([1, 2]);
  });

  it('une attaque sans touche ne demande aucune défense', () => {
    const s = world('troll', { settings: { defenseRoll: 'physical' } });
    s.heroes[0]!.defense = 1;
    const results = strike(s, scripted(black('blank', 'blank', 'blank', 'blank')));
    expect(results.map((r) => r.outcome.wounds)).toEqual([0, 0]);
  });
});

describe('Troll : étapes affichées', () => {
  const ids = (out: PhysicalInstruction[]) => out.map((i) => i.id);
  const run = (monster: string) => {
    const s = world(monster);
    const rng = new CountingRandom(1);
    const out: PhysicalInstruction[] = [];
    monsterAttacksHero(s, skillContent, createOracle(s, skillContent, rng, []), 'T1', 'h1', 'Payback', out);
    return out;
  };

  it('plusieurs cibles : une étape d’attaque par héros, suffixée de son identifiant', () => {
    expect(ids(run('troll')).filter((i) => i.startsWith('Payback-T1'))).toEqual(['Payback-T1-h1', 'Payback-T1-h2']);
  });

  it('une seule cible : l’identifiant habituel, sans suffixe', () => {
    expect(ids(run('plain')).filter((i) => i.startsWith('Payback-T1'))).toEqual(['Payback-T1']);
  });
});

describe('Troll : attaque pendant son activation', () => {
  it('le Monster Turn l’attaque une fois et frappe tous les héros adjacents', () => {
    // Troll collé à Grom et à Maya ; dés numériques : 4 dés d'attaque, un seul jet pour les deux héros.
    const s = world('troll', { heroes: [{ x: 3, y: 2 }, { x: 5, y: 2 }, { x: 0, y: 0 }] });
    const ready = { ...s, phase: 'MONSTER_TURN_SPAWN' as const, deck: { ...s.deck, draw: [{ id: 'troll:2-3', kind: 'monster' as const, monsterDefId: 'troll' }, { id: 'troll:4-5', kind: 'monster' as const, monsterDefId: 'troll' }], discard: [] } };
    const r = runMonsterTurn(ready, skillContent);
    // Les dés de référence sont numériques (graine fixe) : une activation, au moins, tombe sur un jeton Spawn et attaque.
    const attacks = r.instructions.filter((i) => i.kind === 'attack').map((i) => i.id);
    const tag = attacks[0]!.replace(/-attack-h\d$/, '');
    expect(attacks).toContain(`${tag}-attack-h1`);
    expect(attacks).toContain(`${tag}-attack-h2`);
    expect(attacks.some((id) => id.endsWith('-h3'))).toBe(false);
    const grom = r.instructions.find((i) => i.id === `${tag}-attack-h1`)!.text;
    const maya = r.instructions.find((i) => i.id === `${tag}-attack-h2`)!.text;
    // Mêmes touches pour les deux (un seul jet) : « N coup(s) » identique.
    expect(grom.match(/(\d+) coup/)![1]).toBe(maya.match(/(\d+) coup/)![1]);
  });
});

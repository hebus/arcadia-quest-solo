import { describe, expect, it } from 'vitest';
import { applyCorrection } from '../corrections';
import { createOracle } from '../oracle';
import { CountingRandom } from '../random';
import { restGuild } from '../turn/machine';
import type { PhysicalInstruction } from '../activation/monsterTurn';
import { black, oracleFor, scripted, skillContent, skillGame, white } from '@/tests/fixtures/skillGame';
import { monsterAttacksHero } from './heroActions';
import { monsterStrike } from './monsterAttack';

/** Hammer Beastman en (2,3) contre Grom en (2,4). */
const world = (monster = 'hammer', defense = 0) => skillGame([{ id: 'H1', definitionId: monster, position: { x: 2, y: 3 } }], { heroes: [{ x: 2, y: 4 }, { x: 0, y: 0 }, { x: 7, y: 0 }], defense });
const strike = (s: ReturnType<typeof world>, rng: ReturnType<typeof scripted>) => monsterStrike(s, skillContent, oracleFor(s, rng), 'H1', 'h1', { purpose: 't', cause: 't' })[0]!;

describe('Hammer Beastman : si au moins une blessure passe, le héros est étourdi', () => {
  it('une blessure suffit', () => {
    const s = world();
    const r = strike(s, scripted(black('sword', 'blank', 'blank', 'blank')));
    expect(r.outcome.wounds).toBe(1);
    expect(r.stunned).toBe(true);
    expect(s.heroes[0]!.stunned).toBe(true);
    expect(s.events.some((e) => e.type === 'hero-stunned')).toBe(true);
  });

  it('aucune touche : pas d’étourdissement', () => {
    const s = world();
    const r = strike(s, scripted(black('blank', 'blank', 'blank', 'blank')));
    expect(r.stunned).toBe(false);
    expect(s.heroes[0]!.stunned).toBeUndefined();
  });

  it('toutes les touches parées : aucune blessure, pas d’étourdissement', () => {
    const s = world('hammer', 2);
    const r = strike(s, scripted([...black('sword', 'sword', 'blank', 'blank'), ...white('shield', 'shield')]));
    expect(r.outcome).toMatchObject({ hits: 2, saves: 2, wounds: 0 });
    expect(r.stunned).toBe(false);
    expect(s.heroes[0]!.stunned).toBeUndefined();
  });

  it('une blessure qui passe malgré la défense étourdit', () => {
    const s = world('hammer', 1);
    const r = strike(s, scripted([...black('sword', 'sword', 'blank', 'blank'), ...white('shield')]));
    expect(r.outcome.wounds).toBe(1);
    expect(r.stunned).toBe(true);
  });

  it('un héros qui meurt de l’attaque n’est pas étourdi', () => {
    const s = world();
    const r = strike(s, scripted(black('sword', 'sword', 'sword', 'sword')));
    expect(r.died).toBe(true);
    expect(r.stunned).toBe(false);
    expect(s.heroes[0]!.stunned).toBeUndefined();
  });

  it('un monstre sans la compétence n’étourdit pas', () => {
    const s = world('plain');
    const r = strike(s, scripted(black('sword', 'sword', 'blank', 'blank')));
    expect(r.outcome.wounds).toBe(2);
    expect(r.stunned).toBe(false);
    expect(s.heroes[0]!.stunned).toBeUndefined();
  });

  it('un héros déjà étourdi le reste', () => {
    const s = world();
    s.heroes[0]!.stunned = true;
    strike(s, scripted(black('blank', 'blank', 'blank', 'blank')));
    expect(s.heroes[0]!.stunned).toBe(true);
  });

  it('l’étape sur la table demande de poser un jeton Étourdi (réaction Guard comme Payback)', () => {
    const s = world();
    const out: PhysicalInstruction[] = [];
    // Un jet numérique qui touche au moins une fois : on essaie des graines jusqu'à une blessure.
    for (let seed = 1; seed < 50 && !s.heroes[0]!.stunned; seed++) {
      monsterAttacksHero(s, skillContent, createOracle(s, skillContent, new CountingRandom(seed), []), 'H1', 'h1', 'Réaction Guard', out);
    }
    expect(s.heroes[0]!.stunned).toBe(true);
    const stun = out.find((i) => i.id === 'Réaction Guard-h1-stun')!;
    expect(stun.text).toBe('Grom est étourdi : poser un jeton Étourdi.');
    expect(stun.actorId).toBe('h1');
    expect(out.find((i) => i.id === 'Réaction Guard-H1')).toBeDefined(); // l'attaque est montrée avant
  });

  it('la mort du héros, puis son repos, retirent l’étourdissement', () => {
    const s = world();
    s.heroes[0]!.stunned = true;
    const dead = applyCorrection(s, { kind: 'hero-dead', heroId: 'h1', dead: true });
    expect(dead.heroes[0]!.stunned).toBeUndefined();
    // Résurrection au repos : le héros revient sans jeton Étourdi.
    const stunned = { ...s, heroes: s.heroes.map((h, i) => (i === 0 ? { ...h, stunned: true, dead: true, position: null } : h)) };
    expect(restGuild(stunned, { h1: { x: 3, y: 3 } }).heroes[0]!.stunned).toBeUndefined();
    // Résurrection corrigée à la main.
    const back = applyCorrection({ ...stunned }, { kind: 'hero-dead', heroId: 'h1', dead: false, at: { x: 3, y: 3 } });
    expect(back.heroes[0]!.stunned).toBeUndefined();
  });

  it('correction manuelle : étourdi ou non ; impossible sur un héros mort', () => {
    const s = world();
    const on = applyCorrection(s, { kind: 'hero-stunned', heroId: 'h1', stunned: true });
    expect(on.heroes[0]!.stunned).toBe(true);
    expect(applyCorrection(on, { kind: 'hero-stunned', heroId: 'h1', stunned: false }).heroes[0]!.stunned).toBeUndefined();
    const dead = applyCorrection(s, { kind: 'hero-dead', heroId: 'h2', dead: true });
    expect(() => applyCorrection(dead, { kind: 'hero-stunned', heroId: 'h2', stunned: true })).toThrow(/mort/);
    expect(() => applyCorrection(s, { kind: 'hero-stunned', heroId: 'inconnu', stunned: true })).toThrow(/inconnu/);
  });
});

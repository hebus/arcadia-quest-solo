import { describe, expect, it } from 'vitest';
import { black, oracleFor, scripted, skillContent, skillGame, tryRun, white } from '@/tests/fixtures/skillGame';
import { monsterStrike } from './monsterAttack';

const strike = (monster: string, answers: Parameters<typeof oracleFor>[2] = [], rng = scripted([]), settings = {}, defense = 0) => {
  const s = skillGame([{ id: 'M1', definitionId: monster, position: { x: 2, y: 3 } }], { heroes: [{ x: 2, y: 4 }, { x: 0, y: 0 }, { x: 7, y: 0 }], defense, settings });
  return { s, run: () => monsterStrike(s, skillContent, oracleFor(s, rng, answers), 'M1', 'h1', { purpose: 't', cause: 't' }), rng };
};

describe('Minotaur : chaque critique donne une blessure supplémentaire', () => {
  it('dés numériques : une blessure de plus par critique (et le critique ajoute un dé, règle habituelle)', () => {
    // 4 dés : épée, critique (+1 dé : un arc, raté en mêlée), épée, vide → touches : épée + critique + épée = 3 ; 1 critique.
    const { s, run } = strike('mino', [], scripted(black('sword', 'crit', 'bow', 'sword', 'blank')));
    const [r] = run();
    expect(r!.outcome).toMatchObject({ hits: 3, crits: 1, extraWounds: 1 });
    expect(r!.outcome.attackFaces).toHaveLength(5); // 4 dés + celui du critique
    expect(r!.outcome.wounds).toBe(3 + 1);
    expect(s.heroes[0]!.wounds).toBe(4); // 4 blessures sur un héros à 3 vies : il tombe
    expect(r!.died).toBe(true);
  });

  it('chaque critique compte : deux critiques, deux blessures en plus', () => {
    const { run } = strike('mino', [], scripted(black('crit', 'blank', 'crit', 'blank', 'blank', 'blank')));
    const [r] = run();
    expect(r!.outcome.crits).toBe(2);
    expect(r!.outcome.extraWounds).toBe(2);
    expect(r!.outcome.wounds).toBe(r!.outcome.hits + 2); // sans défense
  });

  it('les blessures supplémentaires ne se parent pas : la défense n’enlève que des touches', () => {
    // Attaque : critique, vide, vide, vide (+ 1 dé du critique : vide) → 1 touche (le critique), 1 critique. Défense : 1 bouclier.
    const rng = scripted([...black('crit', 'blank', 'blank', 'blank', 'blank'), ...white('shield')]);
    const { run } = strike('mino', [], rng, {}, 1);
    const [r] = run();
    expect(r!.outcome).toMatchObject({ hits: 1, saves: 1, crits: 1, extraWounds: 1 });
    expect(r!.outcome.wounds).toBe(0 + 1); // la touche est parée, la blessure de critique passe
  });

  it('sans critique, aucune blessure en plus ; sans touche, aucune blessure', () => {
    const none = strike('mino', [], scripted(black('sword', 'sword', 'blank', 'blank'))).run()[0]!;
    expect(none.outcome).toMatchObject({ hits: 2, crits: 0, extraWounds: 0, wounds: 2 });
    const miss = strike('mino', [], scripted(black('blank', 'blank', 'blank', 'blank'))).run()[0]!;
    expect(miss.outcome).toMatchObject({ hits: 0, wounds: 0, extraWounds: 0 });
  });

  it('un monstre sans la compétence ignore ses critiques', () => {
    const { run } = strike('plain', [], scripted(black('crit', 'blank', 'blank', 'blank')));
    const [r] = run();
    expect(r!.outcome.crits).toBe(1);
    expect(r!.outcome.extraWounds).toBe(0);
    expect(r!.outcome.wounds).toBe(r!.outcome.hits);
  });

  it('défense lancée par le joueur : la saisie annonce les blessures supplémentaires et ne les déduit pas', () => {
    const rng = scripted(black('crit', 'sword', 'blank', 'blank', 'blank')); // 2 touches (critique + épée), 1 critique
    const first = tryRun(strike('mino', [], rng, { defenseRoll: 'physical' }, 2).run);
    expect('need' in first && first.need).toMatchObject({ kind: 'defense-result', hits: 2, extraWounds: 1, defenseDice: 2 });
    const done = strike('mino', [{ kind: 'defense-result', saves: 2 }], scripted(black('crit', 'sword', 'blank', 'blank', 'blank')), { defenseRoll: 'physical' }, 2).run()[0]!;
    expect(done.outcome.saves).toBe(2);
    expect(done.outcome.wounds).toBe(0 + 1);
    // Les parades en trop ne servent à rien : on ne pare pas plus de touches qu'il n'y en a.
    const over = strike('mino', [{ kind: 'defense-result', saves: 9 }], scripted(black('crit', 'sword', 'blank', 'blank', 'blank')), { defenseRoll: 'physical' }, 2).run()[0]!;
    expect(over.outcome.saves).toBe(2);
  });

  it('dés matériels : la saisie demande les critiques, bornés par les touches', () => {
    const need = tryRun(strike('mino', [], scripted([]), { diceMode: 'physical' }).run);
    expect('need' in need && need.need).toMatchObject({ kind: 'attack-result', critWounds: true });
    const ok = strike('mino', [{ kind: 'attack-result', hits: 3, saves: 1, crits: 2 }], scripted([]), { diceMode: 'physical' }).run()[0]!;
    expect(ok.outcome).toMatchObject({ hits: 3, saves: 1, crits: 2, extraWounds: 2, wounds: 2 + 2 });
    const clamp = strike('mino', [{ kind: 'attack-result', hits: 1, saves: 0, crits: 5 }], scripted([]), { diceMode: 'physical' }).run()[0]!;
    expect(clamp.outcome.crits).toBe(1);
    const missing = strike('mino', [{ kind: 'attack-result', hits: 2, saves: 0 }], scripted([]), { diceMode: 'physical' }).run()[0]!;
    expect(missing.outcome.wounds).toBe(2); // critiques non saisis : aucune blessure en plus
  });

  it('dés matériels, monstre ordinaire : pas de compteur de critiques demandé', () => {
    const need = tryRun(strike('plain', [], scripted([]), { diceMode: 'physical' }).run);
    expect('need' in need && need.need).not.toHaveProperty('critWounds');
  });
});

import { describe, expect, it } from 'vitest';
import { black, oracleFor, scripted, skillContent, skillGame } from '@/tests/fixtures/skillGame';
import { monsterStrike } from './monsterAttack';

const hits = (monster: string, faces: string[]) => {
  const s = skillGame([{ id: 'C1', definitionId: monster, position: { x: 2, y: 3 } }], { heroes: [{ x: 2, y: 4 }, { x: 0, y: 0 }, { x: 7, y: 0 }] });
  const [r] = monsterStrike(s, skillContent, oracleFor(s, scripted(black(...faces))), 'C1', 'h1', { purpose: 't', cause: 't' });
  return r!.outcome.hits;
};

describe('Orc Captain : 1 relance de l’attaque', () => {
  it('la relance remplace un dé raté : un seul', () => {
    // 3 dés ratés ; la relance remplace le premier raté par une épée → 1 touche (pas 3 : une seule relance).
    expect(hits('captain', ['blank', 'blank', 'blank', 'sword'])).toBe(1);
  });

  it('sans dé raté, la relance n’est pas utilisée', () => {
    expect(hits('captain', ['sword', 'sword', 'sword', 'blank'])).toBe(3);
  });

  it('un monstre sans relance garde ses dés ratés', () => {
    expect(hits('plain', ['blank', 'blank', 'blank', 'sword'])).toBe(0);
  });

  it('un critique obtenu à la relance ajoute un dé, comme d’habitude', () => {
    // Relance : critique (touche) puis dé supplémentaire : épée → 2 touches.
    expect(hits('captain', ['blank', 'blank', 'blank', 'crit', 'sword'])).toBe(2);
  });
});

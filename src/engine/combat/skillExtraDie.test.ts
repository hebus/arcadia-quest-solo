import { describe, expect, it } from 'vitest';
import { black, oracleFor, scripted, skillContent, skillGame } from '@/tests/fixtures/skillGame';
import { monsterStrike } from './monsterAttack';

/** Spear Beastman (3 dés d'arc) en (3,2), cible Grom en (6,2) ; un éventuel voisin est placé par le test. */
const dice = (monsters: { id: string; definitionId: string; position: { x: number; y: number } }[], definitionId = 'spear') => {
  const s = skillGame([{ id: 'S1', definitionId, position: { x: 3, y: 2 } }, ...monsters], { heroes: [{ x: 6, y: 2 }, { x: 0, y: 4 }, { x: 0, y: 0 }] });
  const rng = scripted(black('bow', 'bow', 'bow', 'bow', 'bow', 'bow'));
  const [r] = monsterStrike(s, skillContent, oracleFor(s, rng), 'S1', 'h1', { purpose: 't', cause: 't' });
  return r!.outcome.attackFaces.length; // dés lancés
};

describe('Spear Beastman : un dé de plus s’il est adjacent à un autre monstre', () => {
  it('seul : ses 3 dés', () => {
    expect(dice([])).toBe(3);
  });

  it('un autre monstre sur une Space voisine : 4 dés', () => {
    expect(dice([{ id: 'P1', definitionId: 'plain', position: { x: 4, y: 2 } }])).toBe(4);
    expect(dice([{ id: 'P1', definitionId: 'plain', position: { x: 3, y: 1 } }])).toBe(4);
  });

  it('un monstre sur la même Space compte aussi', () => {
    expect(dice([{ id: 'P1', definitionId: 'plain', position: { x: 3, y: 2 } }])).toBe(4);
  });

  it('un monstre en diagonale ou à deux cases n’est pas adjacent', () => {
    expect(dice([{ id: 'P1', definitionId: 'plain', position: { x: 4, y: 3 } }])).toBe(3);
    expect(dice([{ id: 'P1', definitionId: 'plain', position: { x: 5, y: 2 } }])).toBe(3);
  });

  it('un mur entre les deux : pas adjacent (il faut que la Space soit Close)', () => {
    const s = skillGame([{ id: 'S1', definitionId: 'spear', position: { x: 3, y: 2 } }, { id: 'P1', definitionId: 'plain', position: { x: 4, y: 2 } }], { heroes: [{ x: 6, y: 2 }, { x: 0, y: 4 }, { x: 0, y: 0 }] });
    s.board.walls = [[{ x: 3, y: 2 }, { x: 4, y: 2 }]];
    const [r] = monsterStrike(s, skillContent, oracleFor(s, scripted(black('bow', 'bow', 'bow', 'bow'))), 'S1', 'h1', { purpose: 't', cause: 't' });
    expect(r!.outcome.attackFaces).toHaveLength(3);
  });

  it('un monstre qui n’est plus sur le plateau (Spawn Tile, boîte) ne compte pas', () => {
    const s = skillGame([{ id: 'S1', definitionId: 'spear', position: { x: 3, y: 2 } }, { id: 'P1', definitionId: 'plain', position: { x: 4, y: 2 } }], { heroes: [{ x: 6, y: 2 }, { x: 0, y: 4 }, { x: 0, y: 0 }] });
    s.monsters[1]!.status = 'spawn-tile';
    s.monsters[1]!.position = null;
    const [r] = monsterStrike(s, skillContent, oracleFor(s, scripted(black('bow', 'bow', 'bow', 'bow'))), 'S1', 'h1', { purpose: 't', cause: 't' });
    expect(r!.outcome.attackFaces).toHaveLength(3);
  });

  it('un autre Spear Beastman voisin lui donne aussi le dé de plus (et réciproquement)', () => {
    expect(dice([{ id: 'S2', definitionId: 'spear', position: { x: 4, y: 2 } }])).toBe(4);
  });

  it('un monstre sans la compétence ne lance pas de dé de plus, même entouré', () => {
    expect(dice([{ id: 'P1', definitionId: 'plain', position: { x: 4, y: 2 } }], 'plain')).toBe(3);
  });

  it('les touches comptent le dé de plus : 4 arcs touchent 4 fois', () => {
    const s = skillGame([{ id: 'S1', definitionId: 'spear', position: { x: 3, y: 2 } }, { id: 'P1', definitionId: 'plain', position: { x: 4, y: 2 } }], { heroes: [{ x: 6, y: 2 }, { x: 0, y: 4 }, { x: 0, y: 0 }] });
    const [r] = monsterStrike(s, skillContent, oracleFor(s, scripted(black('bow', 'bow', 'bow', 'bow'))), 'S1', 'h1', { purpose: 't', cause: 't' });
    expect(r!.outcome.hits).toBe(4);
  });
});

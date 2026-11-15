import { describe, expect, it } from 'vitest';
import { runMonsterTurn, runMonsterTurnSafe } from './activation/monsterTurn';
import { testContent } from '@/tests/fixtures/demo';
import { attackTurn } from '@/tests/fixtures/monsterTurn';

describe('Monster Turn : étapes déjà décidées avant une saisie', () => {
  it('sur une saisie de défense, partial contient dans l’ordre activation, déplacement', () => {
    const out = runMonsterTurnSafe(attackTurn(), testContent);
    if (out.status !== 'awaiting-input') throw new Error(`saisie attendue, reçu ${out.status}`);
    expect(out.request.kind).toBe('defense-result');
    expect(out.partial.map((p) => p.visual?.type)).toEqual(['activate', 'move']);
    expect(out.partial.every((p) => p.group === 'Activation 1')).toBe(true);
    expect(out.partial.every((p) => p.label)).toBe(true);
  });

  it('une fois la saisie donnée, le calcul rejoué reproduit les mêmes étapes (mêmes ids) puis les prolonge', () => {
    const g = attackTurn();
    const first = runMonsterTurnSafe(g, testContent);
    if (first.status !== 'awaiting-input') throw new Error('saisie attendue');
    const save = { kind: 'defense-result', saves: 0 } as const;
    const r = runMonsterTurn(g, testContent, [save, save, save, save]);
    expect(r.instructions.slice(0, first.partial.length).map((i) => i.id)).toEqual(first.partial.map((i) => i.id));
  });
});

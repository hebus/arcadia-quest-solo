import { describe, expect, it } from 'vitest';
import type { GameState } from '@/engine/domain/schemas';
import { actorInfo, overlayFor, overlayForAttackAnnouncement, overlayForQueue } from './overlay';

const g = {
  heroes: [{ id: 'h1', name: 'Argan', position: { x: 1, y: 1 } }],
  monsters: [
    { id: 'gob-1', definitionId: 'goblin', position: { x: 4, y: 2 } },
    { id: 'gob-2', definitionId: 'goblin', position: null },
  ],
  pets: [],
  mounts: [],
} as unknown as GameState;

describe('instructions visuelles', () => {
  it('actorInfo donne type et étiquette des pions', () => {
    expect(actorInfo(g, 'h1')).toMatchObject({ kind: 'hero', label: 'AR' });
    expect(actorInfo(g, 'gob-1')).toMatchObject({ kind: 'monster', label: 'GO' });
  });

  it('placer : fantôme sur la case cible, pion réel masqué, aucune coordonnée en texte', () => {
    const o = overlayFor({ type: 'place', actorId: 'gob-1', at: { x: 4, y: 2 } }, g);
    expect(o.ghosts).toEqual([{ id: 'gob-1', at: { x: 4, y: 2 }, label: 'GO', kind: 'monster' }]);
    expect(o.hideTokens).toEqual(['gob-1']);
    expect(o.focus).toEqual({ x: 4, y: 2 });
  });

  it('déplacer : flèche sur le trajet, pion montré au départ, glisser sur la cible termine l’étape', () => {
    const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
    const o = overlayFor({ type: 'move', actorId: 'gob-1', path, doorIds: ['d1'] }, g);
    expect(o.arrows).toEqual([{ points: path, tone: 'move' }]);
    expect(o.tokenAt['gob-1']).toEqual({ x: 0, y: 0 });
    expect(o.ghosts[0]!.at).toEqual({ x: 2, y: 0 });
    expect(o.dropTarget).toEqual({ actorId: 'gob-1', at: { x: 2, y: 0 } });
    expect(o.doorIds).toEqual(['d1']);
  });

  it('retirer : croix sur la case, rien si la figurine n’était pas sur le plateau', () => {
    expect(overlayFor({ type: 'remove', actorId: 'gob-1', at: { x: 3, y: 3 } }, g).removals).toHaveLength(1);
    expect(overlayFor({ type: 'remove', actorId: 'gob-2' }, g).removals).toHaveLength(0);
  });

  it('attaque : anneaux attaquant/cible avec blessures et flèche', () => {
    const o = overlayFor({ type: 'attack', attackerId: 'gob-1', targetId: 'h1', wounds: 2 }, g);
    expect(o.rings.map((r) => r.tone)).toEqual(['attacker', 'target']);
    expect(o.rings[1]!.badge).toBe('−2');
    expect(o.arrows[0]).toEqual({ points: [{ x: 4, y: 2 }, { x: 1, y: 1 }], tone: 'attack' });
  });

  it('file : les étapes suivantes gardent les figurines à leur case d’avant', () => {
    const o = overlayForQueue(
      [
        { type: 'place', actorId: 'gob-1', at: { x: 4, y: 2 } },
        { type: 'move', actorId: 'h1', path: [{ x: 0, y: 1 }, { x: 1, y: 1 }], doorIds: [] },
        { type: 'remove', actorId: 'gob-2', at: { x: 7, y: 7 } },
      ],
      g,
    );
    expect(o.ghosts.map((x) => x.id)).toEqual(['gob-1']);
    expect(o.tokenAt['h1']).toEqual({ x: 0, y: 1 });
    expect(o.extraTokens).toEqual([{ id: 'gob-2', at: { x: 7, y: 7 }, label: 'GO', kind: 'monster' }]);
  });

  it('file vide : aucune surcouche', () => {
    expect(overlayForQueue([], g).ghosts).toEqual([]);
  });

  it('annonce d’une attaque : anneaux sur les deux cases, flèche rouge, attaquant montré là où il attaque', () => {
    const o = overlayForAttackAnnouncement({ attackerId: 'gob-1', targetId: 'h1', attackerAt: { x: 3, y: 2 }, targetAt: { x: 3, y: 3 } });
    expect(o.rings.map((r) => r.tone)).toEqual(['attacker', 'target']);
    expect(o.rings.every((r) => r.badge === undefined)).toBe(true); // pas de blessures avant les dés
    expect(o.arrows).toEqual([{ points: [{ x: 3, y: 2 }, { x: 3, y: 3 }], tone: 'attack' }]);
    expect(o.tokenAt['gob-1']).toEqual({ x: 3, y: 2 });
    expect(o.focus).toEqual({ x: 3, y: 3 });
  });

  it('annonce sans position connue : aucun élément dessiné, sans erreur', () => {
    const o = overlayForAttackAnnouncement({ attackerId: 'a', targetId: 'b', attackerAt: null, targetAt: null });
    expect(o.rings).toEqual([]);
    expect(o.arrows).toEqual([]);
  });
});

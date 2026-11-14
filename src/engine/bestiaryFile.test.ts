import { describe, expect, it } from 'vitest';
import { parseBestiaryFile } from './bestiaryFile';
import { monsterStats, rankAtLevel } from './monsters';
import { ORIGINAL_MONSTERS } from '@/game-data/original/monsters';
import data from '@/game-data/original/monsters.json';

const blank = { rank: null, life: null, overkill: null, movement: null, reward: null, attackType: null, attackDice: null, defense: null, rerolls: null, skills: [] };
const entry = (levels: Record<string, unknown>) => ({ monsters: [{ id: 'X', name: 'Monstre X', kind: 'minion', tier: 1, levels }] });
const sheet = { rank: 'minor', life: 2, overkill: 3, movement: 1, reward: 1, attackType: 'melee', attackDice: 3, defense: null, rerolls: null, skills: [] };

describe('fichier du bestiaire (monsters.json)', () => {
  it('une fiche remplie devient les stats du monstre à ce niveau ; une fiche vide est ignorée (à saisir)', () => {
    const [m] = parseBestiaryFile(entry({ '1': sheet, '2-3': blank }));
    expect(m!.levels).toEqual({ '1': { life: 2, overkill: 3, movement: 1, reward: 1, attackType: 'melee', attackDice: 3 } });
    expect(monsterStats(m, '2-3')).toBeUndefined(); // « stats manquantes » : rien n'est inventé
    expect(m!.majorLevels).toBeUndefined();
  });

  it('le rang de la fiche décide : minor dans levels, major dans majorLevels, et il peut changer d’un niveau à l’autre', () => {
    const [m] = parseBestiaryFile(entry({ '1': { ...sheet, rank: 'major', life: 3 }, '2-3': { ...sheet, rank: 'minor' } }));
    expect(m!.majorLevels).toEqual({ '1': expect.objectContaining({ life: 3 }) });
    expect(m!.levels).toEqual({ '2-3': expect.objectContaining({ life: 2 }) });
    expect(rankAtLevel(m, '1')).toBe('major');
    expect(rankAtLevel(m, '2-3')).toBe('minor');
  });

  it('défense, relances et compétences sont facultatives, et gardées quand on les renseigne', () => {
    const [m] = parseBestiaryFile(entry({ '2-3': { ...sheet, defense: 2, rerolls: 1, skills: ['stun', 'crit-extra-wound'] } }));
    expect(m!.levels['2-3']).toMatchObject({ defense: 2, rerolls: 1, skills: ['stun', 'crit-extra-wound'] });
  });

  it('une fiche à moitié remplie est refusée avec le monstre, le niveau et les champs manquants', () => {
    expect(() => parseBestiaryFile(entry({ '2-3': { ...blank, life: 3, rank: 'minor' } }))).toThrow(/monstre X, niveau 2-3 : champs à renseigner : overkill, movement, reward, attackType, attackDice/);
  });

  it('un rang, un type d’attaque ou une compétence inconnus sont refusés avec le contexte', () => {
    expect(() => parseBestiaryFile(entry({ '1': { ...sheet, rank: 'boss' } }))).toThrow(/niveau 1 : rank doit valoir "minor" ou "major"/);
    expect(() => parseBestiaryFile(entry({ '1': { ...sheet, attackType: 'magic' } }))).toThrow(/niveau 1/);
    expect(() => parseBestiaryFile(entry({ '1': { ...sheet, skills: ['vol'] } }))).toThrow(/niveau 1/);
    expect(() => parseBestiaryFile(entry({ '1': { ...sheet, life: 0 } }))).toThrow(/niveau 1/);
  });

  it('un fichier sans liste de monstres est refusé', () => {
    expect(() => parseBestiaryFile({})).toThrow(/« monsters » est absente/);
  });
});

describe('monsters.json livré', () => {
  const file = data as { aide: string[]; monsters: { id: string; levels: Record<string, Record<string, unknown>> }[] };

  it('contient les 7 monstres, avec une fiche « 2-3 » prête à remplir pour chacun, et une aide', () => {
    expect(file.monsters.map((m) => m.id)).toEqual(['GA', 'OM', 'OC', 'M', 'T', 'SB', 'HB']);
    expect(file.aide.length).toBeGreaterThan(3);
    for (const m of file.monsters) {
      expect(m.levels['1'], m.id).toBeDefined();
      expect(m.levels['2-3'], m.id).toBeDefined();
      // Chaque fiche a tous les champs à remplir (même vides), pour qu'on n'ait qu'à compléter les valeurs.
      for (const lv of ['1', '2-3']) expect(Object.keys(m.levels[lv]!).sort(), `${m.id} ${lv}`).toEqual(['attackDice', 'attackType', 'defense', 'life', 'movement', 'overkill', 'rank', 'rerolls', 'reward', 'skills']);
    }
  });

  it('les 7 monstres ont leur fiche « 2-3 » saisie ; seule celle du Goblin Archer au niveau 1 reste à saisir', () => {
    for (const m of file.monsters) expect(m.levels['2-3']!.life, `${m.id} niveau 2-3`).not.toBeNull();
    for (const m of file.monsters) expect(m.levels['1']!.life === null, `${m.id} niveau 1 vide`).toBe(m.id === 'GA');
  });

  it('niveau 2-3 : les valeurs saisies sont lues, avec le rang, la défense et les compétences', () => {
    const by = Object.fromEntries(ORIGINAL_MONSTERS.map((m) => [m.id, m]));
    expect(monsterStats(by.OM, '2-3')).toMatchObject({ life: 3, overkill: 4, movement: 1, reward: 1, attackDice: 3 });
    expect(monsterStats(by.OC, '2-3')).toMatchObject({ life: 3, overkill: 5, reward: 2, attackDice: 3 });
    expect(monsterStats(by.M, '2-3')).toMatchObject({ life: 6, overkill: 7, movement: 2, defense: 1, attackDice: 4, skills: ['crit-extra-wound'] });
    expect(monsterStats(by.T, '2-3')).toMatchObject({ life: 5, overkill: 7, movement: 2, defense: 2, attackDice: 4, skills: ['attack-all-adjacent'] });
    expect(monsterStats(by.SB, '2-3')).toMatchObject({ life: 4, overkill: 6, attackType: 'ranged', attackDice: 3, skills: ['extra-die-next-to-monster'] });
    expect(monsterStats(by.HB, '2-3')).toMatchObject({ life: 4, overkill: 6, attackDice: 4, skills: ['stun'] });
    expect(rankAtLevel(by.SB, '2-3')).toBe('major');
    expect(rankAtLevel(by.HB, '2-3')).toBe('major');
    expect(rankAtLevel(by.M, '2-3')).toBe('minor');
    // Le niveau 1 n'a pas bougé.
    expect(monsterStats(by.OM, '1')).toMatchObject({ life: 2, overkill: 3 });
  });

  it('les valeurs de niveau 1 sont celles communiquées', () => {
    const by = Object.fromEntries(ORIGINAL_MONSTERS.map((m) => [m.id, m]));
    expect(monsterStats(by.OM, '1')).toEqual({ life: 2, overkill: 3, movement: 1, reward: 1, attackType: 'melee', attackDice: 3 });
    expect(monsterStats(by.OC, '1')).toMatchObject({ life: 2, overkill: 4, reward: 2, rerolls: 1, attackDice: 3 });
    expect(monsterStats(by.M, '1')).toMatchObject({ life: 5, overkill: 6, movement: 2, defense: 1, attackDice: 4, skills: ['crit-extra-wound'] });
    expect(monsterStats(by.T, '1')).toMatchObject({ life: 4, overkill: 6, movement: 2, defense: 2, attackDice: 4, skills: ['attack-all-adjacent'] });
    expect(monsterStats(by.SB, '1')).toMatchObject({ life: 3, overkill: 5, movement: 1, attackType: 'ranged', attackDice: 3, skills: ['extra-die-next-to-monster'] });
    expect(monsterStats(by.HB, '1')).toMatchObject({ life: 3, overkill: 5, movement: 1, attackDice: 4, skills: ['stun'] });
    expect(rankAtLevel(by.SB, '1')).toBe('major');
    expect(rankAtLevel(by.HB, '1')).toBe('major');
    expect(by.OM!.group).toBe('orc');
    expect(by.OC!.group).toBe('orc');
    expect(monsterStats(by.GA, '2-3')).toEqual({ life: 2, overkill: 3, movement: 1, reward: 1, attackType: 'ranged', attackDice: 2 });
  });

  it('remplir une fiche suffit : elle est lue comme n’importe quelle autre (ici le niveau 1 du Goblin Archer)', () => {
    const edited = JSON.parse(JSON.stringify(file)) as typeof file;
    Object.assign(edited.monsters.find((m) => m.id === 'GA')!.levels['1']!, { rank: 'minor', life: 2, overkill: 3, movement: 1, reward: 1, attackType: 'ranged', attackDice: 2 });
    const ga = parseBestiaryFile(edited).find((m) => m.id === 'GA')!;
    expect(monsterStats(ga, '1')).toMatchObject({ life: 2, overkill: 3, attackType: 'ranged', attackDice: 2 });
    expect(monsterStats(ga, '2-3')).toMatchObject({ life: 2 }); // l'autre niveau ne change pas
  });
});

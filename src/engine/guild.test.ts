import { describe, expect, it } from 'vitest';
import { DEFAULT_HERO_LIFE, GUILD_SIZE, HERO_NAMES, MAX_HERO_LIFE, guildProblems, guildToTemplates, parseGuild, randomGuild } from './guild';
import { createScenarioGame } from './scenario/definition';
import { ORIGINAL_CONTENT } from '@/game-data/original';
import { CAVE_AUX_CENDRES } from '@/game-data/original/scenarios/cave-aux-cendres';

const ok = [{ name: 'Grom', life: 4 }, { name: 'Maya', life: 3 }, { name: 'Zazu', life: 5 }];

describe('la guilde : 3 héros, nom et points de vie', () => {
  it('une guilde compte exactement 3 héros', () => {
    expect(GUILD_SIZE).toBe(3);
    expect(guildProblems(ok)).toEqual([]);
    expect(guildProblems(ok.slice(0, 2)).join()).toMatch(/Une guilde compte 3 héros/);
    expect(guildProblems([...ok, { name: 'Pip', life: 3 }]).join()).toMatch(/Une guilde compte 3 héros/);
  });

  it('chaque héros a un nom, et les noms sont différents', () => {
    expect(guildProblems([{ name: '  ', life: 3 }, ok[1]!, ok[2]!]).join()).toMatch(/Donnez un nom au héros 1/);
    expect(guildProblems([ok[0]!, { name: 'grom', life: 3 }, ok[2]!]).join()).toMatch(/Deux héros s'appellent « grom »/);
  });

  it('les points de vie sont un entier de 1 à 20', () => {
    for (const life of [0, -1, 2.5, MAX_HERO_LIFE + 1, Number.NaN]) expect(guildProblems([{ name: 'A', life }, ok[1]!, ok[2]!]).join(), `${life}`).toMatch(/points de vie du héros 1/);
    expect(guildProblems([{ name: 'A', life: 1 }, { name: 'B', life: 20 }, ok[2]!])).toEqual([]);
  });

  it('les héros de la guilde deviennent des gabarits de scénario : nom et vie seulement, le reste en physique', () => {
    const templates = guildToTemplates(ok);
    expect(templates.map((t) => [t.name, t.life])).toEqual([['Grom', 4], ['Maya', 3], ['Zazu', 5]]);
    for (const t of templates) expect(t).toMatchObject({ defense: 0, rerolls: 0 });
    expect(templates.every((t) => t.weapons === undefined)).toBe(true);
    expect(guildToTemplates([{ name: '  Grom  ', life: 3 }, ok[1]!, ok[2]!])[0]!.name).toBe('Grom');
  });

  it('la partie créée porte les noms et les points de vie de la guilde', () => {
    const g = createScenarioGame(CAVE_AUX_CENDRES, { sessionId: 's', difficulty: 'medium', seed: 1, heroes: guildToTemplates(ok) }, ORIGINAL_CONTENT);
    expect(g.heroes.map((h) => [h.name, h.life, h.defense, h.rerolls])).toEqual([['Grom', 4, 0, 0], ['Maya', 3, 0, 0], ['Zazu', 5, 0, 0]]);
  });

  it('une guilde enregistrée illisible redonne une guilde tirée au hasard, valide', () => {
    for (const raw of [undefined, [{ name: 'A', life: 3 }], [{ name: '', life: 3 }, ok[1], ok[2]]]) {
      const g = parseGuild(raw);
      expect(guildProblems(g)).toEqual([]);
      expect(g.every((h) => HERO_NAMES.includes(h.name) && h.life === DEFAULT_HERO_LIFE)).toBe(true);
    }
    expect(parseGuild(ok)).toEqual(ok);
  });

  it('les noms par défaut sont tirés au hasard : trois noms différents, jamais « Héros N »', () => {
    expect(HERO_NAMES.length).toBeGreaterThanOrEqual(40);
    expect(new Set(HERO_NAMES).size).toBe(HERO_NAMES.length); // pas de doublon dans la liste
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const g = randomGuild();
      expect(g).toHaveLength(GUILD_SIZE);
      expect(new Set(g.map((h) => h.name)).size).toBe(GUILD_SIZE);
      expect(guildProblems(g)).toEqual([]);
      for (const h of g) {
        expect(HERO_NAMES).toContain(h.name);
        expect(h.name).not.toMatch(/^Héros \d/);
        expect(h.life).toBe(DEFAULT_HERO_LIFE);
        seen.add(h.name);
      }
    }
    expect(seen.size).toBeGreaterThan(10); // les tirages varient
  });

  it('le tirage est reproductible avec une source aléatoire donnée', () => {
    const fixed = () => 0; // toujours le premier nom disponible
    expect(randomGuild(fixed).map((h) => h.name)).toEqual([HERO_NAMES[0], HERO_NAMES[1], HERO_NAMES[2]]);
    expect(randomGuild(() => 0.999).map((h) => h.name)).toEqual([HERO_NAMES.at(-1), HERO_NAMES.at(-2), HERO_NAMES.at(-3)]);
  });
});

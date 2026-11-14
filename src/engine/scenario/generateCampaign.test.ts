import { describe, expect, it } from 'vitest';
import { boxProblems } from '../figurines';
import { createScenarioGame, validateScenario } from './definition';
import { GENERATED_LEVELS } from './generate';
import { CAMPAIGN_CHAPTERS, CHAPTER_TILE_RANGES, generateCampaign, isCampaignChapter, parseGeneratedCampaign } from './generateCampaign';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES } from '@/game-data/original';

const seeds = [1, 2, 3, 7, 11, 42, 99, 123, 2024, 31337];
const gen = (seed: number) => generateCampaign({ seed }, ORIGINAL_CONTENT);
const heroes = ORIGINAL_HEROES.slice(0, 3);
const chiefOf = (s: { monsters: { definitionId: string }[] }) => s.monsters.at(-1)!.definitionId;
const levelIndex = (l: string) => GENERATED_LEVELS.indexOf(l as (typeof GENERATED_LEVELS)[number]);

describe('campagne aléatoire : le générateur', () => {
  it('même graine, même campagne ; des graines différentes donnent des campagnes différentes', () => {
    expect(gen(5)).toEqual(gen(5));
    expect(new Set(seeds.map((s) => JSON.stringify(gen(s)))).size).toBeGreaterThan(seeds.length - 2);
  });

  it('trois chapitres valides et jouables, aux identifiants stables dérivés de la graine', () => {
    for (const seed of seeds) {
      const c = gen(seed);
      expect(c.id).toBe(`campagne-aleatoire-${seed}`);
      expect(c.chapters).toHaveLength(CAMPAIGN_CHAPTERS);
      c.chapters.forEach((ch, i) => {
        expect(ch.scenario.id).toBe(`campagne-${seed}-${i + 1}`);
        expect(isCampaignChapter(ch.scenario.id)).toBe(true);
        expect(ch.scenario.title).toMatch(new RegExp(`^Chapitre ${i + 1} · `));
        expect(validateScenario(ch.scenario, ORIGINAL_CONTENT), `graine ${seed} chapitre ${i + 1}`).toEqual([]);
        createScenarioGame(ch.scenario, { sessionId: 's', difficulty: 'medium', seed: 1, heroes }, ORIGINAL_CONTENT);
      });
    }
  });

  it('la difficulté monte : terrain de plus en plus grand, niveau des monstres jamais en baisse', () => {
    for (const seed of seeds) {
      const c = gen(seed);
      const tiles = c.chapters.map((ch) => ch.scenario.tiles!.placements.length);
      tiles.forEach((n, i) => {
        expect(n).toBeGreaterThanOrEqual(CHAPTER_TILE_RANGES[i]![0]);
        expect(n).toBeLessThanOrEqual(CHAPTER_TILE_RANGES[i]![1]);
      });
      expect(tiles[0]).toBeLessThan(tiles[1]!);
      expect(tiles[1]).toBeLessThan(tiles[2]!);
      const levels = c.chapters.map((ch) => levelIndex(ch.scenario.monsterCardSet));
      expect(levels[0]).toBe(0);
      expect(levels[1]).toBeGreaterThanOrEqual(levels[0]!);
      expect(levels[1]).toBeLessThanOrEqual(2); // au plus le niveau 4-5
      expect(levels[2]).toBeGreaterThanOrEqual(Math.max(2, levels[1]!)); // entre 4-5 et 6
    }
  });

  it('tous les niveaux se rencontrent sur plusieurs graines', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) for (const ch of gen(seed).chapters) seen.add(ch.scenario.monsterCardSet);
    expect([...seen].sort()).toEqual(['1', '2-3', '4-5', '6']);
  });

  it('les chefs sont des vilains qui changent d’un chapitre à l’autre (deux chefs voisins identiques seulement si le bestiaire n’en offre pas assez)', () => {
    let different = 0;
    for (const seed of seeds) {
      const [a, b, c] = gen(seed).chapters.map((ch) => chiefOf(ch.scenario));
      expect(['M', 'T']).toContain(a);
      expect(['M', 'T']).toContain(b);
      expect(['M', 'T']).toContain(c);
      expect(b).not.toBe(a); // il y a deux vilains : les deux premiers chefs diffèrent
      if (c !== a || c !== b) different++;
    }
    expect(different).toBe(seeds.length);
  });

  it('les boîtes de figurines sont respectées dans chaque chapitre', () => {
    for (const seed of seeds) {
      for (const ch of gen(seed).chapters) {
        const counts = new Map<string, number>();
        for (const m of ch.scenario.monsters) {
          const d = ORIGINAL_CONTENT.monsters[m.definitionId]!;
          counts.set(d.group ?? d.id, (counts.get(d.group ?? d.id) ?? 0) + 1);
        }
        expect(boxProblems(counts, ORIGINAL_CONTENT.monsters)).toEqual([]);
      }
    }
  });

  it('l’histoire s’enchaîne : introduction qui rappelle le chef précédent, victoire qui annonce la suite, ultime affrontement', () => {
    for (const seed of seeds) {
      const c = gen(seed);
      c.chapters.forEach((ch, i) => {
        expect(ch.scenario.story.intro[0]).toBe(ch.bridge);
        if (i > 0) {
          const previous = ORIGINAL_CONTENT.monsters[chiefOf(c.chapters[i - 1]!.scenario)]!.name;
          expect(ch.bridge, `chapitre ${i + 1}`).toContain(previous);
        }
        if (i < CAMPAIGN_CHAPTERS - 1) expect(ch.scenario.story.win.join(' ')).toMatch(/chapitre suivant/);
      });
      const last = c.chapters[CAMPAIGN_CHAPTERS - 1]!.scenario.story;
      expect(last.intro.join(' ')).toMatch(/ultime affrontement/);
      expect(last.win.join(' ')).toMatch(/campagne/);
      expect(c.tagline).toContain(ORIGINAL_CONTENT.monsters[chiefOf(c.chapters[0]!.scenario)]!.name);
    }
  });

  it('une campagne enregistrée est relue à l’identique ; une donnée invalide ou incomplète donne null', () => {
    const c = gen(8);
    expect(parseGeneratedCampaign(JSON.parse(JSON.stringify(c)))).toEqual(c);
    expect(parseGeneratedCampaign(undefined)).toBeNull();
    expect(parseGeneratedCampaign({ id: 'x' })).toBeNull();
    expect(parseGeneratedCampaign({ ...c, chapters: c.chapters.slice(0, 2) })).toBeNull();
  });
});

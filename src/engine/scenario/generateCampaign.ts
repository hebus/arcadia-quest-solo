import { type } from 'arktype';
import type { Content } from '../domain/schemas';
import { parse } from '../domain/validate';
import { createSeededRandom, type RandomSource } from '../random';
import { ScenarioDefinitionSchema, type ScenarioDefinition } from './definition';
import { GENERATED_LEVELS, generateScenario, type GeneratedLevel } from './generate';

/**
 * Campagne aléatoire : trois chapitres tirés au hasard à partir d'UNE graine de campagne (même graine, même campagne). La
 * difficulté monte d'un chapitre à l'autre : le terrain grandit (2 à 3 tuiles, puis 4 à 6, puis 7 à 9) et le niveau des monstres
 * ne baisse jamais (niveau 1 au premier chapitre, entre 1 et 4-5 au deuxième, entre 4-5 et 6 au dernier). Les chefs sont des vilains
 * différents d'un chapitre à l'autre tant que le bestiaire le permet. L'histoire s'enchaîne : l'introduction de chaque chapitre
 * reprend la fin du précédent en citant son chef, et le dernier chapitre est l'ultime affrontement.
 *
 * Les chapitres n'existent pas dans les données livrées : la campagne les contient (et la progression les garde avec elle).
 */

export const CAMPAIGN_CHAPTERS = 3;
/** Nombre de tuiles par chapitre : des plages qui ne se chevauchent pas, donc un terrain strictement plus grand à chaque chapitre. */
export const CHAPTER_TILE_RANGES: readonly (readonly [number, number])[] = [
  [2, 3],
  [4, 6],
  [7, 9],
];
const CHAPTER_SEED_TRIES = 12;

export interface GeneratedChapter {
  scenario: ScenarioDefinition;
  /** Ce que la guilde sait en arrivant à ce chapitre (affiché dans la campagne). */
  bridge: string;
}

export interface GeneratedCampaign {
  id: string;
  seed: number;
  title: string;
  tagline: string;
  chapters: GeneratedChapter[];
}

export const GeneratedCampaignSchema = type({
  id: 'string',
  seed: 'number.integer >= 0',
  title: 'string',
  tagline: 'string',
  chapters: type({ bridge: 'string', scenario: ScenarioDefinitionSchema }).array(),
});

/** Relit une campagne enregistrée ; toute donnée invalide donne `null`. */
export function parseGeneratedCampaign(raw: unknown): GeneratedCampaign | null {
  if (raw === undefined || raw === null) return null;
  try {
    const campaign = parse(GeneratedCampaignSchema, raw);
    return campaign.chapters.length === CAMPAIGN_CHAPTERS ? campaign : null;
  } catch {
    return null;
  }
}

/** Les scénarios d'une campagne aléatoire ont un identifiant en « campagne-… » (ce ne sont pas des tirages isolés). */
export const isCampaignChapter = (scenarioId: string): boolean => scenarioId.startsWith('campagne-');

const TITLES = ['La Nuit des Maraudeurs', 'Les Trois Nuits d’Arcadia', 'La Reconquête du Quartier', 'Le Sceau de Cendre', 'La Longue Nuit du Guet', 'Le Chemin des Braises'];
const OPENINGS = [
  'La nuit tombe sur le quartier : les maraudeurs l’ont investi, et la guilde est seule pour le reprendre.',
  'Trois nuits suffiront peut-être pour chasser les orcs du quartier, si la guilde ne recule devant rien.',
  'Le guet a abandonné le quartier. C’est à la guilde de lui rendre ses rues, une nuit après l’autre.',
];
const LINKS = [
  'Le {chef} est tombé, mais ses troupes ne se sont pas dispersées : elles se sont repliées plus loin dans le quartier.',
  'La chute du {chef} n’a pas calmé les maraudeurs : un nouvel ordre est venu d’ailleurs, et la guilde le suit à la trace.',
  'Sur le {chef}, la guilde a trouvé un sceau qui désigne la prochaine cible : la nuit suivante commence là.',
  'Le {chef} n’était qu’un maillon : ses lieutenants ont fui, et la guilde les rattrape déjà.',
];
const FINAL_HOOK = 'C’est l’ultime affrontement de la campagne : après lui, plus rien ne retiendra la guilde.';
const FINAL_WIN = [
  'Le dernier chef s’effondre : les maraudeurs n’ont plus de bannière, et le quartier rouvre ses volets. La campagne est gagnée.',
  'Quand le dernier chef tombe, le silence retombe sur le quartier. La guilde a gagné la campagne.',
];
const finalLose = 'La dernière nuit est perdue : les maraudeurs gardent le quartier. La guilde peut retenter sa chance.';

const pick = <T>(rng: RandomSource, list: readonly T[]): T => list[rng.nextInt(0, list.length - 1)]!;

/** Graine d'un chapitre : un entier positif tiré de la graine de campagne. */
const chapterSeed = (rng: RandomSource): number => rng.nextInt(1, 2 ** 31 - 2);

export function generateCampaign(opts: { seed: number }, content: Pick<Content, 'monsters' | 'tiles'>): GeneratedCampaign {
  const seed = Math.abs(Math.trunc(opts.seed)) % 2 ** 31;
  if (!Number.isFinite(opts.seed)) throw new Error('La graine de la campagne doit être un nombre.');
  const rng = createSeededRandom(seed);
  // Niveaux des monstres : chapitre 1 au niveau 1, chapitre 2 entre 1 et 4-5, chapitre 3 entre 4-5 et 6 (jamais en dessous du chapitre 2).
  const middle = rng.nextInt(0, 2);
  const last = rng.nextInt(Math.max(2, middle), GENERATED_LEVELS.length - 1);
  const levels: GeneratedLevel[] = [GENERATED_LEVELS[0], GENERATED_LEVELS[middle]!, GENERATED_LEVELS[last]!];
  const campaignTitle = pick(rng, TITLES);
  const opening = pick(rng, OPENINGS);

  const chapters: GeneratedChapter[] = [];
  const chiefs: string[] = [];
  const chiefNames: string[] = [];
  for (let i = 0; i < CAMPAIGN_CHAPTERS; i++) {
    const [min, max] = CHAPTER_TILE_RANGES[i]!;
    const tileCount = rng.nextInt(min, max);
    let scenario: ScenarioDefinition | null = null;
    for (let t = 0; t < CHAPTER_SEED_TRIES && !scenario; t++) {
      try {
        scenario = generateScenario({ tileCount, seed: chapterSeed(rng), level: levels[i]!, avoidChiefs: chiefs }, content);
      } catch {
        scenario = null; // ce tirage ne donne rien de viable : on en essaie un autre
      }
    }
    if (!scenario) throw new Error(`Aucun chapitre viable n'a été trouvé pour le chapitre ${i + 1} (${tileCount} tuiles, niveau ${levels[i]}) : essayez une autre graine.`);

    const chiefDef = content.monsters[scenario.monsters.at(-1)!.definitionId]!;
    const isLast = i === CAMPAIGN_CHAPTERS - 1;
    const bridge = i === 0 ? opening : pick(rng, LINKS).replace('{chef}', chiefNames[i - 1]!);
    const quest = scenario.quests[0]!;
    const intro = [...scenario.story.intro];
    intro[0] = bridge; // l'introduction reprend la fin du chapitre précédent (ou ouvre la campagne)
    if (isLast) intro.push(FINAL_HOOK);
    chapters.push({
      bridge,
      scenario: {
        ...scenario,
        id: `campagne-${seed}-${i + 1}`,
        title: `Chapitre ${i + 1} · ${quest.title}`,
        story: {
          intro,
          // La victoire d'un chapitre annonce le suivant ; celle du dernier clôt la campagne.
          win: isLast ? [pick(rng, FINAL_WIN)] : [`Le ${chiefDef.name} est tombé, mais la nuit n’est pas finie : le chapitre suivant attend la guilde.`],
          lose: isLast ? [finalLose] : scenario.story.lose,
        },
      },
    });
    chiefs.push(chiefDef.id);
    chiefNames.push(chiefDef.name);
  }

  return {
    id: `campagne-aleatoire-${seed}`,
    seed,
    title: campaignTitle,
    tagline: `Du ${chiefNames[0]} au ${chiefNames[CAMPAIGN_CHAPTERS - 1]} : trois chapitres de plus en plus durs.`,
    chapters,
  };
}

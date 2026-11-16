import type { HeroTemplate } from './scenario/definition';

/**
 * La guilde du joueur : un groupe de 3 héros. Le jeu de base compte une cinquantaine de héros jouables : l'application n'en
 * connaît aucun. Pour chacun, le joueur ne donne que son **nom** et ses **points de vie** ; tout le reste (cartes, dés de
 * défense, armes, relances) se gère en physique avec la figurine et les cartes.
 */
export const GUILD_SIZE = 3;
export const MIN_HERO_LIFE = 1;
export const MAX_HERO_LIFE = 20;

export interface GuildHero {
  name: string;
  life: number;
  /** Pouvoir passif « furtivité » : le héros ne déclenche pas les réactions Guard des monstres en se déplaçant. */
  stealth?: boolean;
}

/** Points de vie d'un héros tant que le joueur n'a pas saisi les siens. */
export const DEFAULT_HERO_LIFE = 3;

/** Prénoms de héros pour composer une guilde au hasard (le joueur les remplace par les noms de ses figurines). */
export const HERO_NAMES: readonly string[] = [
  'Aldric', 'Brunhild', 'Cassian', 'Dorian', 'Elowen', 'Fenris', 'Gwendal', 'Hadrien', 'Isolde', 'Jorund',
  'Kaelen', 'Lyra', 'Magnus', 'Nyssa', 'Orsino', 'Perrin', 'Quentin', 'Rowena', 'Sigrid', 'Thorin',
  'Ulric', 'Vesper', 'Wulfric', 'Xanthe', 'Yvain', 'Zéphyr', 'Astrid', 'Balthazar', 'Cordélia', 'Dagobert',
  'Esmé', 'Faramond', 'Gisèle', 'Hector', 'Iseult', 'Jehan', 'Kolbjörn', 'Liliane', 'Mordred', 'Néron',
  'Ophélie', 'Pélagie', 'Raoul', 'Seraphine', 'Tancrède', 'Urielle', 'Valdemar', 'Wilhelmine', 'Yseult', 'Zoltan',
];

/** Une guilde de trois héros aux noms tirés au hasard (tous différents), avec les points de vie par défaut. */
export function randomGuild(random: () => number = Math.random): GuildHero[] {
  const pool = [...HERO_NAMES];
  return Array.from({ length: GUILD_SIZE }, () => ({ name: pool.splice(Math.min(pool.length - 1, Math.floor(random() * pool.length)), 1)[0]!, life: DEFAULT_HERO_LIFE }));
}

/** Problèmes de la guilde (liste vide si elle peut jouer) : 3 héros, un nom chacun et tous différents, des points de vie valides. */
export function guildProblems(guild: readonly GuildHero[]): string[] {
  const problems: string[] = [];
  if (guild.length !== GUILD_SIZE) problems.push(`Une guilde compte ${GUILD_SIZE} héros.`);
  const names = guild.map((h) => h.name.trim());
  names.forEach((n, i) => {
    if (n === '') problems.push(`Donnez un nom au héros ${i + 1}.`);
  });
  const seen = new Set<string>();
  for (const n of names) {
    if (n !== '' && seen.has(n.toLowerCase())) problems.push(`Deux héros s'appellent « ${n} » : donnez-leur des noms différents.`);
    seen.add(n.toLowerCase());
  }
  guild.forEach((h, i) => {
    if (!Number.isInteger(h.life) || h.life < MIN_HERO_LIFE || h.life > MAX_HERO_LIFE) problems.push(`Les points de vie du héros ${i + 1} doivent être un entier de ${MIN_HERO_LIFE} à ${MAX_HERO_LIFE}.`);
  });
  return problems;
}

/**
 * Les héros de la guilde comme gabarits de scénario. Seuls le nom et les points de vie sont connus : les dés de défense, les
 * relances et les armes sont gérés en physique (0 ici). L'application demande donc toujours au joueur combien de boucliers il obtient.
 */
export function guildToTemplates(guild: readonly GuildHero[]): HeroTemplate[] {
  return guild.map((h, i) => ({ id: `guilde-${i + 1}`, name: h.name.trim(), epithet: '', life: h.life, defense: 0, rerolls: 0, ...(h.stealth ? { stealth: true } : {}) }));
}

/** Relit une guilde enregistrée ; toute donnée inattendue donne une guilde tirée au hasard. */
export function parseGuild(raw: unknown): GuildHero[] {
  if (!Array.isArray(raw) || raw.length !== GUILD_SIZE) return randomGuild();
  const heroes = raw.map((h) => ({ name: typeof (h as GuildHero)?.name === 'string' ? (h as GuildHero).name : '', life: Number((h as GuildHero)?.life), ...((h as GuildHero)?.stealth === true ? { stealth: true } : {}) }));
  return heroes.every((h) => h.name.trim() !== '' && Number.isInteger(h.life)) ? heroes : randomGuild();
}

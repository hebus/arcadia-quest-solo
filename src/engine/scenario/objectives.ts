import type { Door, Position } from '../domain/schemas';
import { samePos } from '../movement/board';
import type { RandomSource } from '../random';
import type { ScenarioQuest } from './definition';
import { RANDOM_REWARD, type Rule } from './script';

/**
 * Les objectifs de scénario du mode aléatoire. Chaque type d'objectif fabrique ses quêtes et les règles de script qui les
 * valident, avec les conditions du moteur (case atteinte, porte ouverte, monstres abattus, héros réunis, manche atteinte).
 * Le chef (un vilain) reste toujours sur le plateau : il donne une carte Récompense quand il tombe, et sa mort est une quête
 * pour certains objectifs seulement.
 */
export const OBJECTIVE_KINDS = ['atteindre', 'cle-coffre', 'double-coffre', 'brasiers', 'massacre', 'chasse', 'evasion', 'tenir', 'sceau', 'prisonnier', 'chef'] as const;
export type ObjectiveKind = (typeof OBJECTIVE_KINDS)[number];

export const OBJECTIVE_LABEL: Record<ObjectiveKind, string> = {
  atteindre: 'Reprendre un objet (relique, clé, brasier ou coffre)',
  'cle-coffre': 'Prendre la clé, puis ouvrir le coffre',
  'double-coffre': 'Piller deux coffres',
  brasiers: 'Éteindre trois brasiers',
  massacre: 'Abattre une partie de la bande',
  chasse: 'Chasser tous les monstres d’un type',
  evasion: 'S’échapper : tous les héros à la sortie',
  tenir: 'Tenir jusqu’à l’aube',
  sceau: 'Briser le sceau violet',
  prisonnier: 'Délivrer le prisonnier et le ramener',
  chef: 'Abattre le chef',
};

export interface ObjectiveContext {
  rng: RandomSource;
  tileCount: number;
  starts: readonly Position[];
  monsters: readonly { id: string; definitionId: string; at: Position }[];
  /** Le chef est le dernier monstre. */
  chiefId: string;
  chiefName: string;
  chiefAt: Position;
  /** Nom d'un monstre à partir de son type (pour les quêtes de chasse). */
  nameOf: (definitionId: string) => string;
  /** Cases de bâtiments fermés par une porte, loin du départ (hors case du chef) : de préférence pour cacher un objet. */
  closed: readonly Position[];
  /** Cases ouvertes (rue ou bâtiment), loin du départ (hors case du chef). */
  open: readonly Position[];
  /** Cases de rue du plateau. */
  streets: readonly Position[];
  doors: readonly Door[];
  /** Distance de rapprochement imposée aux objets par rapport au départ. */
  far: number;
}

export interface Objective {
  kind: ObjectiveKind;
  /** Phrase d'accroche (carte du scénario). */
  tagline: string;
  /** Phrase finale de l'introduction. */
  intro: string;
  quests: ScenarioQuest[];
  rules: Rule[];
  /** Porte à marquer « spéciale » (violette). */
  specialDoorId?: string;
}

const dist = (a: Position, b: Position) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const pick = <T>(rng: RandomSource, list: readonly T[]): T => list[rng.nextInt(0, list.length - 1)]!;
const shuffle = <T>(rng: RandomSource, list: readonly T[]): T[] => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
};

const REACH = [
  { title: 'Reprendre la relique', icon: 'gem' as const, text: 'La relique est entre vos mains, froide et lourde.' },
  { title: 'Retrouver la clé', icon: 'key' as const, text: 'La clé est encore tiède : la bande ne l’avait pas quittée.' },
  { title: 'Éteindre le brasier maudit', icon: 'flame' as const, text: 'Le brasier crache une dernière étincelle puis s’éteint.' },
  { title: 'Ouvrir le coffre du guet', icon: 'chest' as const, text: 'Le coffre cède : le butin des orcs est à vous.' },
];

/** Une case d'objectif : un bâtiment fermé si possible, jamais deux fois la même. */
function spots(ctx: ObjectiveContext, n: number, used: Position[] = []): Position[] | null {
  const fresh = (list: readonly Position[]) => shuffle(ctx.rng, list.filter((p) => !used.some((u) => samePos(u, p)) && !samePos(p, ctx.chiefAt)));
  const out: Position[] = [];
  for (const p of [...fresh(ctx.closed), ...fresh(ctx.open)]) {
    if (out.length >= n) break;
    if (out.every((q) => dist(q, p) >= 2) && !used.some((u) => samePos(u, p))) out.push(p);
  }
  return out.length === n ? out : null;
}

const chiefRules = (ctx: ObjectiveContext, asQuest: boolean): { quests: ScenarioQuest[]; rules: Rule[] } => {
  const down: Rule['when'] = [{ type: 'monster-down', monsterId: ctx.chiefId }];
  const loot = { type: 'reward' as const, card: RANDOM_REWARD, text: `Le ${ctx.chiefName} laisse tomber son butin.` };
  const done = `Le ${ctx.chiefName} s’effondre : sa bande perd courage.`;
  return asQuest
    ? {
        quests: [{ id: 'chef', icon: 'skull', title: `Abattre le ${ctx.chiefName}`, completion: done, at: ctx.chiefAt }],
        rules: [{ id: 'chef-tombe', when: down, then: [loot, { type: 'complete-quest', questId: 'chef', text: done }] }],
      }
    : { quests: [], rules: [{ id: 'chef-tombe', when: down, then: [loot, { type: 'narrate', title: 'Le chef est tombé', tone: 'story', text: done }] }] };
};

const reachRule = (id: string, at: Position, questId: string, text: string, extra: Rule['when'] = [], reward = false): Rule => ({
  id,
  when: [{ type: 'hero-on', at }, ...extra],
  then: [...(reward ? [{ type: 'reward' as const, card: RANDOM_REWARD }] : []), { type: 'complete-quest', questId, text }],
});

type Builder = (ctx: ObjectiveContext) => Omit<Objective, 'kind'> | null;

const BUILDERS: Record<ObjectiveKind, Builder> = {
  atteindre(ctx) {
    const at = spots(ctx, 1)?.[0];
    if (!at) return null;
    const o = pick(ctx.rng, REACH);
    const chief = chiefRules(ctx, true);
    return {
      tagline: `${o.title}, puis abattez le ${ctx.chiefName}.`,
      intro: `${o.title}, puis abattez le ${ctx.chiefName} avant l’aube.`,
      quests: [{ id: 'objectif', icon: o.icon, title: o.title, completion: o.text, at }, ...chief.quests],
      rules: [reachRule('objectif-atteint', at, 'objectif', o.text, [], o.icon === 'chest'), ...chief.rules],
    };
  },

  'cle-coffre'(ctx) {
    const two = spots(ctx, 2);
    if (!two) return null;
    const [keyAt, chestAt] = two as [Position, Position];
    const chief = chiefRules(ctx, true);
    return {
      tagline: `Prenez la clé, ouvrez le coffre, puis abattez le ${ctx.chiefName}.`,
      intro: `La clé est cachée quelque part et le coffre du butin reste fermé : prenez l’une, ouvrez l’autre, puis abattez le ${ctx.chiefName}.`,
      quests: [
        { id: 'cle', icon: 'key', title: 'Retrouver la clé', completion: 'La clé est dans votre poche.', at: keyAt },
        { id: 'coffre', icon: 'chest', title: 'Ouvrir le coffre (il faut la clé)', completion: 'Le coffre s’ouvre sur le butin de la bande.', at: chestAt },
        ...chief.quests,
      ],
      rules: [
        reachRule('cle-prise', keyAt, 'cle', 'La clé est dans votre poche.'),
        reachRule('coffre-ouvert', chestAt, 'coffre', 'Le coffre s’ouvre sur le butin de la bande.', [{ type: 'quest-done', questId: 'cle' }], true),
        ...chief.rules,
      ],
    };
  },

  'double-coffre'(ctx) {
    const two = spots(ctx, 2);
    if (!two) return null;
    const chief = chiefRules(ctx, false);
    return {
      tagline: 'Deux coffres à piller avant que la bande ne les vide.',
      intro: 'La bande a caché deux coffres dans le quartier : pillez-les tous les deux avant qu’elle ne les vide.',
      quests: two.map((at, i) => ({ id: `coffre-${i + 1}`, icon: 'chest' as const, title: `Piller le coffre ${i + 1}`, completion: `Le coffre ${i + 1} cède : le butin est à vous.`, at })),
      rules: [...two.map((at, i) => reachRule(`coffre-${i + 1}-pille`, at, `coffre-${i + 1}`, `Le coffre ${i + 1} cède : le butin est à vous.`, [], true)), ...chief.rules],
    };
  },

  brasiers(ctx) {
    const three = spots(ctx, 3);
    if (!three) return null;
    const chief = chiefRules(ctx, false);
    return {
      tagline: 'Trois brasiers maudits à éteindre.',
      intro: 'Trois brasiers maudits brûlent dans le quartier : éteignez-les tous avant qu’ils n’attirent d’autres bandes.',
      quests: three.map((at, i) => ({ id: `brasier-${i + 1}`, icon: 'flame' as const, title: `Éteindre le brasier ${i + 1}`, completion: `Le brasier ${i + 1} s’éteint dans un nuage de cendres.`, at })),
      rules: [...three.map((at, i) => reachRule(`brasier-${i + 1}-eteint`, at, `brasier-${i + 1}`, `Le brasier ${i + 1} s’éteint dans un nuage de cendres.`)), ...chief.rules],
    };
  },

  massacre(ctx) {
    const crew = ctx.monsters.filter((m) => m.id !== ctx.chiefId);
    if (crew.length < 2) return null;
    const n = Math.max(2, Math.min(crew.length, Math.ceil(crew.length * 0.7)));
    const chief = chiefRules(ctx, false);
    return {
      tagline: `Abattez ${n} monstres de la bande.`,
      intro: `La bande est trop nombreuse pour le quartier : abattez-en ${n} et elle battra en retraite.`,
      quests: [{ id: 'massacre', icon: 'skull', title: `Abattre ${n} monstres`, completion: 'La bande, décimée, bat en retraite.' }],
      rules: [{ id: 'massacre-fait', when: [{ type: 'monsters-down', count: n }], then: [{ type: 'complete-quest', questId: 'massacre', text: 'La bande, décimée, bat en retraite.' }] }, ...chief.rules],
    };
  },

  chasse(ctx) {
    const byType = new Map<string, number>();
    for (const m of ctx.monsters) if (m.id !== ctx.chiefId) byType.set(m.definitionId, (byType.get(m.definitionId) ?? 0) + 1);
    const types = [...byType].filter(([, n]) => n >= 2);
    if (types.length === 0) return null;
    const [defId, n] = pick(ctx.rng, types);
    const name = ctx.nameOf(defId);
    const chief = chiefRules(ctx, false);
    return {
      tagline: `Chassez tous les ${name} (${n}).`,
      intro: `Les ${name} sont l’âme de la bande : chassez-les tous (${n}) et le reste fuira.`,
      quests: [{ id: 'chasse', icon: 'skull', title: `Abattre les ${n} ${name}`, completion: `Le dernier ${name} tombe : la bande perd sa colonne vertébrale.` }],
      rules: [{ id: 'chasse-finie', when: [{ type: 'monsters-down', count: n, definitionId: defId }], then: [{ type: 'complete-quest', questId: 'chasse', text: `Le dernier ${name} tombe : la bande perd sa colonne vertébrale.` }] }, ...chief.rules],
    };
  },

  evasion(ctx) {
    // La sortie : une zone de 3 cases de rue, tout au bout du plateau par rapport au départ.
    const nearest = (p: Position) => Math.min(...ctx.starts.map((s) => dist(s, p)));
    const sorted = [...ctx.streets].filter((p) => nearest(p) >= Math.max(ctx.far, 3)).sort((a, b) => nearest(b) - nearest(a));
    if (sorted.length < 3) return null;
    const head = sorted[0]!;
    const zone = [head, ...sorted.filter((p) => !samePos(p, head) && dist(p, head) <= 2).slice(0, 2)];
    if (zone.length < 3) return null;
    const chief = chiefRules(ctx, false);
    return {
      tagline: 'Échappez-vous : toute la guilde doit atteindre la sortie.',
      intro: 'Le quartier est un piège : traversez-le et rejoignez la sortie, tous ensemble, sans laisser personne derrière.',
      quests: [{ id: 'sortie', icon: 'flag', title: 'Rejoindre la sortie (tous les héros)', completion: 'La guilde au complet franchit la sortie.', at: head }],
      rules: [{ id: 'sortie-atteinte', when: [{ type: 'heroes-on', cells: zone }], then: [{ type: 'complete-quest', questId: 'sortie', text: 'La guilde au complet franchit la sortie.' }] }, ...chief.rules],
    };
  },

  tenir(ctx) {
    const end = 3 + Math.ceil(ctx.tileCount / 3);
    const chief = chiefRules(ctx, false);
    return {
      tagline: `Tenez jusqu’à l’aube (manche ${end}).`,
      intro: `Impossible de forcer la bande : tenez le quartier jusqu’à l’aube, à la manche ${end}.`,
      quests: [{ id: 'aube', icon: 'flame', title: `Tenir jusqu’à l’aube (manche ${end})`, completion: 'Le soleil se lève : la bande se disperse.' }],
      rules: [
        { id: 'nuit-epaisse', when: [{ type: 'round-reached', round: Math.max(2, Math.ceil(end / 2)) }], then: [{ type: 'narrate', title: 'La nuit s’épaissit', tone: 'danger', text: 'Les torches s’éteignent une à une : la bande resserre son étau.' }] },
        { id: 'aube-levee', when: [{ type: 'round-reached', round: end }], then: [{ type: 'complete-quest', questId: 'aube', text: 'Le soleil se lève : la bande se disperse.' }] },
        ...chief.rules,
      ],
    };
  },

  sceau(ctx) {
    const seal = ctx.doors.find((d) => !d.open && !d.special);
    if (!seal) return null;
    const chief = chiefRules(ctx, true);
    return {
      tagline: `Brisez le sceau violet, puis abattez le ${ctx.chiefName}.`,
      intro: `Une porte scellée de violet garde le cœur du quartier : brisez le sceau, puis abattez le ${ctx.chiefName}.`,
      quests: [{ id: 'sceau', icon: 'key', title: 'Briser le sceau violet', completion: 'Le sceau violet saute dans un éclair.', at: seal.a }, ...chief.quests],
      rules: [{ id: 'sceau-brise', when: [{ type: 'door-open', doorId: seal.id }], then: [{ type: 'complete-quest', questId: 'sceau', text: 'Le sceau violet saute dans un éclair.' }] }, ...chief.rules],
      specialDoorId: seal.id,
    };
  },

  prisonnier(ctx) {
    const at = spots(ctx, 1)?.[0];
    if (!at) return null;
    const chief = chiefRules(ctx, true);
    return {
      tagline: `Délivrez le prisonnier, ramenez-le au départ, puis abattez le ${ctx.chiefName}.`,
      intro: `Un des vôtres croupit dans une cellule : délivrez-le, ramenez-le à votre point de départ, puis abattez le ${ctx.chiefName}.`,
      quests: [
        { id: 'prisonnier', icon: 'flag', title: 'Délivrer le prisonnier', completion: 'Les chaînes tombent : le prisonnier vous suit.', at },
        { id: 'retour', icon: 'flag', title: 'Ramener le prisonnier au départ', completion: 'Le prisonnier est en sécurité : il vous remercie.', at: ctx.starts[0]! },
        ...chief.quests,
      ],
      rules: [
        reachRule('prisonnier-libere', at, 'prisonnier', 'Les chaînes tombent : le prisonnier vous suit.'),
        { id: 'prisonnier-ramene', when: [{ type: 'quest-done', questId: 'prisonnier' }, { type: 'heroes-on', cells: [...ctx.starts], count: 1 }], then: [{ type: 'complete-quest', questId: 'retour', text: 'Le prisonnier est en sécurité : il vous remercie.' }] },
        ...chief.rules,
      ],
    };
  },

  chef(ctx) {
    const chief = chiefRules(ctx, true);
    return {
      tagline: `Abattez le ${ctx.chiefName}.`,
      intro: `Le ${ctx.chiefName} tient le quartier : abattez-le avant l’aube.`,
      quests: chief.quests,
      rules: chief.rules,
    };
  },
};

/** Fabrique l'objectif d'un type donné, ou null si le terrain ne s'y prête pas (trop peu de cases, pas de porte fermée…). */
export function buildObjective(kind: ObjectiveKind, ctx: ObjectiveContext): Objective | null {
  const built = BUILDERS[kind](ctx);
  return built ? { kind, ...built } : null;
}

/** Tire un type d'objectif au hasard (ou prend celui demandé) puis le fabrique ; essaie les autres types si le terrain ne convient pas. */
export function drawObjective(ctx: ObjectiveContext, wanted?: ObjectiveKind): Objective | null {
  if (wanted) return buildObjective(wanted, ctx);
  for (const kind of shuffle(ctx.rng, OBJECTIVE_KINDS)) {
    const o = buildObjective(kind, ctx);
    if (o) return o;
  }
  return null;
}

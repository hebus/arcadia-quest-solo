import { type } from 'arktype';
import { PositionSchema, type Difficulty } from '../domain/schemas';
import type { ScenarioDefinition } from './definition';

/** Niveau des fiches de monstres joué à chaque difficulté (mécanisme des scénarios « one shot »). */
export const DIFFICULTY_LEVEL: Record<Difficulty, string> = { easy: '1', medium: '2-3', hard: '4-5', legendary: '6' };

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Facile', medium: 'Moyenne', hard: 'Difficile', legendary: 'Légendaire' };

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard', 'legendary'];

export const MonsterPlacementSchema = type({
  id: 'string',
  definitionId: 'string',
  at: PositionSchema,
  'guard?': 'boolean | undefined',
  'rank?': "'minor' | 'major' | undefined",
});
export type MonsterPlacement = typeof MonsterPlacementSchema.infer;

/**
 * Variante d'un scénario pour une difficulté : le niveau des fiches de monstres, les monstres retirés (par identifiant) et ajoutés
 * (renforts de départ, par exemple un deuxième garde à la difficulté « Difficile »). Le reste du scénario ne change pas.
 */
export const DifficultyVariantSchema = type({
  'monsterCardSet?': 'string | undefined',
  'removeMonsters?': 'string[] | undefined',
  'addMonsters?': MonsterPlacementSchema.array().or('undefined'),
  /** Types de monstres à ajouter à la liste des cartes du deck (le deck liste un type par carte). */
  'addListedMonsterIds?': 'string[] | undefined',
  /** Types de monstres à retirer de la liste des cartes du deck. */
  'removeListedMonsterIds?': 'string[] | undefined',
});
export type DifficultyVariant = typeof DifficultyVariantSchema.infer;

export const DifficultyVariantsSchema = type({
  'easy?': DifficultyVariantSchema.or('undefined'),
  'medium?': DifficultyVariantSchema.or('undefined'),
  'hard?': DifficultyVariantSchema.or('undefined'),
  'legendary?': DifficultyVariantSchema.or('undefined'),
});

/** Le scénario tel qu'on le joue à cette difficulté : sans variante, c'est le scénario lui-même ; sinon la variante est appliquée. */
export function resolveDifficulty(def: ScenarioDefinition, difficulty: Difficulty): ScenarioDefinition {
  const variant = def.difficulties?.[difficulty];
  if (!def.difficulties) return def;
  const { difficulties: _variants, ...base } = def;
  void _variants;
  if (!variant) return base;
  const removed = new Set(variant.removeMonsters ?? []);
  const listed = def.deck?.listedMonsterIds;
  const dropped = new Set(variant.removeListedMonsterIds ?? []);
  const listedIds = listed ? [...listed.filter((id) => !dropped.has(id)), ...(variant.addListedMonsterIds ?? []).filter((id) => !listed.includes(id))] : undefined;
  return {
    ...base,
    monsterCardSet: variant.monsterCardSet ?? def.monsterCardSet,
    monsters: [...def.monsters.filter((m) => !removed.has(m.id)), ...(variant.addMonsters ?? [])],
    ...(def.deck ? { deck: { ...def.deck, ...(listedIds ? { listedMonsterIds: listedIds } : {}) } } : {}),
  };
}

/** Problèmes propres aux variantes : monstres retirés inconnus, identifiants en double. */
export function variantProblems(def: ScenarioDefinition): string[] {
  const problems: string[] = [];
  for (const d of DIFFICULTIES) {
    const v = def.difficulties?.[d];
    if (!v) continue;
    for (const id of v.removeMonsters ?? []) if (!def.monsters.some((m) => m.id === id)) problems.push(`Difficulté ${DIFFICULTY_LABEL[d]} : le monstre retiré « ${id} » n'existe pas.`);
    for (const m of v.addMonsters ?? []) if (def.monsters.some((x) => x.id === m.id && !(v.removeMonsters ?? []).includes(x.id))) problems.push(`Difficulté ${DIFFICULTY_LABEL[d]} : l'identifiant « ${m.id} » existe déjà.`);
  }
  return problems;
}

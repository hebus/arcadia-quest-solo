import type { MonsterDefinition } from './domain/schemas';

/** Boîte d'un type de monstre : les types qui partagent leurs figurines (Orc Marauder et Orc Captain) ont le même groupe. */
export const boxOf = (def: MonsterDefinition): string => def.group ?? def.id;

/**
 * Contrôle le nombre de figurines posées par boîte. `counts` : nombre de figurines par type de monstre. Renvoie un message par
 * boîte dépassée, qui nomme les types concernés (ex. « Trop de figurines Orc Marauder et Orc Captain : 9 pour 8 dans la boîte »).
 */
export function boxProblems(counts: ReadonlyMap<string, number>, monsters: Record<string, MonsterDefinition>): string[] {
  const perBox = new Map<string, { n: number; limit: number | undefined; names: string[] }>();
  for (const [id, n] of counts) {
    const def = monsters[id];
    if (!def || n <= 0) continue;
    const box = perBox.get(boxOf(def)) ?? { n: 0, limit: def.copies, names: [] };
    box.n += n;
    box.limit = Math.min(box.limit ?? Infinity, def.copies ?? Infinity);
    if (!box.names.includes(def.name)) box.names.push(def.name);
    perBox.set(boxOf(def), box);
  }
  const out: string[] = [];
  for (const { n, limit, names } of perBox.values()) {
    if (limit !== undefined && Number.isFinite(limit) && n > limit) out.push(`Trop de figurines ${names.join(' et ')} : ${n} pour ${limit} dans la boîte`);
  }
  return out;
}

/** Nombre de figurines encore disponibles dans la boîte d'un type, compte tenu de celles en jeu (`inPlay` : par type). */
export function boxRemaining(def: MonsterDefinition, monsters: Record<string, MonsterDefinition>, inPlay: ReadonlyMap<string, number>): number {
  if (def.copies === undefined) return Infinity;
  let used = 0;
  for (const [id, n] of inPlay) {
    const other = monsters[id];
    if (other && boxOf(other) === boxOf(def)) used += n;
  }
  return def.copies - used;
}

/** Noms des types qui partagent la boîte de `def` (lui compris), dans l'ordre du bestiaire. */
export const boxNames = (def: MonsterDefinition, monsters: Record<string, MonsterDefinition>): string[] =>
  Object.values(monsters)
    .filter((m) => boxOf(m) === boxOf(def))
    .map((m) => m.name);

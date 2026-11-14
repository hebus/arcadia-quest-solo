/**
 * Les cinq seuls jetons Spawn qui existent dans le jeu (paires de faces du dé d'attaque, sans ordre).
 * Un jet de spawn qui ne correspond à aucun jeton présent sur le plateau n'a aucun effet.
 */
export const SPAWN_TOKEN_TYPES: readonly (readonly [string, string])[] = [
  ['sword', 'sword'],
  ['sword', 'bow'],
  ['sword', 'crit'],
  ['bow', 'bow'],
  ['bow', 'crit'],
];

export const samePair = (p: readonly [string, string], a: string, b: string): boolean => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a);

export const isSpawnTokenType = (a: string, b: string): boolean => SPAWN_TOKEN_TYPES.some((p) => samePair(p, a, b));

/** Libellé court d'un jeton, ex. « épée + arc ». */
const FACE_LABEL: Record<string, string> = { sword: 'épée', bow: 'arc', crit: 'critique' };
export const spawnTokenLabel = (p: readonly [string, string]): string => `${FACE_LABEL[p[0]] ?? p[0]} + ${FACE_LABEL[p[1]] ?? p[1]}`;

/** Problèmes d'une liste de jetons : type inexistant, ou deux jetons identiques (il n'y en a qu'un de chaque). */
export function spawnTokenProblems(points: readonly { id: string; dice: readonly [string, string] }[]): string[] {
  const problems: string[] = [];
  points.forEach((sp, i) => {
    if (!isSpawnTokenType(sp.dice[0], sp.dice[1])) problems.push(`Jeton Spawn ${sp.id} : ${sp.dice[0]}+${sp.dice[1]} n'existe pas (jetons possibles : épée+épée, épée+arc, épée+critique, arc+arc, arc+critique)`);
    else if (points.findIndex((o) => samePair(o.dice as [string, string], sp.dice[0], sp.dice[1])) !== i) problems.push(`Jeton Spawn ${sp.id} : ce jeton (${sp.dice[0]}+${sp.dice[1]}) est déjà sur le plateau, il n'en existe qu'un`);
  });
  return problems;
}

/**
 * Pions porte du jeu physique : 22 pions recto/verso, un côté « porte ouverte » et l'autre « porte fermée ». Un seul de ces
 * pions est spécial (violet) et désigne la porte spéciale du scénario. Un plateau ne peut donc pas compter plus de 22 portes,
 * dont une seule spéciale.
 */
export const DOOR_TOKENS = 22;
export const SPECIAL_DOOR_TOKENS = 1;

/** Problèmes d'un plateau vis-à-vis des pions porte disponibles (liste vide si tout va bien). */
export function doorTokenProblems(doors: readonly { special?: boolean | undefined }[]): string[] {
  const problems: string[] = [];
  if (doors.length > DOOR_TOKENS) problems.push(`Trop de portes : ${doors.length} pour ${DOOR_TOKENS} pions porte dans la boîte.`);
  const special = doors.filter((d) => d.special).length;
  if (special > SPECIAL_DOOR_TOKENS) problems.push(`Une seule porte peut être spéciale (violette) : ${special} sont marquées.`);
  return problems;
}

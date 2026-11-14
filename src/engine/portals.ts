/**
 * Jetons portail du jeu physique : 8 jetons recto/verso, un côté violet et l'autre bleu. Un héros ou un monstre qui entre
 * sur un portail peut se téléporter sur un autre portail **de la même couleur** (1 point de mouvement). Un portail seul ne sert
 * à rien : chaque couleur utilisée en compte au moins deux. Un plateau ne peut pas en poser plus de 8.
 */
export const PORTAL_TOKENS = 8;
export const PORTAL_COLORS = ['violet', 'blue'] as const;
export type PortalColor = (typeof PORTAL_COLORS)[number];

export const PORTAL_COLOR_LABEL: Record<PortalColor, string> = { violet: 'violet', blue: 'bleu' };

/** Problèmes d'un plateau vis-à-vis des jetons portail disponibles (liste vide si tout va bien). */
export function portalProblems(portals: readonly { id: string; color: string }[]): string[] {
  const problems: string[] = [];
  if (portals.length > PORTAL_TOKENS) problems.push(`Trop de portails : ${portals.length} pour ${PORTAL_TOKENS} jetons portail dans la boîte.`);
  const byColor = new Map<string, number>();
  for (const p of portals) byColor.set(p.color, (byColor.get(p.color) ?? 0) + 1);
  for (const [color, n] of byColor) {
    if (!(PORTAL_COLORS as readonly string[]).includes(color)) problems.push(`Portail « ${color} » : les jetons portail sont violets ou bleus.`);
    else if (n < 2) problems.push(`Un seul portail ${PORTAL_COLOR_LABEL[color as PortalColor]} : il en faut au moins deux de la même couleur pour se téléporter.`);
  }
  return problems;
}

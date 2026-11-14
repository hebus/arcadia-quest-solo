import type { DieFaceDef } from '@/engine/domain/schemas';

/**
 * Les dés du jeu. Dé de combat : noir. Dé de défense : blanc.
 *
 * - Dé noir (6 faces) : 3 épées, 2 arcs, 1 critique.
 *   Une attaque de mêlée touche avec une épée ou un critique ; à distance, avec un arc ou un critique ; sinon c'est un échec.
 * - Dé blanc (6 faces) : 1 bouclier, 1 critique, 4 faces vides.
 *   Un bouclier ou un critique annule une touche.
 * Un critique est une réussite et ajoute un dé (règle du livret).
 */
export const DICE_STATUS = 'verified' as const;

export const ATTACK_DIE_COLOR = 'black' as const;
export const DEFENSE_DIE_COLOR = 'white' as const;

const attack = (symbol: string, melee: boolean, ranged: boolean, crit = false): DieFaceDef => ({ symbol, melee, ranged, crit, save: false });

export const DEFAULT_ATTACK_DIE: DieFaceDef[] = [
  attack('sword', true, false),
  attack('sword', true, false),
  attack('sword', true, false),
  attack('bow', false, true),
  attack('bow', false, true),
  attack('crit', true, true, true),
];

export const DEFAULT_DEFENSE_DIE: DieFaceDef[] = [
  { symbol: 'shield', melee: false, ranged: false, crit: false, save: true },
  { symbol: 'crit', melee: false, ranged: false, crit: true, save: true },
  { symbol: 'blank', melee: false, ranged: false, crit: false, save: false },
  { symbol: 'blank', melee: false, ranged: false, crit: false, save: false },
  { symbol: 'blank', melee: false, ranged: false, crit: false, save: false },
  { symbol: 'blank', melee: false, ranged: false, crit: false, save: false },
];

/** Types de face : ce qu'on voit sur un dé. Le symbole d'une face est son type (il sert aussi à désigner les jetons Spawn). */
export type FaceKind = 'sword' | 'bow' | 'crit' | 'shield' | 'blank';

/** Faces possibles de chaque dé, dans l'ordre où on les parcourt en touchant une face. */
export const ATTACK_FACE_KINDS: readonly FaceKind[] = ['sword', 'bow', 'crit'];
export const DEFENSE_FACE_KINDS: readonly FaceKind[] = ['shield', 'crit', 'blank'];

export const FACE_LABEL: Record<FaceKind, { one: string; many: string }> = {
  sword: { one: 'épée', many: 'épées' },
  bow: { one: 'arc', many: 'arcs' },
  crit: { one: 'critique', many: 'critiques' },
  shield: { one: 'bouclier', many: 'boucliers' },
  blank: { one: 'face vide', many: 'faces vides' },
};

/** Une face de ce type : un dé de combat (noir) ou de défense (blanc). Épée : touche en mêlée ; arc : à distance ; critique : touche et ajoute un dé ; bouclier : annule une touche. */
export function dieFace(kind: FaceKind, defense: boolean): DieFaceDef {
  if (defense) return { symbol: kind, melee: false, ranged: false, crit: kind === 'crit', save: kind === 'shield' || kind === 'crit' };
  return { symbol: kind, melee: kind === 'sword' || kind === 'crit', ranged: kind === 'bow' || kind === 'crit', crit: kind === 'crit', save: false };
}

/** Face suivante quand on touche une face. Une face au symbole inconnu (ancienne donnée) devient la première face possible. */
export function nextFaceKind(current: string, defense: boolean): FaceKind {
  const kinds = defense ? DEFENSE_FACE_KINDS : ATTACK_FACE_KINDS;
  const i = kinds.indexOf(current as FaceKind);
  return kinds[(i + 1) % kinds.length]!;
}

/** « 3 épées · 2 arcs · 1 critique » : le contenu d'un dé. */
export function describeDie(faces: readonly DieFaceDef[], defense: boolean): string {
  const kinds: readonly string[] = [...(defense ? DEFENSE_FACE_KINDS : ATTACK_FACE_KINDS)];
  const known = kinds.flatMap((k) => {
    const n = faces.filter((f) => f.symbol === k).length;
    return n > 0 ? [`${n} ${n > 1 ? FACE_LABEL[k as FaceKind].many : FACE_LABEL[k as FaceKind].one}`] : [];
  });
  const other = faces.filter((f) => !kinds.includes(f.symbol)).length;
  return [...known, ...(other > 0 ? [`${other} autre${other > 1 ? 's' : ''}`] : [])].join(' · ');
}

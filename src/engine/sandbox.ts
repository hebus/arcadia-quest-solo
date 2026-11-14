import type { Content, DieFaceDef, GameState, Position } from './domain/schemas';
import { CELL_CAPACITY, inBoard, occupancy } from './movement/board';
import { boxNames, boxRemaining } from './figurines';
import { monsterStats } from './monsters';
import { cloneState, log } from './state';

/**
 * Outils du terrain d'essai : une partie où l'on reproduit une situation (positions, blessures, dés) pour vérifier le
 * déroulement de la phase des monstres, des ripostes et des attaques sans rejouer tout un scénario.
 */

/** Pose un nouveau monstre d'un type donné sur une case libre du plateau. */
export function addMonster(state: GameState, content: Pick<Content, 'monsters'>, definitionId: string, at: Position): GameState {
  const def = content.monsters[definitionId];
  if (!def) throw new Error(`Monstre inconnu : ${definitionId}`);
  if (!monsterStats(def, state.monsterCardSet)) throw new Error(`${def.name} n'a pas de statistiques pour le niveau ${state.monsterCardSet}`);
  // La boîte est partagée entre les types qui utilisent les mêmes figurines (Orc Marauder et Orc Captain).
  const inPlay = new Map<string, number>();
  for (const m of state.monsters) if (m.status !== 'box' && m.status !== 'removed') inPlay.set(m.definitionId, (inPlay.get(m.definitionId) ?? 0) + 1);
  if (boxRemaining(def, content.monsters, inPlay) <= 0) throw new Error(`Plus de figurine ${boxNames(def, content.monsters).join(' ou ')} disponible (${def.copies} dans la boîte)`);
  if (!inBoard(state.board, at)) throw new Error(`La case (${at.x},${at.y}) n'est pas sur le plateau`);
  const o = occupancy(state, at);
  if (o.heroes + o.monsters + o.pets >= CELL_CAPACITY) throw new Error(`La case (${at.x},${at.y}) est déjà pleine : deux figurines au maximum par case`);
  const s = cloneState(state);
  let n = s.monsters.filter((m) => m.definitionId === definitionId).length + 1;
  while (s.monsters.some((m) => m.id === `${definitionId}${n}`)) n++;
  const id = `${definitionId}${n}`;
  s.monsters.push({ id, definitionId, position: { ...at }, status: 'board', isGuard: false, wounds: 0 });
  log(s, 'sandbox-add', `Terrain d'essai : ${id} posé.`, { monsterId: id, at });
  return s;
}

const face = (symbol: string, hit: boolean): DieFaceDef => ({ symbol, melee: hit, ranged: hit, crit: false, save: false });

export interface DicePreset {
  id: string;
  label: string;
  /** Faces du dé d'attaque : leurs symboles désignent aussi le jeton Spawn de référence (épée+épée = S1, arc+arc = S2). */
  faces: DieFaceDef[] | null;
}

/**
 * Dés des monstres réglables. Les symboles des deux dés de référence désignent le jeton Spawn, qui détermine quel monstre
 * agit : en ne gardant qu'un symbole, le jeton de référence est toujours le même et la situation se rejoue à l'identique.
 */
export const DICE_PRESETS: DicePreset[] = [
  { id: 'random', label: 'Aléatoires (règles du livret)', faces: null },
  { id: 'hit-s1', label: 'Touchent toujours · jeton S1', faces: [face('sword', true)] },
  { id: 'hit-s2', label: 'Touchent toujours · jeton S2', faces: [face('bow', true)] },
  { id: 'miss-s1', label: 'Ratent toujours · jeton S1', faces: [face('sword', false)] },
  { id: 'miss-s2', label: 'Ratent toujours · jeton S2', faces: [face('bow', false)] },
];

/** Préréglage correspondant à des faces de dé données (« aléatoires » si aucun ne correspond). */
export function presetOf(attackDie: readonly DieFaceDef[]): DicePreset {
  const found = DICE_PRESETS.find((p) => p.faces && p.faces.length === attackDie.length && p.faces.every((f, i) => f.symbol === attackDie[i]!.symbol && f.melee === attackDie[i]!.melee));
  return found ?? DICE_PRESETS[0]!;
}

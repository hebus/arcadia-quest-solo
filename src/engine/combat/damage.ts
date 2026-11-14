import type { Content, GameState } from '../domain/schemas';
import { monsterStats } from '../monsters';
import { checkEnd, log } from '../state';

/** Blessures sur un héros. À la mort : jeton Death, compteur de morts de la guilde (état mutable). */
export function damageHero(s: GameState, heroId: string, wounds: number, cause: string): boolean {
  const h = s.heroes.find((x) => x.id === heroId);
  if (!h || h.dead || wounds <= 0) return false;
  h.wounds += wounds;
  log(s, 'wound', `${h.name} subit ${wounds} blessure(s) (${h.wounds}/${h.life}) — ${cause}`, { heroId, wounds });
  if (h.wounds < h.life) return false;
  h.dead = true;
  delete h.stunned; // l'étourdissement ne survit pas à la mort
  h.position = null;
  h.deaths += 1;
  s.deaths += 1;
  log(s, 'hero-death', `${h.name} est mort (morts de la guilde : ${s.deaths}).`, { heroId });
  checkEnd(s);
  return true;
}

/** Les morts de familiers ne comptent pas pour la défaite (solo v1.3 p.4). */
export function damagePet(s: GameState, petId: string, wounds: number, cause: string): boolean {
  const p = s.pets.find((x) => x.id === petId);
  if (!p || p.dead || wounds <= 0) return false;
  p.wounds += wounds;
  log(s, 'wound', `${p.name} subit ${wounds} blessure(s) — ${cause}`, { petId: petId, wounds });
  if (p.wounds < p.life) return false;
  p.dead = true;
  p.position = null;
  log(s, 'pet-death', `${p.name} est mort (ne compte pas pour la défaite).`, { petId });
  return true;
}

/** La mort d'une monture compte comme une mort de héros, sans carte Malédiction (solo v1.3 p.5). */
export function killMount(s: GameState, mountId: string): void {
  const m = s.mounts.find((x) => x.id === mountId);
  if (!m || m.dead) return;
  m.dead = true;
  m.position = null;
  s.deaths += 1;
  log(s, 'mount-death', `${m.name} est mort : compte comme une mort de héros (${s.deaths}).`, { mountId });
  checkEnd(s);
}

export interface MonsterDamageResult {
  killed: boolean;
  overkill: boolean;
}

/**
 * Blessures sur un monstre. Mort : retiré du plateau, placé sur le premier emplacement libre de la Spawn Tile,
 * sinon remis dans la boîte (FAQ solo p.20) ; un garde perd son statut. Overkill : pas de Payback.
 */
export function damageMonster(
  s: GameState,
  content: Content,
  monsterId: string,
  wounds: number,
  byHero: boolean,
): MonsterDamageResult {
  const r = applyMonsterWounds(s, content, monsterId, wounds);
  if (!r.killed) return r;
  finalizeMonsterKill(s, content, monsterId, byHero, r.overkill);
  return r;
}

/** Inflige les blessures sans retirer le monstre : il peut encore riposter (Payback) avant de partir. */
export function applyMonsterWounds(
  s: GameState,
  content: Content,
  monsterId: string,
  wounds: number,
): MonsterDamageResult {
  const m = s.monsters.find((x) => x.id === monsterId);
  if (!m || m.status !== 'board' || wounds <= 0) return { killed: false, overkill: false };
  const def = content.monsters[m.definitionId];
  const stats = monsterStats(def, s.monsterCardSet, m.rank);
  if (!def || !stats) throw new Error(`Stats manquantes pour ${m.definitionId}`);
  m.wounds += wounds;
  const overkill = wounds >= stats.overkill;
  log(s, 'wound', `${def.name} subit ${wounds} blessure(s) (${m.wounds}/${stats.life})`, { monsterId, wounds });
  return { killed: overkill || m.wounds >= stats.life, overkill };
}

export function finalizeMonsterKill(
  s: GameState,
  content: Content,
  monsterId: string,
  byHero: boolean,
  overkill: boolean,
): void {
  const m = s.monsters.find((x) => x.id === monsterId)!;
  const def = content.monsters[m.definitionId]!;
  const stats = monsterStats(def, s.monsterCardSet, m.rank)!;
  m.position = null;
  m.wounds = 0;
  const wasGuard = m.isGuard;
  m.isGuard = false;
  if (s.spawnTile.length < s.spawnTileCapacity) {
    s.spawnTile.push(m.id);
    m.status = 'spawn-tile';
  } else {
    m.status = 'box';
  }
  if (byHero) s.coins += stats.reward;
  log(
    s,
    'monster-death',
    `${def.name} est tué${overkill ? ' (Overkill)' : ''}${wasGuard ? ' ; il perd son statut de garde' : ''} → ${m.status === 'spawn-tile' ? 'Spawn Tile' : 'boîte'}${byHero ? ` (+${stats.reward} pièce(s))` : ''}.`,
    { monsterId, overkill, wasGuard },
  );
}

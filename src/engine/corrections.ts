import type { GameState, Position } from './domain/schemas';
import { CELL_CAPACITY, occupancy } from './movement/board';
import { checkEnd, cloneState, log } from './state';
import { validateGameState } from './setup';

export type Correction =
  | { kind: 'hero-position'; heroId: string; to: Position | null }
  | { kind: 'hero-wounds'; heroId: string; wounds: number }
  | { kind: 'hero-dead'; heroId: string; dead: boolean; at?: Position }
  | { kind: 'monster-position'; monsterId: string; to: Position }
  | { kind: 'monster-status'; monsterId: string; status: 'board' | 'spawn-tile' | 'box' | 'removed'; at?: Position }
  | { kind: 'monster-guard'; monsterId: string; isGuard: boolean }
  | { kind: 'monster-wounds'; monsterId: string; wounds: number }
  | { kind: 'door'; doorId: string; open: boolean }
  | { kind: 'quest'; questId: string; done: boolean }
  | { kind: 'deaths'; deaths: number }
  | { kind: 'coins'; coins: number };

/**
 * Correction manuelle de l'état (plan §4.3 G). Toujours historisée : l'historique n'est jamais effacé.
 * L'état corrigé doit rester valide, sinon la correction est refusée.
 */
export function applyCorrection(state: GameState, c: Correction, reason = 'correction manuelle'): GameState {
  const s = cloneState(state);
  const hero = (id: string) => {
    const h = s.heroes.find((x) => x.id === id);
    if (!h) throw new Error(`Héros inconnu : ${id}`);
    return h;
  };
  const monster = (id: string) => {
    const m = s.monsters.find((x) => x.id === id);
    if (!m) throw new Error(`Monstre inconnu : ${id}`);
    return m;
  };
  /** Deux figurines au maximum par case : la correction est refusée si la case est déjà pleine. */
  const free = (p: Position | null | undefined, exceptId: string) => {
    if (!p) return;
    const o = occupancy(s, p, exceptId);
    if (o.heroes + o.monsters + o.pets >= CELL_CAPACITY) throw new Error(`La case (${p.x},${p.y}) est déjà pleine : deux figurines au maximum par case`);
  };
  switch (c.kind) {
    case 'hero-position':
      free(c.to, c.heroId);
      hero(c.heroId).position = c.to;
      break;
    case 'hero-wounds':
      hero(c.heroId).wounds = Math.max(0, c.wounds);
      break;
    case 'hero-dead': {
      const h = hero(c.heroId);
      if (c.dead && !h.dead) {
        h.dead = true;
        h.position = null;
      } else if (!c.dead && h.dead) {
        if (!c.at) throw new Error('Position requise pour ressusciter un héros');
        free(c.at, h.id);
        h.dead = false;
        h.wounds = 0;
        h.position = c.at;
      }
      break;
    }
    case 'monster-position': {
      const m = monster(c.monsterId);
      free(c.to, m.id);
      m.position = c.to;
      m.status = 'board';
      s.spawnTile = s.spawnTile.filter((id) => id !== m.id);
      break;
    }
    case 'monster-status': {
      const m = monster(c.monsterId);
      m.status = c.status;
      s.spawnTile = s.spawnTile.filter((id) => id !== m.id);
      if (c.status === 'board') {
        if (!c.at) throw new Error('Position requise pour poser un monstre sur le plateau');
        free(c.at, m.id);
        m.position = c.at;
      } else {
        m.position = null;
        if (c.status === 'spawn-tile') s.spawnTile.push(m.id);
      }
      break;
    }
    case 'monster-wounds':
      monster(c.monsterId).wounds = Math.max(0, Math.floor(c.wounds));
      break;
    case 'monster-guard':
      monster(c.monsterId).isGuard = c.isGuard;
      break;
    case 'door': {
      const d = s.board.doors.find((x) => x.id === c.doorId);
      if (!d) throw new Error(`Porte inconnue : ${c.doorId}`);
      d.open = c.open;
      break;
    }
    case 'quest': {
      const q = s.quests.find((x) => x.id === c.questId);
      if (!q) throw new Error(`Quête inconnue : ${c.questId}`);
      q.done = c.done;
      break;
    }
    case 'deaths':
      s.deaths = Math.max(0, c.deaths);
      break;
    case 'coins':
      s.coins = Math.max(0, c.coins);
      break;
  }
  const problems = validateGameState(s);
  if (problems.length) throw new Error(`Correction refusée :\n- ${problems.join('\n- ')}`);
  log(s, 'correction', `Correction : ${JSON.stringify(c)} (${reason})`, { correction: c });
  checkEnd(s);
  return s;
}

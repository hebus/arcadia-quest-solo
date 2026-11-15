import type { GameState, Position } from './domain/schemas';
import { CELL_CAPACITY, occupancy } from './movement/board';
import { checkEnd, cloneState, log } from './state';
import { validateGameState } from './setup';

export type Correction =
  | { kind: 'hero-position'; heroId: string; to: Position | null }
  | { kind: 'hero-wounds'; heroId: string; wounds: number }
  | { kind: 'hero-dead'; heroId: string; dead: boolean; at?: Position }
  | { kind: 'hero-stunned'; heroId: string; stunned: boolean }
  | { kind: 'monster-position'; monsterId: string; to: Position }
  | { kind: 'monster-status'; monsterId: string; status: 'board' | 'spawn-tile' | 'box' | 'removed'; at?: Position }
  | { kind: 'monster-guard'; monsterId: string; isGuard: boolean }
  | { kind: 'monster-wounds'; monsterId: string; wounds: number }
  | { kind: 'door'; doorId: string; open: boolean }
  /** Construction du plateau (terrain d'essai) : mur posé ou retiré sur une arête. */
  | { kind: 'board-wall'; a: Position; b: Position }
  /** Porte sur une arête : absente → fermée → ouverte → retirée. */
  | { kind: 'board-door'; a: Position; b: Position }
  /** Bâtiment : la case devient (ou cesse d'être) un intérieur ; les murs de son contour suivent. */
  | { kind: 'board-interior'; at: Position }
  /** Salle : la case a un sol différent de la rue (affichage seulement), sans murs. */
  | { kind: 'board-room'; at: Position }
  /** Case bloquée (impassable) posée ou retirée. */
  | { kind: 'board-blocked'; at: Position }
  | { kind: 'quest'; questId: string; done: boolean }
  | { kind: 'deaths'; deaths: number }
  | { kind: 'coins'; coins: number };

const edgeId = (a: Position, b: Position): string => {
  const ka = `${a.x},${a.y}`;
  const kb = `${b.x},${b.y}`;
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
};
const samePos = (a: Position, b: Position) => a.x === b.x && a.y === b.y;

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
        delete h.stunned;
        h.position = null;
      } else if (!c.dead && h.dead) {
        if (!c.at) throw new Error('Position requise pour ressusciter un héros');
        free(c.at, h.id);
        h.dead = false;
        delete h.stunned;
        h.wounds = 0;
        h.position = c.at;
      }
      break;
    }
    case 'hero-stunned': {
      const h = hero(c.heroId);
      if (c.stunned && h.dead) throw new Error(`${h.name} est mort : il ne peut pas être étourdi`);
      if (c.stunned) h.stunned = true;
      else delete h.stunned;
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
    case 'board-wall': {
      const id = edgeId(c.a, c.b);
      const had = s.board.walls.some(([p, q]) => edgeId(p, q) === id);
      s.board.walls = had ? s.board.walls.filter(([p, q]) => edgeId(p, q) !== id) : [...s.board.walls, [c.a, c.b]];
      // Mur et porte s'excluent sur une même arête.
      if (!had) s.board.doors = s.board.doors.filter((d) => edgeId(d.a, d.b) !== id);
      break;
    }
    case 'board-door': {
      const id = edgeId(c.a, c.b);
      const cur = s.board.doors.find((d) => edgeId(d.a, d.b) === id);
      if (!cur) {
        s.board.walls = s.board.walls.filter(([p, q]) => edgeId(p, q) !== id);
        let n = s.board.doors.length + 1;
        while (s.board.doors.some((d) => d.id === `porte-${n}`)) n += 1;
        s.board.doors.push({ id: `porte-${n}`, a: c.a, b: c.b, open: false });
      } else if (!cur.open) cur.open = true;
      else s.board.doors = s.board.doors.filter((d) => d !== cur);
      break;
    }
    case 'board-interior': {
      const inside = (p: Position) => p.x >= 0 && p.y >= 0 && p.x < s.board.width && p.y < s.board.height;
      if (!inside(c.at)) throw new Error('Case hors du plateau');
      const interior = s.board.interior ?? [];
      const was = interior.some((p) => samePos(p, c.at));
      s.board.interior = was ? interior.filter((p) => !samePos(p, c.at)) : [...interior, c.at];
      // Contour : un mur sépare un intérieur de ce qui ne l'est pas (sauf là où une porte a été posée).
      for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
        const nb = { x: c.at.x + d.x, y: c.at.y + d.y };
        if (!inside(nb)) continue;
        const id = edgeId(c.at, nb);
        if (s.board.doors.some((x) => edgeId(x.a, x.b) === id)) continue;
        const nbIn = s.board.interior.some((p) => samePos(p, nb));
        const meIn = !was;
        const wall = s.board.walls.some(([p, q]) => edgeId(p, q) === id);
        if (meIn !== nbIn && !wall) s.board.walls.push([c.at, nb]);
        if (meIn === nbIn && wall) s.board.walls = s.board.walls.filter(([p, q]) => edgeId(p, q) !== id);
      }
      break;
    }
    case 'board-room': {
      if (c.at.x < 0 || c.at.y < 0 || c.at.x >= s.board.width || c.at.y >= s.board.height) throw new Error('Case hors du plateau');
      const rooms = s.board.rooms ?? [];
      s.board.rooms = rooms.some((p) => samePos(p, c.at)) ? rooms.filter((p) => !samePos(p, c.at)) : [...rooms, c.at];
      break;
    }
    case 'board-blocked': {
      const inside = c.at.x >= 0 && c.at.y >= 0 && c.at.x < s.board.width && c.at.y < s.board.height;
      if (!inside) throw new Error('Case hors du plateau');
      const blocked = s.board.blocked ?? [];
      const was = blocked.some((p) => samePos(p, c.at));
      if (!was) {
        const o = occupancy(s, c.at, '');
        if (o.heroes + o.monsters + o.pets > 0) throw new Error('Une figurine se trouve sur cette case : déplacez-la avant de la bloquer');
      }
      s.board.blocked = was ? blocked.filter((p) => !samePos(p, c.at)) : [...blocked, c.at];
      s.board.holes = was ? s.board.holes.filter((p) => !samePos(p, c.at)) : [...s.board.holes, c.at];
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

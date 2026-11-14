import type { Board, Position, SpawnPoint } from './domain/schemas';
import { spawnTokenProblems } from './spawn/tokens';

export interface ParsedBoard {
  board: Board;
  spawnPoints: SpawnPoint[];
}

const pos = (s: string, line: number): Position => {
  const m = /^(\d+),(\d+)$/.exec(s.trim());
  if (!m) throw new Error(`Ligne ${line} : position invalide « ${s} » (attendu x,y)`);
  return { x: Number(m[1]), y: Number(m[2]) };
};

const pair = (s: string, line: number): [Position, Position] => {
  const parts = s.split('-');
  if (parts.length !== 2) throw new Error(`Ligne ${line} : arête invalide « ${s} » (attendu x,y-x,y)`);
  const [a, b] = [pos(parts[0]!, line), pos(parts[1]!, line)];
  if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== 1) throw new Error(`Ligne ${line} : les deux Spaces doivent être adjacentes`);
  return [a, b];
};

/**
 * Description textuelle du plateau (saisie minimale, plan §4.4) :
 *   size 8x5
 *   hole 3,2
 *   wall 1,0-1,1
 *   door d1 3,2-4,2 closed        (ou open ; ajouter « special » pour la porte spéciale violette, une seule)
 *   room 5,0 4x3                   (bâtiment : cases d'intérieur, contour muré automatiquement)
 *   portal p1 2,3 red
 *   spawn S1 0,0 sword+bow         (un des 5 jetons : sword+sword, sword+bow, sword+crit, bow+bow, bow+crit)
 * Les lignes vides et celles qui commencent par # sont ignorées.
 */
export function parseBoardDsl(text: string): ParsedBoard {
  const board: Board = { width: 0, height: 0, holes: [], walls: [], doors: [], portals: [] };
  const spawnPoints: SpawnPoint[] = [];
  const interior: Position[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    const t = raw.trim();
    if (!t || t.startsWith('#')) return;
    const [cmd, ...a] = t.split(/\s+/);
    switch (cmd) {
      case 'size': {
        const m = /^(\d+)x(\d+)$/.exec(a[0] ?? '');
        if (!m) throw new Error(`Ligne ${line} : taille invalide (attendu LxH)`);
        board.width = Number(m[1]);
        board.height = Number(m[2]);
        break;
      }
      case 'hole':
        board.holes.push(pos(a[0] ?? '', line));
        break;
      case 'wall':
        board.walls.push(pair(a[0] ?? '', line));
        break;
      case 'door': {
        const [id, edge, state, flag] = a;
        if (!id || !edge || (state !== 'open' && state !== 'closed') || (flag !== undefined && flag !== 'special')) throw new Error(`Ligne ${line} : door <id> x,y-x,y open|closed [special]`);
        const [p, q] = pair(edge, line);
        board.doors.push({ id, a: p, b: q, open: state === 'open', ...(flag === 'special' ? { special: true } : {}) });
        break;
      }
      case 'room': {
        const m = /^(\d+)x(\d+)$/.exec(a[1] ?? '');
        const origin = pos(a[0] ?? '', line);
        if (!m) throw new Error(`Ligne ${line} : room x,y LxH`);
        for (let dy = 0; dy < Number(m[2]); dy++) for (let dx = 0; dx < Number(m[1]); dx++) interior.push({ x: origin.x + dx, y: origin.y + dy });
        break;
      }
      case 'portal': {
        const [id, at, color] = a;
        if (!id || !at || !color) throw new Error(`Ligne ${line} : portal <id> x,y <couleur>`);
        board.portals.push({ id, at: pos(at, line), color });
        break;
      }
      case 'spawn': {
        const [id, at, dice] = a;
        const faces = (dice ?? '').split('+');
        if (!id || !at || faces.length !== 2 || faces.some((f) => !f)) throw new Error(`Ligne ${line} : spawn <id> x,y X+Y`);
        spawnPoints.push({ id, at: pos(at, line), dice: [faces[0]!, faces[1]!] });
        break;
      }
      default:
        throw new Error(`Ligne ${line} : commande inconnue « ${cmd} »`);
    }
  });
  const tokenProblems = spawnTokenProblems(spawnPoints);
  if (tokenProblems.length) throw new Error(tokenProblems.join(' ; '));
  if (board.width <= 0 || board.height <= 0) throw new Error('Taille du plateau manquante (size LxH)');
  const inside = (p: Position) => p.x >= 0 && p.y >= 0 && p.x < board.width && p.y < board.height;
  const all = [
    ...board.holes,
    ...board.walls.flat(),
    ...board.doors.flatMap((d) => [d.a, d.b]),
    ...board.portals.map((p) => p.at),
    ...spawnPoints.map((s) => s.at),
  ];
  if ([...all, ...interior].some((p) => !inside(p))) throw new Error('Un élément est hors du plateau');
  if (interior.length) {
    board.interior = interior;
    // Contour des bâtiments muré, sauf là où une porte est posée ; les murs déjà saisis ne sont pas dupliqués.
    const key = (a: Position, b: Position) => (a.x + a.y * 1000 < b.x + b.y * 1000 ? `${a.x},${a.y}|${b.x},${b.y}` : `${b.x},${b.y}|${a.x},${a.y}`);
    const known = new Set([...board.walls, ...board.doors.map((d): [Position, Position] => [d.a, d.b])].map(([p, q]) => key(p, q)));
    const isRoom = (p: Position) => interior.some((c) => c.x === p.x && c.y === p.y);
    for (const c of interior) {
      for (const d of [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]) {
        const n = { x: c.x + d.x, y: c.y + d.y };
        if (!inside(n) || isRoom(n) || known.has(key(c, n))) continue;
        known.add(key(c, n));
        board.walls.push([c, n]);
      }
    }
  }
  return { board, spawnPoints };
}

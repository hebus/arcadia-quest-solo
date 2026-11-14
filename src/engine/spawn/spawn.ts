import type { GameState, Position, SpawnPoint } from '../domain/schemas';
import { CELL_CAPACITY, key, neighbors, occupancy } from '../movement/board';
import type { Oracle } from '../oracle';
import { log } from '../state';
import { releaseDelayedCards } from '../activation/deck';
import type { RandomSource } from '../random';
import { samePair } from './tokens';

export const sameSpawnPair = (sp: SpawnPoint, a: string, b: string): boolean => samePair(sp.dice, a, b);

/**
 * Lance 2 dés d'attaque. Il n'existe que 5 jetons Spawn (voir `tokens.ts`) : si la combinaison ne correspond à aucun jeton
 * présent sur le plateau, `point` vaut `null` et rien ne se passe (pas de relance).
 */
export function rollSpawnPoint(s: GameState, oracle: Oracle, purpose: string): { point: SpawnPoint | null; dice: [string, string] } {
  const a = oracle.spawnDie(`${purpose} (dé 1)`);
  const b = oracle.spawnDie(`${purpose} (dé 2)`);
  const point = s.spawnPoints.find((sp) => sameSpawnPair(sp, a, b)) ?? null;
  if (!point) log(s, 'spawn-none', `Combinaison ${a}/${b} : aucun jeton Spawn sur le plateau, rien ne se passe.`);
  return { point, dice: [a, b] };
}

export interface SpawnReport {
  placed: { monsterId: string; at: { x: number; y: number }; tokenId: string; /** Posé sur une case voisine du jeton, parce que sa Space était pleine. */ adjacent: boolean }[];
  boxed: { monsterId: string; reason: string }[];
}

/** Nombre d'emplacements de la tuile d'apparition. */
export const SPAWN_TILE_SLOTS = 5;

/**
 * Tuile d'apparition : un monstre tué se place sur son premier emplacement libre (5 en tout). Dès que la tuile est pleine,
 * et à n'importe quel moment, chaque monstre de la tuile, dans l'ordre des emplacements, apparaît :
 * - 2 dés d'attaque désignent un jeton Spawn (sans relance ni dé supplémentaire) ;
 * - pas de jeton correspondant sur le plateau : le monstre est retiré définitivement du jeu ;
 * - Space du jeton pleine : le monstre se place sur l'une des Spaces voisines, au choix du joueur ;
 * - sinon, il se place sur la Space du jeton.
 * Ne fait rien tant que la tuile n'est pas pleine.
 */
export function resolveSpawnTile(s: GameState, oracle: Oracle, rng: RandomSource): SpawnReport {
  const report: SpawnReport = { placed: [], boxed: [] };
  if (s.spawnTile.length < s.spawnTileCapacity) return report;
  const queue = [...s.spawnTile];
  s.spawnTile = [];
  log(s, 'spawn-start', `Spawn Tile pleine : ${queue.join(', ')} apparaissent.`);
  const free = (p: Position) => {
    const o = occupancy(s, p);
    return o.heroes + o.monsters + o.pets < CELL_CAPACITY;
  };
  for (const id of queue) {
    const m = s.monsters.find((x) => x.id === id)!;
    const a = oracle.spawnDie(`Spawn de ${id} (dé 1)`);
    const b = oracle.spawnDie(`Spawn de ${id} (dé 2)`);
    const sp = s.spawnPoints.find((p) => sameSpawnPair(p, a, b));
    if (!sp) {
      m.status = 'box';
      report.boxed.push({ monsterId: id, reason: `aucun jeton Spawn ${a}/${b} sur le plateau` });
      log(s, 'spawn-box', `${id} : aucun jeton Spawn ${a}/${b} sur le plateau → retiré définitivement du jeu.`, { monsterId: id });
      continue;
    }
    let at: Position = sp.at;
    let adjacent = false;
    if (!free(sp.at)) {
      // Space du jeton pleine : une des Spaces voisines (orthogonales) qui a encore de la place.
      const options = neighbors(s.board, sp.at).filter(free).map((q) => key(q));
      if (options.length === 0) {
        m.status = 'box';
        report.boxed.push({ monsterId: id, reason: `Space du jeton ${sp.id} pleine et aucune Space voisine libre` });
        log(s, 'spawn-box', `${id} : Space ${sp.id} pleine, aucune Space voisine libre → retiré définitivement du jeu.`, { monsterId: id });
        continue;
      }
      const chosen = oracle.choose(`Space voisine du jeton ${sp.id} pour ${id}`, options);
      const [x, y] = chosen.split(',').map(Number);
      at = { x: x!, y: y! };
      adjacent = true;
    }
    m.status = 'board';
    m.position = { ...at };
    m.isGuard = false;
    report.placed.push({ monsterId: id, at: { ...at }, tokenId: sp.id, adjacent });
    log(s, 'spawn-place', `${id} apparaît ${adjacent ? 'près du' : 'sur le'} jeton ${sp.id}.`, { monsterId: id, at });
    releaseDelayedCards(s, m.definitionId, rng);
  }
  return report;
}

/** Début du Monster Turn : par précaution, résout la Spawn Tile si elle était pleine (normalement déjà fait dès qu'elle l'est). */
export const resolveSpawnPhase = resolveSpawnTile;

import type { GameState, SpawnPoint } from '../domain/schemas';
import { CELL_CAPACITY, occupancy } from '../movement/board';
import type { Oracle } from '../oracle';
import { log } from '../state';
import { releaseDelayedCards } from '../activation/deck';
import type { RandomSource } from '../random';

export const sameSpawnPair = (sp: SpawnPoint, a: string, b: string): boolean =>
  (sp.dice[0] === a && sp.dice[1] === b) || (sp.dice[0] === b && sp.dice[1] === a);

/** Lance 2 dés d'attaque ; sans jeton correspondant sur le plateau, on relance (solo v1.3 p.2 étape 1). */
export function rollSpawnPoint(s: GameState, oracle: Oracle, purpose: string): { point: SpawnPoint; dice: [string, string] } {
  if (s.spawnPoints.length === 0) throw new Error('Aucun jeton Spawn sur le plateau');
  for (let i = 0; i < 500; i++) {
    const a = oracle.spawnDie(`${purpose} (dé 1)`);
    const b = oracle.spawnDie(`${purpose} (dé 2)`);
    const point = s.spawnPoints.find((sp) => sameSpawnPair(sp, a, b));
    if (point) return { point, dice: [a, b] };
    log(s, 'spawn-reroll', `Combinaison ${a}/${b} sans jeton Spawn : relance.`);
  }
  throw new Error('Aucune combinaison de dés ne correspond à un jeton Spawn (jetons mal configurés ?)');
}

export interface SpawnReport {
  placed: { monsterId: string; at: { x: number; y: number } }[];
  boxed: { monsterId: string; reason: string }[];
}

/**
 * Phase Spawn (rulebook p.23, solo v1.3 p.2) : si la Spawn Tile est pleine, chaque monstre, dans l'ordre des
 * emplacements, est placé sur le jeton Spawn tiré s'il existe et que sa Space n'est pas pleine ; sinon boîte.
 * Le jet de spawn n'utilise ni relance ni dé supplémentaire.
 */
export function resolveSpawnPhase(s: GameState, oracle: Oracle, rng: RandomSource): SpawnReport {
  const report: SpawnReport = { placed: [], boxed: [] };
  if (s.spawnTile.length < s.spawnTileCapacity) {
    log(s, 'spawn-skipped', 'Spawn Tile non pleine : pas de spawn.');
    return report;
  }
  const queue = [...s.spawnTile];
  s.spawnTile = [];
  for (const id of queue) {
    const m = s.monsters.find((x) => x.id === id)!;
    const a = oracle.spawnDie(`Spawn de ${id} (dé 1)`);
    const b = oracle.spawnDie(`Spawn de ${id} (dé 2)`);
    const sp = s.spawnPoints.find((p) => sameSpawnPair(p, a, b));
    if (!sp) {
      m.status = 'box';
      report.boxed.push({ monsterId: id, reason: `aucun jeton Spawn ${a}/${b}` });
      log(s, 'spawn-box', `${id} : aucun jeton Spawn ${a}/${b} → boîte.`, { monsterId: id });
      continue;
    }
    const occ = occupancy(s, sp.at);
    if (occ.heroes + occ.monsters + occ.pets >= CELL_CAPACITY) {
      m.status = 'box';
      report.boxed.push({ monsterId: id, reason: `Space du jeton ${sp.id} pleine` });
      log(s, 'spawn-box', `${id} : Space ${sp.id} pleine → boîte.`, { monsterId: id });
      continue;
    }
    m.status = 'board';
    m.position = { ...sp.at };
    m.isGuard = false;
    report.placed.push({ monsterId: id, at: { ...sp.at } });
    log(s, 'spawn-place', `${id} apparaît sur le jeton ${sp.id}.`, { monsterId: id, at: sp.at });
    releaseDelayedCards(s, m.definitionId, rng);
  }
  return report;
}

import type { GameState, SpawnPoint } from '../domain/schemas';
import { CELL_CAPACITY, occupancy } from '../movement/board';
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
  placed: { monsterId: string; at: { x: number; y: number } }[];
  boxed: { monsterId: string; reason: string }[];
}

/**
 * Phase Spawn (rulebook p.23, solo v1.3 p.2) : si la Spawn Tile est pleine, chaque monstre, dans l'ordre des
 * emplacements, est placé sur le jeton Spawn tiré s'il existe et que sa Space n'est pas pleine ; sinon il sort
 * définitivement du jeu (boîte), y compris quand le jeton tiré n'est pas sur le plateau.
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
      report.boxed.push({ monsterId: id, reason: `aucun jeton Spawn ${a}/${b} sur le plateau` });
      log(s, 'spawn-box', `${id} : aucun jeton Spawn ${a}/${b} sur le plateau → sorti définitivement du jeu.`, { monsterId: id });
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

import type { Content, DieFaceDef, GameState, MonsterDefinition, MonsterSkill, MonsterStats } from '@/engine/domain/schemas';
import { createOracle, NeedInput, type InputAnswer, type InputRequest, type Oracle } from '@/engine/oracle';
import type { RandomSource } from '@/engine/random';
import { createGame } from '@/engine/setup';
import { startScenario } from '@/engine/turn/machine';
import { demoConfig, openBoard } from './demo';

/** Faces des dés de ces tests : un dé noir épée / critique / vide, un dé blanc bouclier / vide. */
const face = (symbol: string, over: Partial<DieFaceDef> = {}): DieFaceDef => ({ symbol, melee: false, ranged: false, crit: false, save: false, ...over });
export const SWORD = face('sword', { melee: true });
export const BOW = face('bow', { ranged: true });
export const CRIT = face('crit', { melee: true, ranged: true, crit: true });
export const BLANK = face('blank');
export const SHIELD = face('shield', { save: true });
export const ATTACK_DIE = [SWORD, BOW, CRIT, BLANK];
export const DEFENSE_DIE = [SHIELD, BLANK];

const stats = (over: Partial<MonsterStats> = {}): MonsterStats => ({ life: 3, overkill: 5, reward: 1, attackType: 'melee', attackDice: 3, movement: 1, ...over });
const def = (id: string, s: MonsterStats): MonsterDefinition => ({ id, name: id, tier: 1, levels: { '1': s } });

export const SKILL_MONSTERS: Record<string, MonsterDefinition> = {
  plain: def('plain', stats()),
  captain: def('captain', stats({ rerolls: 1 })),
  mino: def('mino', stats({ attackDice: 4, skills: ['crit-extra-wound'] as MonsterSkill[] })),
  troll: def('troll', stats({ attackDice: 4, skills: ['attack-all-adjacent'] as MonsterSkill[] })),
  spear: def('spear', stats({ attackType: 'ranged', skills: ['extra-die-next-to-monster'] as MonsterSkill[] })),
  hammer: def('hammer', stats({ attackDice: 4, skills: ['stun'] as MonsterSkill[] })),
};

export const skillContent: Content = { version: 'skills', monsters: SKILL_MONSTERS, attackDie: ATTACK_DIE, defenseDie: DEFENSE_DIE };

/**
 * Partie de test pour les compétences : plateau ouvert 8×5, trois héros (défense 0 par défaut, 3 vies sauf Grom 4), monstres
 * placés par le test. Dés matériels ou numériques au choix ; défense numérique sauf demande.
 */
export function skillGame(
  monsters: { id: string; definitionId: string; position: { x: number; y: number } }[],
  opts: { heroes?: { x: number; y: number }[]; defense?: number; settings?: Partial<GameState['settings']> } = {},
): GameState {
  const at = opts.heroes ?? [{ x: 1, y: 4 }, { x: 2, y: 4 }, { x: 0, y: 0 }];
  const config = demoConfig({
    heroes: ['h1', 'h2', 'h3'].map((id, i) => ({ id, name: ['Grom', 'Maya', 'Zazu'][i]!, life: 3, defense: opts.defense ?? 0, rerolls: 0, position: at[i]! })),
    monsters: monsters.map((m) => ({ ...m, isGuard: false })),
    board: openBoard(),
    spawnPoints: [{ id: 'S1', at: { x: 7, y: 4 }, dice: ['sword', 'sword'] }, { id: 'S2', at: { x: 0, y: 0 }, dice: ['sword', 'crit'] }, { id: 'S3', at: { x: 7, y: 0 }, dice: ['crit', 'crit'] }],
    settings: { defenseRoll: 'digital', ...opts.settings },
  });
  return startScenario(createGame(config, skillContent));
}

/** Source aléatoire qui fait sortir les faces voulues, dans l'ordre : `[dé, symbole]` (dé noir, dé blanc ou autre). */
export function scripted(list: [DieFaceDef[], string][]): RandomSource & { rolled: () => number } {
  let i = 0;
  return {
    nextInt: () => {
      const [die, symbol] = list[i++] ?? [ATTACK_DIE, 'blank'];
      return Math.max(0, die.findIndex((f) => f.symbol === symbol));
    },
    rolled: () => i,
  };
}
export const black = (...symbols: string[]): [DieFaceDef[], string][] => symbols.map((s) => [ATTACK_DIE, s]);
export const white = (...symbols: string[]): [DieFaceDef[], string][] => symbols.map((s) => [DEFENSE_DIE, s]);

/** Un oracle prêt à l'emploi sur l'état donné. */
export const oracleFor = (s: GameState, rng: RandomSource, answers: InputAnswer[] = []): Oracle => createOracle(s, skillContent, rng, answers);

/** Exécute `fn` ; renvoie le résultat, ou la saisie que le moteur réclame. */
export function tryRun<T>(fn: () => T): { result: T } | { need: InputRequest } {
  try {
    return { result: fn() };
  } catch (e) {
    if (e instanceof NeedInput) return { need: e.request };
    throw e;
  }
}

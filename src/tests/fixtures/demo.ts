import type { Board, Content, DieFaceDef, GameState, MonsterStats } from '@/engine/domain/schemas';
import { createGame, type SetupConfig } from '@/engine/setup';

/** Faces de test déterministes : symboles distincts pour piloter les tirages de spawn. */
const f = (symbol: string, o: Partial<DieFaceDef> = {}): DieFaceDef => ({
  symbol,
  melee: false,
  ranged: false,
  crit: false,
  save: false,
  ...o,
});

const stats = (o: Partial<MonsterStats> = {}): MonsterStats => ({
  life: 2,
  overkill: 4,
  reward: 1,
  attackType: 'melee',
  attackDice: 2,
  defense: 0,
  movement: 2,
  rerolls: 0,
  ...o,
});

const levels = (s: MonsterStats) => ({ '1': s, '2-3': s, '4': s, '5-6': s });

export const testContent: Content = {
  version: 'test-1',
  monsters: {
    goblin: { id: 'goblin', name: 'Goblin', tier: 1, levels: levels(stats()) },
    orc: { id: 'orc', name: 'Orc', tier: 2, levels: levels(stats({ life: 3, overkill: 6, reward: 2, defense: 1 })) },
    archer: { id: 'archer', name: 'Archer', tier: 1, levels: levels(stats({ attackType: 'ranged' })) },
  },
  attackDie: [
    f('A', { melee: true, ranged: true }),
    f('B', { melee: true, ranged: true }),
    f('C', { crit: true }),
    f('D'),
  ],
  defenseDie: [f('s', { save: true }), f('x')],
};

export const openBoard = (width = 8, height = 5): Board => ({
  width,
  height,
  holes: [],
  walls: [],
  doors: [],
  portals: [],
});

export function demoConfig(over: Partial<SetupConfig> = {}): SetupConfig {
  // Les tests moteur historiques activent tous les héros ; le réglage « un héros par tour » se teste explicitement.
  const settings = { heroActivation: 'all' as const, lineOfSight: 'rulebook' as const, defenseRoll: 'digital' as const, ...over.settings };
  return {
    sessionId: 'demo',
    scenarioId: 'demo-scenario',
    difficulty: 'medium',
    monsterCardSet: '1',
    board: openBoard(),
    spawnPoints: [
      { id: 'S1', at: { x: 0, y: 0 }, dice: ['A', 'B'] },
      { id: 'S2', at: { x: 7, y: 4 }, dice: ['C', 'D'] },
    ],
    heroes: [
      { id: 'h1', name: 'Grom', life: 4, defense: 0, position: { x: 1, y: 4 } },
      { id: 'h2', name: 'Maya', life: 3, defense: 0, position: { x: 2, y: 4 } },
      { id: 'h3', name: 'Zazu', life: 3, defense: 0, position: { x: 1, y: 3 } },
    ],
    monsters: [
      { id: 'g1', definitionId: 'goblin', position: { x: 4, y: 2 } },
      { id: 'o1', definitionId: 'orc', position: { x: 6, y: 1 } },
      { id: 'o2', definitionId: 'orc', position: { x: 7, y: 0 }, isGuard: true },
    ],
    quests: [
      { id: 'q1', title: 'Quête 1' },
      { id: 'q2', title: 'Quête 2' },
    ],
    seed: 1234,
    ...over,
    settings,
  };
}

export function demoGame(over: Partial<SetupConfig> = {}): GameState {
  return createGame(demoConfig(over), testContent);
}

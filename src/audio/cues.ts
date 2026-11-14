import type { GameEvent, Phase } from '@/engine/domain/schemas';

/** Effets sonores. Chaque nom décrit un moment du jeu, pas un son : on peut remplacer le son sans toucher au reste. */
export const CUES = ['click', 'dice', 'step', 'heavy-step', 'hit', 'hurt', 'death', 'spawn', 'door', 'quest', 'story', 'danger', 'rest', 'start', 'victory', 'defeat'] as const;
export type Cue = (typeof CUES)[number];

/** Ambiances musicales : une par moment de la partie. */
export type Mood = 'calm' | 'tense' | 'victory' | 'defeat';

/** Quel(s) effet(s) jouer pour un événement du journal. Les événements sans conséquence sonore n'en produisent aucun. */
const BY_EVENT_TYPE: Record<string, Cue[]> = {
  'scenario-start': ['start'],
  'hero-move': ['step'],
  'monster-move': ['heavy-step'],
  'monster-attack': ['dice', 'hit'],
  payback: ['hit'],
  wound: ['hurt'],
  'hero-death': ['death'],
  'spawn-place': ['spawn'],
  'script-spawn': ['spawn'],
  'script-door': ['door'],
  'hero-door': ['door'],
  'quest-completed': ['quest'],
  'guild-rest': ['rest'],
  'hero-resurrected': ['rest'],
  'scenario-won': ['victory'],
  'scenario-lost': ['defeat'],
};

/** Au plus quelques sons par action : au-delà, ce serait du bruit. */
const MAX_CUES_PER_BATCH = 5;

export function cuesForEvents(events: readonly Pick<GameEvent, 'type'>[]): Cue[] {
  const out: Cue[] = [];
  for (const e of events) {
    for (const c of BY_EVENT_TYPE[e.type] ?? []) {
      // Un même son deux fois de suite (plusieurs pas, plusieurs blessures) ne se joue qu'une fois.
      if (out[out.length - 1] !== c) out.push(c);
    }
  }
  return out.slice(0, MAX_CUES_PER_BATCH);
}

/** Récit : un danger a son propre son ; une quête accomplie est déjà annoncée par l'événement de quête. */
export function cueForBeat(tone: 'story' | 'quest' | 'danger'): Cue | null {
  return tone === 'danger' ? 'danger' : tone === 'story' ? 'story' : null;
}

export function moodFor(phase: Phase): Mood {
  switch (phase) {
    case 'MONSTER_TURN_SPAWN':
    case 'MONSTER_TURN_ACTIVATION_1':
    case 'MONSTER_TURN_ACTIVATION_2':
    case 'DRAGON_TURN':
      return 'tense';
    case 'SCENARIO_WON':
      return 'victory';
    case 'SCENARIO_LOST':
      return 'defeat';
    default:
      return 'calm';
  }
}

import type { GameState, Phase, Position } from '../domain/schemas';
import { CELL_CAPACITY, occupancy } from '../movement/board';
import { blockedByOtherHero, checkEnd, cloneState, isTerminal, log, oneHeroPerTurn } from '../state';

/** Transitions autorisées (plan §7.2). Centralisées : toute autre transition est rejetée. */
const ALLOWED: Record<Phase, Phase[]> = {
  SCENARIO_SETUP: ['GUILD_TURN', 'DRAGON_TURN'],
  GUILD_TURN: ['MONSTER_TURN_SPAWN', 'DRAGON_TURN', 'SCENARIO_WON', 'SCENARIO_LOST'],
  MONSTER_TURN_SPAWN: ['MONSTER_TURN_ACTIVATION_1', 'SCENARIO_LOST', 'SCENARIO_WON'],
  MONSTER_TURN_ACTIVATION_1: ['MONSTER_TURN_ACTIVATION_2', 'GUILD_TURN', 'SCENARIO_LOST', 'SCENARIO_WON'],
  MONSTER_TURN_ACTIVATION_2: ['GUILD_TURN', 'SCENARIO_LOST', 'SCENARIO_WON'],
  DRAGON_TURN: ['GUILD_TURN', 'SCENARIO_LOST', 'SCENARIO_WON'],
  SCENARIO_WON: [],
  SCENARIO_LOST: [],
};

export function canTransition(from: Phase, to: Phase): boolean {
  return ALLOWED[from].includes(to);
}

export function transition(s: GameState, to: Phase): void {
  if (!canTransition(s.phase, to)) throw new Error(`Transition invalide : ${s.phase} → ${to}`);
  s.phase = to;
}

/** Démarre le scénario : manche 1, Guild Turn (ou Dragon Turn en Partie 2). */
export function startScenario(state: GameState): GameState {
  const s = cloneState(state);
  if (s.phase !== 'SCENARIO_SETUP') throw new Error(`Scénario déjà démarré (${s.phase})`);
  s.round = 1;
  s.activatedHeroIds = [];
  transition(s, s.dragonPart2 ? 'DRAGON_TURN' : 'GUILD_TURN');
  log(s, 'scenario-start', `Début du scénario ${s.scenarioId}.`);
  return s;
}

const livingHeroes = (s: GameState) => s.heroes.filter((h) => !h.dead);

/** Marque l'activation d'un héros (déplacement et attaque sont joués physiquement, ordre libre). */
export function activateHero(state: GameState, heroId: string): GameState {
  const s = cloneState(state);
  if (s.phase !== 'GUILD_TURN') throw new Error(`Activation impossible en phase ${s.phase}`);
  const h = s.heroes.find((x) => x.id === heroId);
  if (!h) throw new Error(`Héros inconnu : ${heroId}`);
  if (h.dead) throw new Error(`${h.name} est mort : il ne peut pas être activé`);
  if (s.activatedHeroIds.includes(heroId)) throw new Error(`${h.name} a déjà été activé ce tour`);
  if (blockedByOtherHero(s, heroId)) {
    throw new Error('Un seul héros est activé par tour (le même peut l’être plusieurs tours de suite)');
  }
  s.activatedHeroIds.push(heroId);
  s.heroTurn[heroId] ??= { mpLeft: 3, moved: false, attacked: false };
  log(s, 'hero-activated', `${h.name} est activé.`, { heroId });
  return s;
}

/** Riders : la monture est activée une fois par Guild Turn (3 PM), en même temps que les héros. */
export function activateMount(state: GameState, mountId: string): GameState {
  const s = cloneState(state);
  if (!s.expansions.includes('riders')) throw new Error('Extension Riders non activée');
  if (s.phase !== 'GUILD_TURN') throw new Error(`Activation impossible en phase ${s.phase}`);
  const m = s.mounts.find((x) => x.id === mountId);
  if (!m || m.dead) throw new Error(`Monture indisponible : ${mountId}`);
  if (s.activatedHeroIds.includes(mountId)) throw new Error(`${m.name} a déjà été activée ce tour`);
  s.activatedHeroIds.push(mountId);
  log(s, 'mount-activated', `${m.name} est activée.`, { mountId });
  return s;
}

/** Pets : chaque familier est activé une fois avec les héros, jamais pendant un repos. */
export function activatePet(state: GameState, petId: string): GameState {
  const s = cloneState(state);
  if (!s.expansions.includes('pets')) throw new Error('Extension Pets non activée');
  if (s.phase !== 'GUILD_TURN') throw new Error(`Activation impossible en phase ${s.phase}`);
  const p = s.pets.find((x) => x.id === petId);
  if (!p || p.dead) throw new Error(`Familier indisponible : ${petId}`);
  if (s.activatedHeroIds.includes(petId)) throw new Error(`${p.name} a déjà été activé ce tour`);
  s.activatedHeroIds.push(petId);
  log(s, 'pet-activated', `${p.name} est activé.`, { petId });
  return s;
}

function endGuildTurn(s: GameState): void {
  s.activatedHeroIds = [];
  s.heroTurn = {};
  if (isTerminal(s.phase)) return;
  checkEnd(s);
  if (isTerminal(s.phase)) return;
  if (s.dragonPart2) {
    s.round += 1;
    transition(s, 'DRAGON_TURN');
  } else {
    transition(s, 'MONSTER_TURN_SPAWN');
  }
}

/** Fin de l'activation : tous les héros vivants activés (solo v1.3 p.2), ou un seul héros activé en mode « un héros par tour ». */
export function finishHeroActivations(state: GameState): GameState {
  const s = cloneState(state);
  if (s.phase !== 'GUILD_TURN') throw new Error(`Fin de tour impossible en phase ${s.phase}`);
  if (!oneHeroPerTurn(s)) {
    const pending = livingHeroes(s).filter((h) => !s.activatedHeroIds.includes(h.id));
    if (pending.length) throw new Error(`Héros non activés : ${pending.map((h) => h.name).join(', ')}`);
  } else if (s.activatedHeroIds.length === 0) {
    throw new Error('Activez un héros ou reposez la guilde');
  }
  log(s, 'guild-turn-end', 'Tour de guilde terminé (héros activés).');
  endGuildTurn(s);
  return s;
}

/**
 * Repos : aucun héros activé, jetons de guilde retirés (physique), héros morts ressuscités sans blessure sur
 * la zone de départ ou Close d'un allié (positions fournies par le joueur), puis Monster Turn (rulebook p.18).
 */
export function restGuild(state: GameState, resurrectAt: Record<string, Position> = {}): GameState {
  const s = cloneState(state);
  if (s.phase !== 'GUILD_TURN') throw new Error(`Repos impossible en phase ${s.phase}`);
  if (s.activatedHeroIds.length) throw new Error('Des héros ont déjà été activés : le repos est exclu ce tour');
  for (const h of s.heroes.filter((x) => x.dead)) {
    const at = resurrectAt[h.id];
    if (!at) throw new Error(`Position de résurrection requise pour ${h.name}`);
    const o = occupancy(s, at, h.id);
    if (o.heroes + o.monsters + o.pets >= CELL_CAPACITY) throw new Error(`La case choisie pour ${h.name} est déjà occupée : une seule figurine par case`);
    h.dead = false;
    h.wounds = 0;
    h.position = { ...at };
    log(s, 'hero-resurrected', `${h.name} est ressuscité en (${at.x},${at.y}).`, { heroId: h.id });
  }
  for (const h of s.heroes) for (const w of h.weapons ?? []) w.exhausted = false;
  log(s, 'guild-rest', 'La guilde se repose : jetons retirés des cartes, cartes réorganisables.');
  endGuildTurn(s);
  return s;
}

/** Terrain d'essai : passe directement au Monster Turn, sans activer de héros ni se reposer. */
export function skipGuildTurn(state: GameState): GameState {
  const s = cloneState(state);
  if (s.phase !== 'GUILD_TURN') throw new Error(`Pas de tour de guilde à sauter en phase ${s.phase}`);
  log(s, 'guild-skip', 'Terrain d\'essai : tour de guilde sauté.');
  endGuildTurn(s);
  return s;
}

/** Dragon Partie 2 : la carte Dragon Turn est piochée, exécutée physiquement puis défaussée. */
export function completeDragonTurn(state: GameState, cardLabel: string): GameState {
  const s = cloneState(state);
  if (s.phase !== 'DRAGON_TURN') throw new Error(`Pas de Dragon Turn en phase ${s.phase}`);
  log(s, 'dragon-turn', `Dragon Turn : ${cardLabel}`);
  transition(s, 'GUILD_TURN');
  return s;
}

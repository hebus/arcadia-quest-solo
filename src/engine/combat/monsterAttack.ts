import type { PhysicalInstruction } from '../activation/monsterTurn';
import type { Content, GameState, Hero, Pet, Position } from '../domain/schemas';
import { isClose } from '../movement/board';
import { statsOfMonster } from '../monsters';
import type { AttackContext, AttackTarget, Oracle } from '../oracle';
import type { AttackOutcome } from './dice';
import { log } from '../state';
import { damageHero, damagePet } from './damage';

/** Issue de l'attaque d'un monstre sur une cible. */
export interface StrikeResult {
  targetId: string;
  targetKind: 'hero' | 'pet';
  targetName: string;
  outcome: AttackOutcome;
  /** Case de la cible avant les blessures (pour retirer sa figurine si elle tombe). */
  at: Position | null;
  /** La cible est morte de cette attaque. */
  died: boolean;
  /** Le héros est étourdi par cette attaque (compétence du Hammer Beastman). */
  stunned: boolean;
}

/**
 * Attaque d'un monstre : point d'entrée unique (activation, réaction Guard, Payback). Applique les compétences du monstre :
 * - relances de l'attaque (`rerolls`, ex. Orc Captain) ;
 * - `extra-die-next-to-monster` : un dé d'attaque de plus si un autre monstre est Close à lui (Spear Beastman) ;
 * - `crit-extra-wound` : chaque critique donne une blessure en plus, non parable (Minotaur) ;
 * - `attack-all-adjacent` : un seul jet d'attaque, puis chaque héros Close au monstre se défend contre les mêmes touches (Troll) ;
 * - `stun` : si au moins une blessure passe et que le héros survit, il est étourdi (Hammer Beastman).
 * Renvoie un résultat par cible (la cible principale d'abord), blessures déjà appliquées.
 */
export function monsterStrike(
  s: GameState,
  content: Content,
  oracle: Oracle,
  monsterId: string,
  targetId: string,
  opts: { purpose: string; cause: string },
): StrikeResult[] {
  const m = s.monsters.find((x) => x.id === monsterId)!;
  const stats = statsOfMonster(content, s, m)!;
  const skills = stats.skills ?? [];
  const mainHero = s.heroes.find((h) => h.id === targetId);
  const mainPet = s.pets.find((p) => p.id === targetId);

  // Un dé de plus si un autre monstre du plateau est Close à celui-ci (même Space comprise).
  const crowded = !!m.position && s.monsters.some((o) => o.id !== m.id && o.status === 'board' && o.position && isClose(s.board, m.position!, o.position));
  const attackDice = stats.attackDice + (skills.includes('extra-die-next-to-monster') && crowded ? 1 : 0);

  const base = {
    attackDice,
    attackType: stats.attackType,
    attackerRerolls: stats.rerolls ?? 0,
    purpose: opts.purpose,
    attackerId: monsterId,
    attackerAt: m.position,
    ...(skills.includes('crit-extra-wound') ? { critWounds: true } : {}),
  };

  // Cibles : la cible principale, plus (Troll) tous les autres héros vivants Close au monstre.
  const heroes: Hero[] = mainHero ? [mainHero] : [];
  if (mainHero && skills.includes('attack-all-adjacent') && m.position) {
    for (const h of s.heroes) if (h.id !== mainHero.id && !h.dead && h.position && isClose(s.board, m.position, h.position)) heroes.push(h);
  }

  const results: { target: Hero | Pet; kind: 'hero' | 'pet'; outcome: AttackOutcome }[] = [];
  if (heroes.length > 1) {
    const targets: AttackTarget[] = heroes.map((h) => ({ targetId: h.id, targetName: h.name, defenseDice: h.defense, defenderRerolls: h.rerolls, targetAt: h.position }));
    const outcomes = oracle.attackMany(base, targets);
    heroes.forEach((h, i) => results.push({ target: h, kind: 'hero', outcome: outcomes[i]! }));
  } else {
    const target = mainHero ?? mainPet;
    if (!target) throw new Error(`Cible inconnue : ${targetId}`);
    const ctx: AttackContext = {
      ...base,
      defenseDice: target.defense,
      defenderRerolls: mainHero?.rerolls ?? 0,
      defenderIsHero: !!mainHero,
      targetName: target.name,
      targetId,
      targetAt: target.position,
    };
    results.push({ target, kind: mainHero ? 'hero' : 'pet', outcome: oracle.attack(ctx) });
  }

  return results.map(({ target, kind, outcome }) => {
    const at = target.position ? { ...target.position } : null;
    const died = kind === 'hero' ? damageHero(s, target.id, outcome.wounds, opts.cause) : damagePet(s, target.id, outcome.wounds, opts.cause);
    let stunned = false;
    if (kind === 'hero' && skills.includes('stun') && outcome.wounds > 0 && !died) {
      (target as Hero).stunned = true;
      stunned = true;
      log(s, 'hero-stunned', `${target.name} est étourdi.`, { heroId: target.id });
    }
    return { targetId: target.id, targetKind: kind, targetName: target.name, outcome, at, died, stunned };
  });
}

/** Étape sur la table pour un héros étourdi : poser son jeton Étourdi. */
export function stunInstruction(id: string, r: StrikeResult): PhysicalInstruction {
  return { id, kind: 'info', text: `${r.targetName} est étourdi : poser un jeton Étourdi.`, actorId: r.targetId };
}

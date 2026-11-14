import type { GameState, Position } from '@/engine/domain/schemas';
import type { VisualAction } from '@/engine/visual';

export type ActorKind = 'hero' | 'monster' | 'pet' | 'mount';

export interface ActorInfo {
  kind: ActorKind;
  label: string;
  name: string;
}

/** Type et étiquette d'un personnage, identiques à ceux des pions du plateau. */
export function actorInfo(g: GameState, id: string): ActorInfo {
  const hero = g.heroes.find((h) => h.id === id);
  if (hero) return { kind: 'hero', label: hero.name.slice(0, 2).toUpperCase(), name: hero.name };
  const monster = g.monsters.find((m) => m.id === id);
  if (monster) return { kind: 'monster', label: monster.definitionId.slice(0, 2).toUpperCase(), name: monster.definitionId };
  const pet = g.pets.find((p) => p.id === id);
  if (pet) return { kind: 'pet', label: pet.name.slice(0, 2).toUpperCase(), name: pet.name };
  const mount = g.mounts.find((m) => m.id === id);
  if (mount) return { kind: 'mount', label: mount.name.slice(0, 2).toUpperCase(), name: mount.name };
  return { kind: 'monster', label: id.slice(0, 2).toUpperCase(), name: id };
}

export interface GhostMarker {
  id: string;
  at: Position;
  label: string;
  kind: ActorKind;
}

export interface RingMarker {
  at: Position;
  tone: 'attacker' | 'target' | 'spawn' | 'active';
  /** Texte court affiché sur la case (ex. « −2 » blessures). */
  badge?: string;
}

/** Ce que le plateau doit montrer pour une étape : aucune coordonnée à lire, tout est dessiné. */
export interface InstructionOverlay {
  /** Figurine à la case cible, pulsante : « posez-la ici ». */
  ghosts: GhostMarker[];
  /** Flèches animées le long du trajet exact. */
  arrows: { points: Position[]; tone: 'move' | 'attack' }[];
  /** Figurines à retirer, marquées d'une croix. */
  removals: (GhostMarker & { reason: 'removed' })[];
  rings: RingMarker[];
  /** Portes qui s'ouvrent pendant l'étape. */
  doorIds: string[];
  /** Personnage à afficher à sa case de départ (c'est lui que le joueur fait glisser vers la cible). */
  tokenAt: Record<string, Position>;
  /** Pions du plateau à masquer pendant l'étape (remplacés par le fantôme). */
  hideTokens: string[];
  /** Figurines encore physiquement sur le plateau alors que l'état les a déjà retirées (étapes suivantes). */
  extraTokens: GhostMarker[];
  /** Glisser `actorId` sur `at` termine l'étape. */
  dropTarget?: { actorId: string; at: Position };
  focus?: Position;
}

export const emptyOverlay = (): InstructionOverlay => ({ ghosts: [], arrows: [], removals: [], rings: [], doorIds: [], tokenAt: {}, hideTokens: [], extraTokens: [] });

const last = <T>(a: T[]): T => a[a.length - 1]!;

/**
 * Convertit une action visuelle du moteur en éléments de plateau. `g` est l'état APRÈS l'action : le personnage
 * est donc déjà à sa case d'arrivée, ce que l'on masque pour le montrer à son départ.
 */
export function overlayFor(v: VisualAction, g: GameState): InstructionOverlay {
  const o = emptyOverlay();
  switch (v.type) {
    case 'place': {
      const a = actorInfo(g, v.actorId);
      o.ghosts.push({ id: v.actorId, at: v.at, label: a.label, kind: a.kind });
      o.hideTokens.push(v.actorId);
      o.focus = v.at;
      break;
    }
    case 'move': {
      const a = actorInfo(g, v.actorId);
      const from = v.path[0]!;
      const to = last(v.path);
      o.arrows.push({ points: v.path, tone: 'move' });
      o.ghosts.push({ id: v.actorId, at: to, label: a.label, kind: a.kind });
      o.tokenAt[v.actorId] = from;
      o.hideTokens.push(v.actorId);
      o.doorIds.push(...v.doorIds);
      o.dropTarget = { actorId: v.actorId, at: to };
      o.focus = to;
      break;
    }
    case 'remove': {
      if (v.at) {
        const a = actorInfo(g, v.actorId);
        o.removals.push({ id: v.actorId, at: v.at, label: a.label, kind: a.kind, reason: 'removed' });
        o.focus = v.at;
      }
      break;
    }
    case 'attack': {
      const attacker = g.heroes.find((h) => h.id === v.attackerId)?.position ?? g.monsters.find((m) => m.id === v.attackerId)?.position;
      const target =
        g.heroes.find((h) => h.id === v.targetId)?.position ??
        g.monsters.find((m) => m.id === v.targetId)?.position ??
        g.pets.find((p) => p.id === v.targetId)?.position;
      if (attacker) o.rings.push({ at: attacker, tone: 'attacker' });
      if (target) {
        o.rings.push({ at: target, tone: 'target', badge: v.wounds > 0 ? `−${v.wounds}` : '0' });
        o.focus = target;
      }
      if (attacker && target) o.arrows.push({ points: [attacker, target], tone: 'attack' });
      break;
    }
    case 'door': {
      o.doorIds.push(v.doorId);
      // Case servant à valider l'étape : celle du côté « a » de la porte.
      o.focus = g.board.doors.find((d) => d.id === v.doorId)?.a;
      break;
    }
    case 'activate': {
      o.rings.push({ at: v.at, tone: 'active' });
      o.focus = v.at;
      break;
    }
    case 'spawn-point': {
      o.rings.push({ at: v.at, tone: 'spawn' });
      o.focus = v.at;
      break;
    }
  }
  return o;
}

/**
 * Vue d'une file d'étapes : la première est montrée en détail, les suivantes sont seulement « pas encore jouées » —
 * leurs figurines restent affichées à leur case d'avant (départ d'un déplacement, case d'une figurine à retirer,
 * absence d'une figurine à poser), car la table n'a pas encore bougé. Sans cela le miroir afficherait déjà l'état final.
 */
export function overlayForQueue(visuals: VisualAction[], g: GameState): InstructionOverlay {
  if (visuals.length === 0) return emptyOverlay();
  const o = overlayFor(visuals[0]!, g);
  for (const v of visuals.slice(1)) {
    if (v.type === 'move') {
      if (!(v.actorId in o.tokenAt) && !o.hideTokens.includes(v.actorId)) o.tokenAt[v.actorId] = v.path[0]!;
    } else if (v.type === 'place') {
      if (!o.hideTokens.includes(v.actorId)) o.hideTokens.push(v.actorId);
    } else if (v.type === 'remove' && v.at && !o.removals.some((r) => r.id === v.actorId)) {
      const a = actorInfo(g, v.actorId);
      o.extraTokens.push({ id: v.actorId, at: v.at, label: a.label, kind: a.kind });
    }
  }
  return o;
}

/** Attaque annoncée avant la saisie des dés : anneaux sur l'attaquant et la cible, flèche rouge de l'un à l'autre. */
export function overlayForAttackAnnouncement(e: { attackerId: string; targetId: string; attackerAt: Position | null; targetAt: Position | null }): InstructionOverlay {
  const o = emptyOverlay();
  if (e.attackerAt) {
    o.rings.push({ at: e.attackerAt, tone: 'attacker' });
    // La simulation a déjà déplacé l'attaquant : on le montre là où il attaque.
    o.tokenAt[e.attackerId] = e.attackerAt;
  }
  if (e.targetAt) {
    o.rings.push({ at: e.targetAt, tone: 'target' });
    o.tokenAt[e.targetId] = e.targetAt;
    o.focus = e.targetAt;
  }
  if (e.attackerAt && e.targetAt) o.arrows.push({ points: [e.attackerAt, e.targetAt], tone: 'attack' });
  return o;
}

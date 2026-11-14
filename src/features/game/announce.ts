import type { Position } from '@/engine/domain/schemas';
import { useGameStore } from '@/stores/gameStore';

export interface AttackAnnouncement {
  /** Identifie cette saisie : une annonce n'est montrée qu'une fois. */
  key: string;
  attackerId: string;
  targetId: string;
  attackerAt: Position | null;
  targetAt: Position | null;
  /** Le joueur a vu qui attaque qui : le dialogue de dés peut s'ouvrir. */
  acknowledge(): void;
}

/**
 * Avant de demander au joueur de lancer ses dés pour l'attaque d'un monstre, le plateau montre qui attaque qui.
 * Renvoie l'annonce tant que le joueur ne l'a pas validée, sinon `null` (le dialogue de dés peut s'ouvrir).
 */
export function useAttackAnnouncement(): AttackAnnouncement | null {
  const stepsPending = useGameStore((s) => s.instructions.some((i) => !i.confirmed));
  const request = useGameStore((s) => (s.agent.status === 'awaiting-input' ? s.agent.request : undefined));
  const answered = useGameStore((s) => s.answers.length);
  const acked = useGameStore((s) => s.ackedRequestKey);
  const ack = useGameStore((s) => s.ackRequest);
  // Dans l'ordre : d'abord les étapes à jouer sur la table (apparitions, déplacements), puis l'annonce, puis les dés.
  if (stepsPending) return null;
  if (!request || (request.kind !== 'attack-result' && request.kind !== 'defense-result')) return null;
  if (!request.attackerId || !request.targetId) return null;
  const key = `${request.purpose}|${answered}`;
  if (acked === key) return null;
  return {
    key,
    attackerId: request.attackerId,
    targetId: request.targetId,
    attackerAt: request.attackerAt ?? null,
    targetAt: request.targetAt ?? null,
    acknowledge: () => ack(key),
  };
}

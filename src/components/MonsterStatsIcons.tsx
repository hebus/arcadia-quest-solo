import { MONSTER_SKILLS } from '@/engine/monsters';
import type { MonsterStats } from '@/engine/domain/schemas';

/** Une caractéristique : icône, valeur, et libellé complet pour l'infobulle et les lecteurs d'écran. */
function Stat({ icon, value, label, tone = '' }: { icon: string; value?: string | number; label: string; tone?: string }) {
  return (
    <li className={`flex items-center gap-1 rounded-lg bg-stone-900 px-2 py-1 ${tone}`} title={label} aria-label={value === undefined ? label : `${label} : ${value}`}>
      <span aria-hidden="true">{icon}</span>
      {value !== undefined && <span className="font-semibold" aria-hidden="true">{value}</span>}
    </li>
  );
}

/**
 * Caractéristiques d'un monstre en icônes : vie, overkill (crâne, à côté de la vie), mouvement, attaque (type et dés),
 * défense, relances, récompense, compétences.
 */
export function MonsterStatsIcons({ stats, wounds = 0 }: { stats: MonsterStats; wounds?: number }) {
  return (
    <ul className="flex flex-wrap gap-1.5 text-sm" data-testid="monster-stats" aria-label="Caractéristiques">
      <Stat icon="❤" value={`${Math.max(0, stats.life - wounds)}/${stats.life}`} label="Points de vie" tone="text-red-300" />
      <Stat icon="💀" value={stats.overkill} label="Overkill : blessures pour tuer sur le coup" />
      <Stat icon="👣" value={stats.movement} label="Mouvement" />
      <Stat icon={stats.attackType === 'melee' ? '⚔' : '🏹'} label={stats.attackType === 'melee' ? 'Attaque en mêlée' : 'Attaque à distance'} />
      <Stat icon="🎲" value={stats.attackDice} label="Dés d’attaque" />
      {!!stats.defense && <Stat icon="🛡" value={stats.defense} label="Dés de défense" />}
      {!!stats.rerolls && <Stat icon="🔁" value={stats.rerolls} label="Relances de l’attaque" />}
      <Stat icon="🪙" value={stats.reward} label="Récompense" tone="text-amber-300" />
      {(stats.skills ?? []).map((k) => (
        <Stat key={k} icon="✦" value={k === 'crit-extra-wound' ? 'critique+' : k === 'attack-all-adjacent' ? 'zone' : k === 'extra-die-next-to-monster' ? 'meute' : 'étourdit'} label={MONSTER_SKILLS[k]} tone="text-amber-200" />
      ))}
    </ul>
  );
}

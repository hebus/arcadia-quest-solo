import type { GuildHero } from '@/engine/guild';
import { useGuildStore } from '@/stores/guildStore';

/** Guilde fixe pour les tests d'interface (par défaut, les noms sont tirés au hasard). */
export const TEST_GUILD: readonly GuildHero[] = [
  { name: 'Grom', life: 3 },
  { name: 'Maya', life: 3 },
  { name: 'Zazu', life: 3 },
];

export const resetTestGuild = (): void => useGuildStore.setState({ heroes: TEST_GUILD.map((h) => ({ ...h })), loaded: true });

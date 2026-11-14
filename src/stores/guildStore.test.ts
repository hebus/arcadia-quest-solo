import { beforeEach, describe, expect, it } from 'vitest';
import { HERO_NAMES, guildProblems } from '@/engine/guild';
import type { Repository } from '@/infrastructure/persistence/repository';
import { setGuildRepository, useGuildStore } from './guildStore';

const FIXED = [{ name: 'Aldric', life: 3 }, { name: 'Brunhild', life: 3 }, { name: 'Cassian', life: 3 }];

describe('la guilde est gardée sur l’appareil', () => {
  const prefs = new Map<string, unknown>();
  const repo = { setPref: async (k: string, v: unknown) => void prefs.set(k, v), getPref: async (k: string) => prefs.get(k) } as unknown as Repository;
  beforeEach(() => {
    prefs.clear();
    setGuildRepository(repo);
    useGuildStore.setState({ heroes: FIXED.map((h) => ({ ...h })), loaded: false });
  });

  it('un nom et des points de vie modifiés sont enregistrés, puis relus au prochain lancement', async () => {
    const s = useGuildStore.getState();
    s.setName(0, 'Grom');
    s.setLife(0, 5);
    expect(prefs.get('guild')).toEqual([{ name: 'Grom', life: 5 }, { name: 'Brunhild', life: 3 }, { name: 'Cassian', life: 3 }]);
    useGuildStore.setState({ heroes: FIXED.map((h) => ({ ...h })), loaded: false });
    await useGuildStore.getState().load();
    expect(useGuildStore.getState().heroes[0]).toEqual({ name: 'Grom', life: 5 });
    expect(useGuildStore.getState().loaded).toBe(true);
  });

  it('les points de vie restent entre 1 et 20', () => {
    const s = useGuildStore.getState();
    s.setLife(1, 99);
    s.setLife(2, -4);
    expect(useGuildStore.getState().heroes.map((h) => h.life)).toEqual([3, 20, 1]);
  });

  it('la première fois, une guilde aux noms tirés au hasard est enregistrée : les mêmes noms reviennent au lancement suivant', async () => {
    await useGuildStore.getState().load(); // rien d'enregistré
    const first = useGuildStore.getState().heroes;
    expect(guildProblems(first)).toEqual([]);
    for (const h of first) expect(HERO_NAMES).toContain(h.name);
    expect(prefs.get('guild')).toEqual(first);
    useGuildStore.setState({ heroes: FIXED.map((h) => ({ ...h })), loaded: false }); // nouveau lancement
    await useGuildStore.getState().load();
    expect(useGuildStore.getState().heroes).toEqual(first);
  });
});

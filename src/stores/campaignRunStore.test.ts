import { beforeEach, describe, expect, it } from 'vitest';
import type { GameState } from '@/engine/domain/schemas';
import type { Repository } from '@/infrastructure/persistence/repository';
import { CAMPAIGN, CHAPTER_IDS, setCampaignRunRepository, useCampaignRunStore } from './campaignRunStore';

const prefs = new Map<string, unknown>();
const repo = { setPref: async (k: string, v: unknown) => void prefs.set(k, v), getPref: async (k: string) => prefs.get(k) } as unknown as Repository;
const game = (scenarioId: string, over: Partial<Pick<GameState, 'sessionId' | 'phase' | 'coins'>> = {}) =>
  ({ sessionId: `s-${scenarioId}`, scenarioId, phase: 'SCENARIO_WON', coins: 2, deaths: 0, quests: [{ id: 'q', title: 'Q', done: true }], ...over }) as unknown as GameState;
const store = () => useCampaignRunStore.getState();

beforeEach(() => {
  prefs.clear();
  setCampaignRunRepository(repo);
  useCampaignRunStore.setState({ run: null, loaded: false });
});

describe('la progression de la campagne est gardée sur l’appareil', () => {
  it('la campagne a trois chapitres : le scénario 1 puis deux nouveaux', () => {
    expect(CHAPTER_IDS).toEqual(['cave-aux-cendres', 'marche-aux-ombres', 'forge-du-maitre-fer']);
    expect(CAMPAIGN.chapters).toHaveLength(3);
  });

  it('commencer la campagne l’enregistre ; elle est relue au lancement suivant', async () => {
    store().start();
    expect(prefs.get('campaign-run')).toMatchObject({ campaignId: CAMPAIGN.id, attempts: [] });
    useCampaignRunStore.setState({ run: null, loaded: false }); // nouveau lancement
    await store().load();
    expect(store().run).toMatchObject({ campaignId: CAMPAIGN.id });
    expect(store().loaded).toBe(true);
  });

  it('un chapitre terminé est enregistré, puis relu après rechargement avec ses PO', async () => {
    store().start();
    store().record(game('cave-aux-cendres'));
    expect(store().run!.attempts).toHaveLength(1);
    useCampaignRunStore.setState({ run: null, loaded: false });
    await store().load();
    expect(store().run!.attempts[0]).toMatchObject({ scenarioId: 'cave-aux-cendres', won: true, coinsWon: 3 });
  });

  it('sans campagne commencée, une partie terminée n’est pas enregistrée', () => {
    store().record(game('cave-aux-cendres'));
    expect(store().run).toBeNull();
    expect(prefs.has('campaign-run')).toBe(false);
  });

  it('une partie enregistrée deux fois ne compte qu’une fois ; un scénario hors campagne est ignoré', () => {
    store().start();
    store().record(game('cave-aux-cendres'));
    store().record(game('cave-aux-cendres'));
    store().record(game('terrain-essai'));
    expect(store().run!.attempts).toHaveLength(1);
  });

  it('on ne peut pas enregistrer un chapitre verrouillé', () => {
    store().start();
    store().record(game('forge-du-maitre-fer'));
    expect(store().run!.attempts).toHaveLength(0);
  });

  it('recommencer efface la progression', () => {
    store().start();
    store().record(game('cave-aux-cendres'));
    store().reset();
    expect(store().run).toBeNull();
    expect(prefs.get('campaign-run')).toBeNull();
    store().start();
    expect(store().run!.attempts).toHaveLength(0);
  });

  it('une sauvegarde illisible ou d’une autre campagne est ignorée au chargement', async () => {
    prefs.set('campaign-run', { campaignId: 'autre', startedAt: 1, attempts: [] });
    await store().load();
    expect(store().run).toBeNull();
    prefs.set('campaign-run', 42);
    useCampaignRunStore.setState({ loaded: false });
    await store().load();
    expect(store().run).toBeNull();
  });
});

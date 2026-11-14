import { beforeEach, describe, expect, it } from 'vitest';
import { chapterProgress, nextChapter, totalGold } from '@/engine/campaignRun';
import type { GameState } from '@/engine/domain/schemas';
import type { Repository } from '@/infrastructure/persistence/repository';
import { CHAPTER_IDS, MEDIUM_CAMPAIGN, MEDIUM_IDS, activeCampaignFor, setCampaignRunRepository, useCampaignRunStore } from './campaignRunStore';

const prefs = new Map<string, unknown>();
const repo = { setPref: async (k: string, v: unknown) => void prefs.set(k, v), getPref: async (k: string) => JSON.parse(JSON.stringify(prefs.get(k) ?? null)) } as unknown as Repository;
const game = (scenarioId: string, over: Partial<Pick<GameState, 'sessionId' | 'phase' | 'coins'>> = {}) =>
  ({ sessionId: `s-${scenarioId}-${over.phase ?? 'W'}-${over.coins ?? 2}`, scenarioId, phase: 'SCENARIO_WON', coins: 2, deaths: 0, quests: [{ id: 'q', title: 'Q', done: true }], ...over }) as unknown as GameState;
const store = () => useCampaignRunStore.getState();

beforeEach(() => {
  prefs.clear();
  setCampaignRunRepository(repo);
  useCampaignRunStore.setState({ run: null, random: null, medium: null, loaded: false });
});

describe('la campagne moyenne « Le Siège de Val-Noir » : progression', () => {
  it('commencer : le chapitre 1 est à jouer, les quatre autres verrouillés, 0 PO', () => {
    store().startMedium();
    expect(chapterProgress(store().medium, MEDIUM_IDS).map((c) => c.state)).toEqual(['todo', 'locked', 'locked', 'locked', 'locked']);
    expect(totalGold(store().medium)).toBe(0);
    expect(nextChapter(store().medium, MEDIUM_IDS)).toBe(0);
  });

  it('gagner un chapitre déverrouille le suivant, les PO se cumulent, une défaite se rejoue, une partie ne compte qu’une fois', () => {
    store().startMedium();
    store().record(game(MEDIUM_IDS[0]!, { coins: 4 })); // 4 monstres + 1 quête = 5 PO
    expect(chapterProgress(store().medium, MEDIUM_IDS).map((c) => c.state)).toEqual(['won', 'todo', 'locked', 'locked', 'locked']);
    store().record(game(MEDIUM_IDS[1]!, { phase: 'SCENARIO_LOST', coins: 1 }));
    expect(chapterProgress(store().medium, MEDIUM_IDS)[1]!.state).toBe('retry');
    store().record(game(MEDIUM_IDS[1]!, { phase: 'SCENARIO_LOST', coins: 1 })); // même partie : ignorée
    expect(store().medium!.attempts).toHaveLength(2);
    store().record(game(MEDIUM_IDS[1]!, { coins: 3 }));
    expect(chapterProgress(store().medium, MEDIUM_IDS).map((c) => c.state)).toEqual(['won', 'won', 'todo', 'locked', 'locked']);
    expect(totalGold(store().medium)).toBe(5 + 2 + 4);
  });

  it('un chapitre verrouillé ne compte pas ; terminer les cinq chapitres termine la campagne', () => {
    store().startMedium();
    store().record(game(MEDIUM_IDS[3]!));
    expect(store().medium!.attempts).toHaveLength(0);
    for (const id of MEDIUM_IDS) store().record(game(id));
    expect(nextChapter(store().medium, MEDIUM_IDS)).toBeNull();
    expect(chapterProgress(store().medium, MEDIUM_IDS).every((c) => c.state === 'won')).toBe(true);
  });

  it('une seule campagne est active à la fois : chaque départ abandonne les autres', () => {
    store().start();
    expect(store().run).not.toBeNull();
    store().startMedium();
    expect(store().run).toBeNull();
    expect(store().medium).not.toBeNull();
    store().drawRandom(7);
    expect(store().medium).toBeNull();
    expect(store().random).not.toBeNull();
    store().startMedium();
    expect(store().random).toBeNull();
    store().start();
    expect(store().medium).toBeNull();
  });

  it('les scénarios de la campagne moyenne ne se mélangent pas à ceux de la petite campagne', () => {
    expect(MEDIUM_IDS.filter((id) => CHAPTER_IDS.includes(id))).toEqual([]);
    store().startMedium();
    expect(activeCampaignFor(store(), MEDIUM_IDS[2]!)).toMatchObject({ title: MEDIUM_CAMPAIGN.title, chapterIds: MEDIUM_IDS });
    expect(activeCampaignFor(store(), CHAPTER_IDS[0]!)).toBeNull();
  });

  it('elle est gardée sur l’appareil : relue après rechargement avec ses PO ; une progression étrangère est ignorée', async () => {
    store().startMedium();
    store().record(game(MEDIUM_IDS[0]!, { coins: 4 }));
    expect(prefs.get('campaign-medium')).toMatchObject({ campaignId: MEDIUM_CAMPAIGN.id });
    useCampaignRunStore.setState({ run: null, random: null, medium: null, loaded: false }); // nouveau lancement
    await store().load();
    expect(store().medium!.attempts[0]).toMatchObject({ scenarioId: MEDIUM_IDS[0], won: true, coinsWon: 5 });
    prefs.set('campaign-medium', { campaignId: 'autre', startedAt: 1, attempts: [] });
    useCampaignRunStore.setState({ medium: null, loaded: false });
    await store().load();
    expect(store().medium).toBeNull();
  });

  it('recommencer efface la progression et les PO', () => {
    store().startMedium();
    store().record(game(MEDIUM_IDS[0]!));
    store().resetMedium();
    expect(store().medium).toBeNull();
    store().startMedium();
    expect(totalGold(store().medium)).toBe(0);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import type { GameState } from '@/engine/domain/schemas';
import type { Repository } from '@/infrastructure/persistence/repository';
import { CHAPTER_IDS, activeCampaignFor, randomChapterIds, setCampaignRunRepository, useCampaignRunStore } from './campaignRunStore';

const prefs = new Map<string, unknown>();
const repo = { setPref: async (k: string, v: unknown) => void prefs.set(k, v), getPref: async (k: string) => JSON.parse(JSON.stringify(prefs.get(k) ?? null)) } as unknown as Repository;
const game = (scenarioId: string, over: Partial<Pick<GameState, 'sessionId' | 'phase' | 'coins'>> = {}) =>
  ({ sessionId: `s-${scenarioId}-${over.phase ?? 'W'}-${over.coins ?? 2}`, scenarioId, phase: 'SCENARIO_WON', coins: 2, deaths: 0, quests: [{ id: 'q', title: 'Q', done: true }], ...over }) as unknown as GameState;
const store = () => useCampaignRunStore.getState();

beforeEach(() => {
  prefs.clear();
  setCampaignRunRepository(repo);
  useCampaignRunStore.setState({ run: null, random: null, loaded: false });
});

describe('la campagne aléatoire est gardée sur l’appareil', () => {
  it('tirer une campagne la commence et l’enregistre ; une graine donnée redonne la même campagne', () => {
    store().drawRandom(7);
    const ids = randomChapterIds(store().random);
    expect(ids).toEqual(['campagne-7-1', 'campagne-7-2', 'campagne-7-3']);
    expect(prefs.get('campaign-random')).toMatchObject({ run: { campaignId: 'campagne-aleatoire-7', attempts: [] } });
    const first = store().random!.campaign;
    store().drawRandom(7);
    expect(store().random!.campaign).toEqual(first);
  });

  it('elle est relue après rechargement avec ses chapitres et ses PO', async () => {
    store().drawRandom(7);
    const [c1] = randomChapterIds(store().random);
    store().record(game(c1!, { coins: 4 }));
    const before = store().random!;
    useCampaignRunStore.setState({ run: null, random: null, loaded: false }); // nouveau lancement
    await store().load();
    expect(store().loaded).toBe(true);
    expect(store().random!.campaign).toEqual(before.campaign);
    expect(store().random!.run.attempts[0]).toMatchObject({ scenarioId: c1, won: true, coinsWon: 5 });
  });

  it('une donnée enregistrée illisible est ignorée', async () => {
    prefs.set('campaign-random', { campaign: { id: 'x' }, run: {} });
    await store().load();
    expect(store().random).toBeNull();
    expect(store().loaded).toBe(true);
  });

  it('les PO se cumulent d’un chapitre à l’autre, le chapitre suivant se déverrouille, la défaite se rejoue', () => {
    store().drawRandom(3);
    const [c1, c2] = randomChapterIds(store().random);
    store().record(game(c2!)); // verrouillé : sans effet
    expect(store().random!.run.attempts).toHaveLength(0);
    store().record(game(c1!, { phase: 'SCENARIO_LOST', coins: 1 }));
    store().record(game(c1!, { coins: 2 }));
    store().record(game(c2!, { coins: 5 }));
    const gold = store().random!.run.attempts.filter((a) => a.won).reduce((n, a) => n + a.coinsWon, 0);
    expect(gold).toBe(3 + 6);
  });

  it('un résultat hors campagne aléatoire (scénario isolé) n’est pas enregistré', () => {
    store().drawRandom(3);
    store().record(game('aleatoire-12'));
    expect(store().random!.run.attempts).toHaveLength(0);
  });

  it('« Autre tirage » remplace la campagne tant qu’aucun chapitre n’a été joué, pas ensuite', () => {
    store().drawRandom(3);
    const first = store().random!.campaign.id;
    for (let i = 0; i < 5 && store().random!.campaign.id === first; i++) store().redrawRandom();
    expect(store().random!.campaign.id).not.toBe(first);
    const second = store().random!.campaign.id;
    store().record(game(randomChapterIds(store().random)[0]!));
    store().redrawRandom();
    expect(store().random!.campaign.id).toBe(second);
  });

  it('une seule campagne active : en tirer une abandonne l’autre, et inversement', () => {
    store().start();
    expect(store().run).not.toBeNull();
    store().drawRandom(3);
    expect(store().run).toBeNull();
    expect(prefs.get('campaign-run')).toBeNull();
    store().start();
    expect(store().random).toBeNull();
    expect(prefs.get('campaign-random')).toBeNull();
  });

  it('resetRandom efface la campagne aléatoire ; activeCampaignFor retrouve la bonne campagne', () => {
    store().drawRandom(3);
    const [c1] = randomChapterIds(store().random);
    expect(activeCampaignFor(store(), c1!)).toMatchObject({ title: store().random!.campaign.title, chapterIds: randomChapterIds(store().random) });
    expect(activeCampaignFor(store(), CHAPTER_IDS[0]!)).toBeNull();
    expect(activeCampaignFor(store(), 'aleatoire-1')).toBeNull();
    store().resetRandom();
    expect(store().random).toBeNull();
    expect(activeCampaignFor(store(), c1!)).toBeNull();
    store().start();
    expect(activeCampaignFor(store(), CHAPTER_IDS[0]!)).toMatchObject({ chapterIds: CHAPTER_IDS });
  });
});

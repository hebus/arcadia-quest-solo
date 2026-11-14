import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createCampaign } from '@/engine/campaign';
import { runMonsterTurn } from '@/engine/activation/monsterTurn';
import { activateHero, finishHeroActivations, startScenario } from '@/engine/turn/machine';
import { demoGame } from '@/tests/fixtures/demo';
import { testContent } from '@/tests/fixtures/demo';
import { BUNDLE_VERSION, ImportError, exportBundle, parseBundle } from './export/bundle';
import { AqDatabase } from './persistence/db';
import { Repository, SNAPSHOT_LIMIT } from './persistence/repository';

const repo = () => new Repository(new AqDatabase(`test-${Math.random()}`));

describe('persistance locale', () => {
  it('sauvegarde puis reprend une partie sans perte, même après un Monster Turn', async () => {
    const r = repo();
    let g = startScenario(demoGame());
    for (const h of g.heroes) g = activateHero(g, h.id);
    g = runMonsterTurn(finishHeroActivations(g), testContent).state;
    await r.saveSession(g, 'c1');
    const back = await r.loadSession(g.sessionId);
    expect(back).toEqual(g);
    expect((await r.listSessions())[0]!.round).toBe(g.round);
  });

  it('grosse sauvegarde (5000 événements) : aller-retour fidèle', async () => {
    const r = repo();
    const g = demoGame();
    g.events = Array.from({ length: 5000 }, (_, i) => ({ seq: i + 1, round: 1, phase: 'GUILD_TURN' as const, type: 't', message: 'événement ' + i }));
    g.eventSeq = 5000;
    await r.saveSession(g);
    expect((await r.loadSession(g.sessionId))!.events).toHaveLength(5000);
    expect(parseBundle(exportBundle(null, [g])).sessions[0]!.events).toHaveLength(5000);
  });

  it('snapshots : annulation LIFO et limite', async () => {
    const r = repo();
    const g = demoGame();
    for (let i = 0; i < SNAPSHOT_LIMIT + 5; i++) await r.pushSnapshot(g.sessionId, { ...g, round: i }, `t${i}`);
    expect(await r.countSnapshots(g.sessionId)).toBe(SNAPSHOT_LIMIT);
    expect((await r.popSnapshot(g.sessionId))!.round).toBe(SNAPSHOT_LIMIT + 4);
  });

  it('campagnes : aller-retour', async () => {
    const r = repo();
    const c = createCampaign({ id: 'c', name: 'Camp', contentVersion: 'v', heroIds: ['a', 'b', 'c'] });
    await r.saveCampaign(c);
    expect(await r.loadCampaign('c')).toEqual(c);
    await r.deleteCampaign('c');
    expect(await r.loadCampaign('c')).toBeUndefined();
  });
});

describe('export / import JSON', () => {
  const c = createCampaign({ id: 'c', name: 'Camp', contentVersion: 'v', heroIds: ['a', 'b', 'c'] });

  it('aller-retour validé par ArkType', () => {
    const json = exportBundle(c, [demoGame()]);
    const b = parseBundle(json);
    expect(b.campaign).toEqual(c);
    expect(b.sessions).toHaveLength(1);
  });

  it('refuse un fichier invalide ou plus récent', () => {
    expect(() => parseBundle('pas du json')).toThrow(ImportError);
    expect(() => parseBundle('{"format":"autre"}')).toThrow(/pas une sauvegarde/);
    const json = JSON.parse(exportBundle(c, []));
    json.bundleVersion = BUNDLE_VERSION + 1;
    expect(() => parseBundle(JSON.stringify(json))).toThrow(/trop récente/);
    json.bundleVersion = BUNDLE_VERSION;
    json.campaign.heroIds = ['seul'];
    expect(() => parseBundle(JSON.stringify(json))).toThrow(/invalide/);
  });

  it('migre une ancienne version pas à pas', () => {
    const json = JSON.parse(exportBundle(c, []));
    json.bundleVersion = 0;
    json.legacyName = 'x';
    delete json.sessions;
    const migrations = [{ from: 0, to: 1, run: (raw: Record<string, unknown>) => ({ ...raw, sessions: [] }) }];
    expect(parseBundle(JSON.stringify(json), migrations).sessions).toEqual([]);
    expect(() => parseBundle(JSON.stringify(json), [])).toThrow(/Aucune migration/);
  });
});

describe('effacement des sauvegardes', () => {
  async function filled() {
    const r = repo();
    const g = demoGame();
    await r.saveSession(g, 'c1');
    await r.pushSnapshot(g.sessionId, g, 'avant');
    await r.saveCampaign(createCampaign({ id: 'c1', name: 'Camp', contentVersion: 'v', heroIds: ['a', 'b', 'c'] }));
    await r.backup('test', '{}');
    await r.setPref('x', 1);
    await r.saveTile({ id: 't1', name: 'T1', crop: { l: 0, t: 0, r: 0, b: 0 }, imageRotation: 0, interior: [], walls: [], openedWalls: [], doors: [] });
    return { r, g };
  }

  it('efface parties, instantanés, campagnes, sauvegardes de secours et préférences ; garde les tuiles par défaut', async () => {
    const { r, g } = await filled();
    await r.clearAll();
    expect(await r.listSessions()).toEqual([]);
    expect(await r.countSnapshots(g.sessionId)).toBe(0);
    expect(await r.listCampaigns()).toEqual([]);
    expect(await r.getPref('x')).toBeUndefined();
    expect((await r.listTiles()).map((t) => t.id)).toEqual(['t1']);
  });

  it('efface aussi la bibliothèque de tuiles sur demande', async () => {
    const { r } = await filled();
    await r.clearAll({ tiles: true });
    expect(await r.listTiles()).toEqual([]);
  });

  it('sur une base vide, ne plante pas et reste réutilisable', async () => {
    const r = repo();
    await expect(r.clearAll({ tiles: true })).resolves.toBeUndefined();
    await r.saveSession(demoGame());
    expect(await r.listSessions()).toHaveLength(1);
  });
});


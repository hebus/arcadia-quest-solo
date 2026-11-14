import { describe, expect, it } from 'vitest';
import { chapterProgress, coinsOfGame, isRunComplete, nextChapter, parseRun, recordAttempt, startRun, totalGold, type CampaignRun } from './campaignRun';

const IDS = ['un', 'deux', 'trois'];
const game = (over: Partial<Parameters<typeof recordAttempt>[2]> = {}): Parameters<typeof recordAttempt>[2] => ({
  sessionId: 's1',
  scenarioId: 'un',
  phase: 'SCENARIO_WON',
  coins: 3,
  deaths: 0,
  quests: [
    { id: 'a', title: 'A', done: true },
    { id: 'b', title: 'B', done: true },
    { id: 'c', title: 'C', done: false },
  ],
  ...over,
});
const states = (run: CampaignRun | null) => chapterProgress(run, IDS).map((c) => c.state);

describe('progression de la petite campagne', () => {
  it('sans campagne commencée, tout est verrouillé ; une fois commencée, seul le chapitre 1 est à jouer', () => {
    expect(states(null)).toEqual(['locked', 'locked', 'locked']);
    expect(states(startRun('c', 1))).toEqual(['todo', 'locked', 'locked']);
    expect(nextChapter(null, IDS)).toBeNull();
    expect(nextChapter(startRun('c'), IDS)).toBe(0);
    expect(totalGold(startRun('c'))).toBe(0);
  });

  it('les PO d’une partie : monstres tués + une pièce par quête accomplie', () => {
    expect(coinsOfGame(game())).toBe(3 + 2);
    expect(coinsOfGame(game({ coins: 0, quests: [] }))).toBe(0);
  });

  it('gagner un chapitre déverrouille le suivant', () => {
    const run = recordAttempt(startRun('c'), IDS, game());
    expect(states(run)).toEqual(['won', 'todo', 'locked']);
    expect(nextChapter(run, IDS)).toBe(1);
    const run2 = recordAttempt(run, IDS, game({ sessionId: 's2', scenarioId: 'deux', coins: 1, quests: [] }));
    expect(states(run2)).toEqual(['won', 'won', 'todo']);
    expect(isRunComplete(run2, IDS)).toBe(false);
    const done = recordAttempt(run2, IDS, game({ sessionId: 's3', scenarioId: 'trois' }));
    expect(states(done)).toEqual(['won', 'won', 'won']);
    expect(isRunComplete(done, IDS)).toBe(true);
    expect(nextChapter(done, IDS)).toBeNull();
  });

  it('une défaite ne déverrouille rien : le chapitre est à rejouer, et les PO gagnés comptent quand même', () => {
    const lost = recordAttempt(startRun('c'), IDS, game({ phase: 'SCENARIO_LOST', coins: 2, quests: [] }));
    expect(states(lost)).toEqual(['retry', 'locked', 'locked']);
    expect(totalGold(lost)).toBe(2);
    const retried = recordAttempt(lost, IDS, game({ sessionId: 's2', coins: 4, quests: [{ id: 'a', title: 'A', done: true }] }));
    expect(states(retried)).toEqual(['won', 'todo', 'locked']);
    expect(chapterProgress(retried, IDS)[0]).toMatchObject({ coinsWon: 2 + 5, attempts: 2 });
  });

  it('les PO de la guilde se cumulent d’un chapitre à l’autre', () => {
    let run = recordAttempt(startRun('c'), IDS, game({ coins: 3, quests: [] }));
    run = recordAttempt(run, IDS, game({ sessionId: 's2', scenarioId: 'deux', coins: 4, quests: [{ id: 'a', title: 'A', done: true }] }));
    expect(totalGold(run)).toBe(3 + 5);
  });

  it('une partie ne compte qu’une fois, quel que soit le nombre d’enregistrements', () => {
    const once = recordAttempt(startRun('c'), IDS, game());
    expect(recordAttempt(once, IDS, game())).toBe(once);
    expect(once.attempts).toHaveLength(1);
  });

  it('ne comptent pas : une partie non terminée, un autre scénario, un chapitre verrouillé, un chapitre déjà gagné', () => {
    const run = startRun('c');
    expect(recordAttempt(run, IDS, game({ phase: 'GUILD_TURN' }))).toBe(run);
    expect(recordAttempt(run, IDS, game({ scenarioId: 'autre' }))).toBe(run);
    expect(recordAttempt(run, IDS, game({ scenarioId: 'trois' }))).toBe(run); // verrouillé
    const won = recordAttempt(run, IDS, game());
    expect(recordAttempt(won, IDS, game({ sessionId: 's9' }))).toBe(won); // le chapitre 1 est gagné : on ne le rejoue pas ici
  });

  it('la progression se relit d’une sauvegarde ; une donnée invalide ou d’une autre campagne est ignorée', () => {
    const run = recordAttempt(startRun('c', 5), IDS, game());
    expect(parseRun(JSON.parse(JSON.stringify(run)), 'c')).toEqual(run);
    expect(parseRun(run, 'autre')).toBeNull();
    expect(parseRun({ campaignId: 'c' }, 'c')).toBeNull();
    expect(parseRun(undefined, 'c')).toBeNull();
    expect(parseRun('n’importe quoi', 'c')).toBeNull();
  });
});

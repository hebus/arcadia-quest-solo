import { describe, expect, it } from 'vitest';
import { createSeededRandom } from './random';
import { availableRewards, drawReward, parseRewardCards } from './rewards';
import { createScenarioGame, validateScenario } from './scenario/definition';
import { RANDOM_REWARD, runScript, type Rule } from './scenario/script';
import { generateScenario } from './scenario/generate';
import { CAVE_AUX_CENDRES } from '@/game-data/original/scenarios/cave-aux-cendres';
import { ORIGINAL_CONTENT, ORIGINAL_HEROES, ORIGINAL_REWARDS } from '@/game-data/original';

const heroes = ORIGINAL_HEROES.slice(0, 3);
const newGame = () => createScenarioGame(CAVE_AUX_CENDRES, { sessionId: 's', difficulty: 'medium', seed: 7, heroes }, ORIGINAL_CONTENT);
const downChief = (g: ReturnType<typeof newGame>) => ({ ...g, phase: 'GUILD_TURN' as const, monsters: g.monsters.map((m) => (m.id === 'M1' ? { ...m, status: 'removed' as const } : m)) });

describe('cartes Récompense : le catalogue', () => {
  it('la boîte de base : 12 cartes, 21 exemplaires', () => {
    expect(ORIGINAL_REWARDS).toHaveLength(12);
    expect(ORIGINAL_REWARDS.reduce((n, c) => n + c.copies, 0)).toBe(21);
    expect(ORIGINAL_REWARDS.find((c) => c.id === 'R-MG')).toMatchObject({ name: 'Lame du Capitaine', copies: 2 });
  });

  it('un fichier invalide est refusé : liste absente, carte incomplète, identifiant en double', () => {
    expect(() => parseRewardCards({})).toThrow(/« cards » est absente/);
    expect(() => parseRewardCards({ cards: [{ id: 'X' }] })).toThrow(/carte n° 1 invalide/);
    const c = { id: 'X', name: 'X', copies: 1, type: 't', effect: 'e' };
    expect(() => parseRewardCards({ cards: [c, c] })).toThrow(/en double « X »/);
  });
});

describe('cartes Récompense : le tirage', () => {
  it('un exemplaire restant par copie ; ceux déjà gagnés sont retirés', () => {
    expect(availableRewards(ORIGINAL_REWARDS, [])).toHaveLength(21);
    const left = availableRewards(ORIGINAL_REWARDS, ['R-RD', 'R-MG']);
    expect(left).toHaveLength(19);
    expect(left).not.toContain('R-RD'); // une seule copie dans la boîte
    expect(left.filter((id) => id === 'R-MG')).toHaveLength(1);
  });

  it('on ne distribue jamais plus d’exemplaires que la boîte n’en contient, puis plus rien', () => {
    const rng = createSeededRandom(3);
    const got: string[] = [];
    for (let i = 0; i < 21; i++) got.push(drawReward(ORIGINAL_REWARDS, got, rng)!);
    for (const c of ORIGINAL_REWARDS) expect(got.filter((id) => id === c.id)).toHaveLength(c.copies);
    expect(drawReward(ORIGINAL_REWARDS, got, rng)).toBeUndefined();
  });
});

describe('cartes Récompense : effet de script', () => {
  const rule = (card: string): Rule[] => [{ id: 'butin', when: [{ type: 'monster-down', monsterId: 'M1' }], then: [{ type: 'reward', card, text: 'Le butin brille.' }] }];

  it('carte fixée : elle est gagnée, annoncée et notée, une seule fois', () => {
    const r = runScript(downChief(newGame()), rule('R-ED'), ORIGINAL_REWARDS);
    expect(r.state.rewards).toEqual([{ cardId: 'R-ED', ruleId: 'butin' }]);
    expect(r.beats[0]).toMatchObject({ title: "Récompense : Cape d'Assassin", tone: 'reward' });
    expect(r.beats[0]!.text).toContain('Le butin brille.');
    expect(r.beats[0]!.text).toContain('R-ED');
    // Réévalué : la règle ne se redéclenche pas.
    expect(runScript(r.state, rule('R-ED'), ORIGINAL_REWARDS).state.rewards).toHaveLength(1);
  });

  it('carte au hasard : même partie, même carte ; la graine du jeu avance', () => {
    const a = runScript(downChief(newGame()), rule(RANDOM_REWARD), ORIGINAL_REWARDS);
    const b = runScript(downChief(newGame()), rule(RANDOM_REWARD), ORIGINAL_REWARDS);
    expect(a.state.rewards).toHaveLength(1);
    expect(a.state.rewards).toEqual(b.state.rewards);
    expect(ORIGINAL_REWARDS.map((c) => c.id)).toContain(a.state.rewards![0]!.cardId);
    expect(a.state.rngCounter).toBeGreaterThan(newGame().rngCounter);
  });

  it('boîte vide pour cette carte : rien n’est donné, le jeu continue', () => {
    const g = downChief(newGame());
    const owned = { ...g, rewards: [{ cardId: 'R-RD', ruleId: 'avant' }] };
    const r = runScript(owned, rule('R-RD'), ORIGINAL_REWARDS);
    expect(r.state.rewards).toHaveLength(1);
    expect(r.beats).toHaveLength(0);
  });

  it('sans catalogue, une récompense est ignorée sans erreur', () => {
    expect(runScript(downChief(newGame()), rule(RANDOM_REWARD)).state.rewards ?? []).toHaveLength(0);
  });

  it('un scénario qui nomme une carte inconnue est refusé', () => {
    const def = { ...CAVE_AUX_CENDRES, script: [...CAVE_AUX_CENDRES.script!, ...rule('R-XX')].map((r, i) => (i === CAVE_AUX_CENDRES.script!.length ? { ...r, id: 'butin-x' } : r)) };
    expect(validateScenario(def, ORIGINAL_CONTENT).join()).toMatch(/carte Récompense inconnue R-XX/);
    expect(validateScenario(CAVE_AUX_CENDRES, ORIGINAL_CONTENT)).toEqual([]);
  });
});

describe('cartes Récompense : dans les scénarios', () => {
  it('le chef d’un scénario aléatoire donne une récompense au hasard', () => {
    const def = generateScenario({ tileCount: 5, seed: 4 }, ORIGINAL_CONTENT);
    const chief = def.script!.find((r) => r.id === 'chef-tombe')!;
    expect(chief.then[0]).toMatchObject({ type: 'reward', card: RANDOM_REWARD });
    expect(chief.then.at(-1)).toMatchObject({ type: 'complete-quest' }); // la récompense est donnée avant la fin de partie
    expect(validateScenario(def, ORIGINAL_CONTENT)).toEqual([]);
  });

  it('La Cave aux Cendres : abattre le Minotaur donne une carte, sans bloquer la victoire', () => {
    const g = downChief(newGame());
    const r = runScript(g, CAVE_AUX_CENDRES.script!, ORIGINAL_REWARDS);
    expect(r.state.rewards).toHaveLength(1);
  });
});

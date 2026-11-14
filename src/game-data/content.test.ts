import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EXPANSIONS } from '@/engine/rules/expansions/registry';
import { allScenarios, availableScenarios } from './scenarios/catalog';

const rules = JSON.parse(readFileSync('docs/rules/rule-traceability.json', 'utf8')) as {
  id: string;
  source?: unknown;
  status: string;
  openQuestions?: string[];
}[];
const questions = readFileSync('docs/rules/open-questions.md', 'utf8');

describe('contrôle du contenu (plan §10.3)', () => {
  it('scénarios : identifiants uniques et familles connues', () => {
    const ids = allScenarios.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const families = new Set(['classic', ...Object.values(EXPANSIONS).flatMap((e) => e.scenarioFamilies)]);
    for (const s of allScenarios) expect(families.has(s.family), `${s.id}: famille ${s.family}`).toBe(true);
  });

  it('scénarios : une carte ne peut être à la fois exclue, limitée et retardée', () => {
    for (const s of allScenarios) {
      const dup = s.excludedCards.filter((c) => s.delayedCards.includes(c));
      expect(dup, s.id).toEqual([]);
    }
  });

  it('aucun scénario n est disponible par défaut sans configuration vérifiée', () => {
    for (const s of availableScenarios()) expect(s.blockedBy).toEqual([]);
    expect(allScenarios.filter((s) => s.status === 'to-verify').every((s) => s.blockedBy.length > 0)).toBe(true);
  });

  it('règles : identifiants uniques, source présente, questions référencées existantes', () => {
    const ids = rules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of rules) {
      expect(r.source, r.id).toBeTruthy();
      for (const q of r.openQuestions ?? []) expect(questions.includes(`| ${q} |`), `${r.id} → ${q}`).toBe(true);
    }
  });

  it('aucune règle ambiguë ou à vérifier n est présentée comme vérifiée', () => {
    for (const r of rules.filter((x) => (x.openQuestions ?? []).length)) expect(r.status, r.id).not.toBe('verified');
  });

  it('aucune extension n est annoncée comme entièrement prise en charge', () => {
    for (const e of Object.values(EXPANSIONS)) expect(['partial', 'unsupported']).toContain(e.status);
  });
});

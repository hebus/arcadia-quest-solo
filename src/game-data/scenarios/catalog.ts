import { type } from 'arktype';
import { parse } from '@/engine/domain/validate';
import raw from './solo-scenario-changes.json';

export const ScenarioChangeSchema = type({
  id: 'string',
  family: 'string',
  page: 'number.integer',
  name: 'string',
  guards: 'boolean',
  wildPets: 'number.integer >= 0',
  excludedCards: 'string[]',
  limitedCards: { '[string]': 'number.integer' },
  delayedCards: 'string[]',
  notes: 'string[]',
  status: "'verified' | 'to-verify'",
  blockedBy: 'string[]',
});
export type ScenarioChange = typeof ScenarioChangeSchema.infer;

export const catalog = parse(
  type({ source: { document: 'string', version: 'string' }, scenarios: ScenarioChangeSchema.array() }),
  raw,
);

export const allScenarios = catalog.scenarios;

/**
 * Seuls les scénarios dont la mise en place a été transcrite ET vérifiée sont proposés par défaut
 * (plan §16.14). Aucun ne l'est tant que le Campaign Book n'a pas été fourni : la mise en place se fait
 * alors à la main (assistant « mise en place libre »).
 */
export const availableScenarios = (): ScenarioChange[] => allScenarios.filter((s) => s.status === 'verified');

export const scenarioById = (id: string): ScenarioChange | undefined => allScenarios.find((s) => s.id === id);

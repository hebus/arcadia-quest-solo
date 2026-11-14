import { type, type Type } from 'arktype';

export interface ValidationIssue {
  path: string;
  message: string;
}

export type SafeParseResult<T> = { success: true; data: T } | { success: false; issues: ValidationIssue[] };

export class ValidationError extends Error {
  constructor(readonly issues: ValidationIssue[]) {
    super(issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join(' ; '));
    this.name = 'ValidationError';
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyType = Type<any, any>;

/** Valide `data` avec un schéma ArkType ; renvoie la valeur (défauts appliqués) ou la liste des problèmes. */
export function safeParse<S extends AnyType>(schema: S, data: unknown): SafeParseResult<S['infer']> {
  const out = schema(data);
  if (out instanceof type.errors) {
    return { success: false, issues: out.map((e) => ({ path: e.path.join('.'), message: e.problem })) };
  }
  return { success: true, data: out as S['infer'] };
}

/** Comme `safeParse`, mais lève une `ValidationError` en cas d'échec. */
export function parse<S extends AnyType>(schema: S, data: unknown): S['infer'] {
  const result = safeParse(schema, data);
  if (!result.success) throw new ValidationError(result.issues);
  return result.data;
}

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

describe('règles d\'architecture (plan §5.5, §16)', () => {
  it('engine/ n\'importe ni React, ni Zustand, ni PixiJS, ni Dexie, ni la couche application', () => {
    const forbidden = /from\s+['"](react|react-dom|zustand|pixi\.js|dexie|@\/(features|rendering|infrastructure|stores|components|app)\b)/;
    const files = walk('src/engine').filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(forbidden);
  });

  it('le rendu PixiJS ne contient pas de règle métier (il ne dépend que du modèle)', () => {
    for (const f of walk('src/rendering').filter((x) => !/\.test\./.test(x))) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/engine\/(combat|spawn|activation|turn)/);
    }
  });

  it('ni Playwright ni Three.js dans le projet', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as Record<string, Record<string, string>>;
    const names = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {}), ...Object.keys(pkg.scripts ?? {})].join(' ');
    expect(names).not.toMatch(/playwright|three/i);
    expect(readFileSync('.github/workflows/ci.yml', 'utf8')).not.toMatch(/playwright/i);
  });
});

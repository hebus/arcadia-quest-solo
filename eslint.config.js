import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  { files: ['scripts/**/*.mjs', 'vite.config.ts'], languageOptions: { globals: globals.node } },
  {
    // Règle d'architecture fondamentale : engine/ est indépendant de l'UI et du navigateur.
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-dom', 'react-dom/*', 'zustand', 'pixi.js', 'dexie'], message: 'engine/ ne doit importer ni React, ni Zustand, ni PixiJS, ni IndexedDB.' },
            { group: ['@/features/*', '@/rendering/*', '@/infrastructure/*', '@/stores/*', '@/components/*', '@/app/*'], message: 'Les dépendances vont vers le domaine, jamais l\'inverse.' },
          ],
        },
      ],
    },
  },
);
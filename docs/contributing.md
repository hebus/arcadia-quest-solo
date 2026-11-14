# Guide de contribution

1. Lire `docs/plan.md`, `docs/decisions.md` et `docs/rules/`.
2. Une règle ne s'implémente qu'avec sa source (livret, page) : l'ajouter dans `docs/rules/rule-traceability.json`. Une règle ambiguë va dans `docs/rules/open-questions.md`, jamais dans le code comme certaine.
3. Le moteur (`src/engine/`) est du TypeScript pur : pas de React, Zustand, Dexie (vérifié par ESLint et par `src/tests/architecture.test.ts`). Aucune logique métier dans les composants ni dans le rendu.
4. Les tirages passent par `Oracle` / `RandomSource`. Toute fonction du moteur est pure et renvoie un nouvel état.
5. Tests avec Vitest et React Testing Library, écrits avec la règle. Pas de Playwright, pas de Three.js.
6. Données de contenu : `src/game-data/`, validées par ArkType et par `src/game-data/content.test.ts`. Un scénario n'est « verified » que si sa mise en place est transcrite depuis le livret et confrontée à une partie réelle.
7. Avant de livrer : `npm run lint && npm run typecheck && npm test && npm run build`.
8. Les sauvegardes sont versionnées : toute évolution de schéma ajoute une migration dans `src/infrastructure/export/bundle.ts` et son test.

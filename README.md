# Arcadia Quest Solo Companion

Application web locale (React, TypeScript, Vite) servant d'arbitre et d'automate pour jouer en solo à *Arcadia Quest* avec le matériel physique. Hors ligne (PWA), données sur l'appareil.

**Jouer : https://hebus.github.io/arcadia-quest-solo/** (déployé automatiquement à chaque push sur `main`). Pensé pour une tablette posée sur la table de jeu : toucher un héros pour voir où il peut aller, le toucher de nouveau pour choisir Mêlée ou Distance, glisser-déposer pour le déplacer.

- Spécification : [docs/plan.md](docs/plan.md)
- Guide d'utilisation : [docs/user-guide.md](docs/user-guide.md)
- Limites connues : [docs/known-limits.md](docs/known-limits.md)
- Décisions et choix d'implémentation : [docs/decisions.md](docs/decisions.md)
- Règles, traçabilité et questions ouvertes : [docs/rules/](docs/rules/)
- Contribuer : [docs/contributing.md](docs/contributing.md) · Checklist tablette : [docs/manual-test-checklist.md](docs/manual-test-checklist.md)

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | typecheck + build de production (PWA) |
| `npm test` | tests Vitest (jsdom, React Testing Library) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

## Architecture

```
React UI ─┐
SVG board ┼─> stores (Zustand) ─> engine/ (TypeScript pur) ─> game-data/
IndexedDB ┘
```

`src/engine/` n'importe ni React, ni Zustand, ni Dexie. Le plateau est dessiné en SVG (`src/rendering/board/`) : il ne fait que montrer le modèle et les aides calculés par le moteur (cases atteignables, trajets).

## Avancement par phase

| Phase | État |
|---|---|
| 0 Audit des règles | fait sur les livrets de base et solo v1.3 ; Campaign Book absent ; validation en partie réelle à faire |
| 1 Initialisation | fait |
| 2 Modèle de domaine | fait (schémas ArkType, invariants, fixtures) |
| 3 Règles de base | fait pour ce qui sert à l'automate : plateau, Close, mouvement, portes, portails, ligne de vue, dés, blessures, morts, Guard, Payback, Overkill ; quêtes comme compteur |
| 4 Mode solo | fait : manches, repos, Spawn, deck et recyclage, deux activations, seuils de défaite |
| 5 Automate | fait : sélection (distance orthogonale), gardes, ciblage, chemins, traces ; agent déterministe |
| 6 Orchestrateur | fait : confirmations physiques, corrections, annulation, dés et cartes physiques ou numériques |
| 7 Interface React | fait : accueil, assistant, tableau de bord, tour de guilde, Monster Turn, historique, corrections, résultat |
| 8 Persistance, PWA | fait : Dexie, reprise, export/import validé, migrations, hors ligne |
| 9 Plateau visuel | fait en SVG (PixiJS retiré) : tuiles scannées, éditeur de murs, pose des portes, jetons, héros et monstres ; déplacement au clic avec chemin et Guard ; attaque au clic |
| 10 Campagne | fait : étapes, résultats, phase d'amélioration solo, limite de cartes, Death Curses |
| 11 Extensions | partielle : Pets, Riders, Dragons ; non prises en charge : Inferno, Beyond the Grave, Whole Lotta Lava |
| 12 Scénarios | catalogue de 53 changements intégré et testé ; aucune mise en place vérifiée (Campaign Book absent) |
| 13 Qualité | tests automatiques, contrastes, étiquettes, clavier ; checklist tablette à dérouler |
| 14 Livraison | build PWA et documentation ; pas de tag ni de publication |

## Licence

[MIT](LICENSE) pour le code. *Arcadia Quest* et ses règles appartiennent à leurs éditeurs ; les règles officielles ne sont pas incluses dans ce dépôt.

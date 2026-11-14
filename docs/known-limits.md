# Limites connues et contenus pris en charge

## État de la validation

- Les règles sont couvertes par des tests automatiques, mais **aucune n'a été validée en partie physique** : le plan l'exige avant de les déclarer officielles (§17, §18). Toute divergence observée sur la table doit être corrigée dans le moteur et ajoutée aux tests.
- Les faces des dés sont un placeholder à régler (question B17).

## Contenu

- **Scénarios** : le catalogue des 53 changements de scénario du livret solo est intégré, mais aucun n'est « vérifié » : la mise en place (positions des monstres, gardes, jetons Spawn, quêtes) est dans le Campaign Book, non fourni. La mise en place se saisit à la main.
- **Extensions** : Pets, Riders, Dragons partiellement ; Inferno, Beyond the Grave, Whole Lotta Lava non prises en charge (voir Paramètres pour le détail). Aucune n'est marquée « prise en charge ».
- **Cartes** : aucune base de cartes (héros, monstres, améliorations) : elles sont saisies par l'utilisateur.

## Règles non modélisées (à appliquer à la main)

Capacités spéciales des monstres et des héros, effets des cartes d'amélioration, poussée des Huge Characters, cartes Brimstone / Tombstone / Dragonstone, montée et descente des Riders, règles propres des dragons.

## Technique

- Agent Monster Turn déterministe uniquement (pas d'agent adossé à un modèle de langage).
- Bâtiments : seuls les murs et les portes comptent pour le déplacement ; les règles propres aux intérieurs (s'il en existe dans le Campaign Book) ne sont pas modélisées.
- Tuiles : le scan et le cadrage sont manuels (pas de détection automatique de la grille ni des murs). Les scans restent sur l'appareil (non inclus dans l'export JSON des parties).
- Un héros avec une monture ou un familier se déplace comme un héros seul (Riders et Pets non gérés au plateau).
- Pas de contrôle « Suspendre / Reprendre » : le Monster Turn s'exécute en un bloc et ne s'interrompt que pour une saisie physique (bouton Arrêter).
- Rejeu par graine connue : disponible dans le moteur (même graine, même résultat), sans écran de débogage.

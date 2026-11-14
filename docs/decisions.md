# Décisions prises sans réponse de l'utilisateur

Les questions de cadrage du plan (§19) n'ont pas reçu de réponse. Pour avancer, voici les choix retenus. Chacun est réversible.

| Question du plan | Choix retenu | Conséquence |
|---|---|---|
| 1. Contenu possédé | Aucun contenu supposé : monstres et héros sont saisis à partir des cartes | Pas de base de données de cartes ; extensions activables, jamais présumées |
| 2. Scénario MVP | Moteur indépendant du scénario ; « mise en place guidée » pour n'importe quel scénario | Aucun scénario officiel préchargé (Campaign Book absent) ; une démo non officielle est fournie |
| 3. Dés et cartes | Les deux modes existent et se règlent à tout moment | Numérique recommandé ; matériel : l'agent demande chaque résultat et reprend seul |
| 4. Positions | Plateau abstrait minimal (grille, murs, portes, portails, jetons Spawn) | Plateau assemblé à partir de tuiles de 3×3 cases (scans + murs tracés par l'utilisateur) |
| 5. Campagne | Scénarios isolés ET campagne (résultats, phase d'amélioration, limites de cartes) | Cartes d'amélioration saisies par nom |
| 6. Données de cartes | Saisie manuelle dans l'assistant | Stats lues sur la carte Monster du niveau courant |

## Choix d'implémentation (non officiels)

- **Agent Monster Turn** : agent déterministe fondé sur des règles (mode « de secours » et « de test » du plan §7.9). L'agent adossé à un modèle de langage n'est pas réalisé : il demanderait un service distant, contraire au principe hors ligne. L'architecture le permet (le moteur valide toute action, les commandes sont typées, l'état est transactionnel).
- **Transactions** : chaque opération renvoie un nouvel état ; en cas de saisie physique manquante, l'état précédent est conservé et l'opération est rejouée avec les réponses accumulées (déterminisme par graine + compteur).
- **Égalités laissées au joueur par le livret** : politique « ordre par identifiant » par défaut, « me demander » en option (politique d'automatisation, pas une règle).
- **Cible la plus proche** : coût minimal en points de mouvement ; départage par blessures (livret), puis politique (B2, B20).
- **Chemins équivalents** : le premier trouvé par une recherche en largeur, ordre haut, droite, bas, gauche.
- **Distance de sélection** : somme des écarts en x et y, terrain ignoré (livret v1.3 p.2), codée à part du déplacement.
- **Cartes d'un type éliminé** : conservées (FAQ p.20) ; option pour les retirer (notes p.6).
- **Deck d'activation** : 3 cartes par type (autres niveaux) ; avec les règles du scénario (exclues, limitées, retardées, Wild Pet).
- **Stats des niveaux** : l'assistant ne demande que la carte du niveau courant ; les autres niveaux sont des cartes d'activation dont les stats ne servent jamais (livret p.2).

## Plateau visuel

- **SVG au lieu de PixiJS** : le plateau interactif (poser des tuiles, cliquer une case, cliquer un monstre) est en SVG dans React. Il se teste en jsdom, reste accessible et ne dépend pas de WebGL. PixiJS avait été prévu comme option par le plan (§5.3) puis retiré ; Three.js n'a jamais été utilisé (§5.2).
- **Tuiles** : une tuile = 3×3 cases ; un plateau courant = 3×3 tuiles (9×9 cases). Chaque face de tuile est scannée, cadrée sur la grille, puis ses murs sont tracés sur le scan. Les portes et portails sont des jetons du scénario : ils se posent sur le plateau assemblé.
- **Rue et bâtiments** : une tuile est de rue par défaut. Les cases d'intérieur d'une tuile se regroupent en bâtiments (contiguïté orthogonale, sur une même tuile) ; leur contour est un mur automatique, y compris vers la tuile voisine. L'utilisateur peut supprimer un mur du contour, ajouter des murs (cloisons) et poser des portes sur les murs. Une porte retirée rétablit le mur. Les portes d'une tuile sont fermées par défaut ; leur état se règle à la mise en place.
- **Déplacement d'un héros** : un clic sur une case atteignable (3 PM ; porte = 1, portail = 1) calcule le chemin qui déclenche le moins de réactions Guard, puis le plus court. Chaque pas hors d'une Space gardée fait attaquer les monstres concernés avant le déplacement.
- **Jet de défense** : par défaut l'application lance l'attaque du monstre et annonce les coups ; le joueur lance ses dés de défense et saisit les coups parés (réglable).
- **Une attaque par activation** ; le mouvement ne peut pas être repris si le héros s'est déplacé puis a attaqué.

## Ce qui n'est PAS modélisé

Capacités spéciales des monstres et des héros, cartes d'amélioration, Huge Characters (poussée), cartes Brimstone, Tombstone et Dragonstone, règles de montée des Riders, règles propres de chaque dragon, Death Curses (hors tirage de la plus haute valeur). Ces points sont à appliquer à la main ; l'application l'affiche.

## Une seule figurine par case (décision de l'utilisateur)

Le livret autorise deux figurines par case ; l'application n'en admet qu'une (`CELL_CAPACITY = 1` dans `src/engine/movement/board.ts`).

- Un personnage ne peut pas s'arrêter sur une case occupée (déplacements des héros et des monstres, ouverture d'une porte sans effet).
- Un ennemi remplit sa case : on ne la traverse pas. Un allié se traverse mais on ne s'y arrête pas. (Généralisation de la règle « Blocked Space » du livret, qui exigeait deux ennemis.)
- Apparitions (jeton Spawn) et renforts du script sur une case occupée : le monstre retourne dans la boîte, le renfort est annulé.
- Corrections manuelles, résurrection au repos et pose sur le plateau : refusées sur une case occupée.
- Mise en place et scénarios : validation « plus d'une figurine sur la case ».
- À vérifier avec l'utilisateur : traversée d'un allié autorisée (hypothèse).

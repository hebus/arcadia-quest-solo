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

## Deux figurines au maximum par case (décision de l'utilisateur, conforme au livret)

Une Space accueille au maximum deux personnages, héros ou monstres (`CELL_CAPACITY = 2` dans `src/engine/movement/board.ts`). Cela remplace la règle de la maison « une seule figurine par case ».

- Une case contenant **2 ennemis** de l'acteur (Blocked Space) bloque le déplacement et la ligne de vue : on ne peut ni s'y arrêter ni la traverser.
- Une case pleine mais **mixte** (par exemple 1 héros + 1 monstre), ou contenant 2 alliés, se traverse mais on ne peut pas s'y arrêter ; elle ne bloque pas la ligne de vue.
- Une case avec une seule figurine permet de s'y arrêter (y compris en la partageant avec un ennemi).
- Ligne de vue par défaut : règle du livret (`lineOfSight: 'rulebook'`). Le réglage « tout personnage bloque » reste disponible dans les Paramètres.
- Apparitions (jeton Spawn) et renforts du script sur une case pleine : le monstre sort du jeu, le renfort est annulé.
- Corrections manuelles, résurrection au repos et pose sur le plateau : refusées sur une case pleine.
- Mise en place et scénarios : validation « plus de 2 figurines sur la case ».
- Affichage : une figurine seule est centrée ; à deux, l'une en haut à gauche et l'autre en bas à droite (chevauchement toléré).

## Jetons Spawn

Il n'existe que 5 jetons Spawn, un de chaque : épée+épée, épée+arc, épée+critique, arc+arc, arc+critique (`src/engine/spawn/tokens.ts`). Le DSL des scénarios et l'éditeur de plateau refusent tout autre jeton ou un doublon.

- Jet de référence d'une activation sans jeton correspondant sur le plateau : rien ne se passe (pas de relance, aucune carte piochée). Ceci remplace la relance de solo v1.3 p.2.
- Phase Spawn : un monstre de la Spawn Tile dont le jeton tiré n'est pas sur le plateau sort définitivement du jeu.

## Monstres : minions et vilains, niveaux et rangs

- Deux catégories : **minions** et **vilains** (`kind` dans la définition). Quatre niveaux : **1, 2-3, 4-5, 6**. À chaque niveau, une version **minor** et une version **major** (`levels` = minor, `majorLevels` = major ; `rank` sur la figurine, minor par défaut). Accès aux stats : `src/engine/monsters.ts`.
- Pour l'instant, seuls deux minions sont utilisés, avec les statistiques communiquées (toutes deux minor) :

| Monstre | Boîte | Niveau | Vie | Overkill | Mouvement | Récompense | Dés d'attaque |
|---|---|---|---|---|---|---|---|
| Goblin Archer (GA) | 6 | 2-3 | 2 | 3 | 1 | 1 PO | 2 (distance) |
| Orc Marauder (OM) | 8 | 1 | 2 | 3 | 1 | 1 PO | 3 (mêlée) |

- Les autres niveaux et les versions major ne sont pas encore saisis : l'application signale « Stats manquantes » plutôt que d'inventer des valeurs. Un scénario ne peut donc, pour l'instant, utiliser que les monstres dont le niveau du scénario est saisi (Orc Marauder au niveau 1, Goblin Archer au niveau 2-3).
- Le deck d'activation compte une carte par niveau autre que celui du scénario, même quand les stats de ces niveaux ne sont pas saisies.
- Nombre de figurines : on ne pose pas plus de monstres d'un type que la boîte n'en contient (validation de la mise en place, des scénarios et du terrain d'essai).
- Le terrain d'essai (`terrain-essai`, banc d'essai en placement libre) est construit depuis **6 tuiles du jeu** (voir « Terrain d'essai » plus bas) avec **un monstre de chaque type du niveau 1** ; son menu propose tous les types de niveau 1. Le scénario 1 utilise les six types de niveau 1 (voir « Tuiles dans les scénarios »). L'ancien bestiaire de test (Rôdeur, Archer d'os, Brute, Sorcière, Seigneur Cendre) est supprimé.

## Dés de combat (noirs) et de défense (blancs)

- **Dé de combat, noir** : 3 épées, 2 arcs, 1 critique. Une attaque de **mêlée** touche avec une épée ou un critique ; une attaque **à distance** touche avec un arc ou un critique ; sinon c'est un échec. Il n'y a pas de face vide : un jet de spawn tombe donc toujours sur épée, arc ou critique.
- **Dé de défense, blanc** : 1 bouclier, 1 critique, 4 faces vides (une seule face bouclier et une seule face critique : toutes les autres sont vides). Un **bouclier** ou un **critique** annule une touche (valable pour un monstre qui aurait des dés de défense comme pour les héros, dont le joueur lance les dés).
- Un critique est une réussite et ajoute un dé (règle du livret, inchangée).
- Données dans `src/game-data/dice.ts`, réglables dans Paramètres.

## Tuiles : 9 tuiles doubles faces

- Le jeu de base compte **9 tuiles doubles faces**, numérotées de 1 à 9, chacune avec un recto **A** et un verso **B** : 18 faces, **1A/1B … 9A/9B** (`src/engine/tileCatalog.ts`). Sans elles, un plateau ne peut pas être reproduit.
- Une tuile est une grille de **3×3 cases** (`TILE = 3`) et une case accueille **2 figurines** au maximum.
- Chaque tuile n'existe qu'en un exemplaire : sur un plateau, **une seule face** d'une même tuile (pas 1A et 1B ensemble) et jamais deux fois la même. Un plateau compte donc 9 tuiles au plus.
- **Éditeur des tuiles** (Bibliothèque de tuiles) : un catalogue des 9 tuiles, recto/verso, où l'on définit chaque face une fois pour toutes :
  - **zones de bâtiments** : cases d'intérieur, murées automatiquement (un bâtiment = des cases contiguës) ;
  - **salles** : elles fonctionnent comme les bâtiments (cases contiguës = une seule salle, contour muré automatiquement, portes posables sur le contour, murs ouvrables) ; seul le sol change (dalles de pierre, à côté des pavés de la rue et du parquet des bâtiments). Un bâtiment et une salle côte à côte sont séparés par un mur ;
  - **cases bloquées** : impassables, ni déplacement, ni ligne de vue, aucune figurine posée ; pour le moteur, ce sont des cases absentes, dessinées en blocs barrés ;
  - une case n'a qu'un type : rue, bâtiment, salle ou bloquée ; une case bloquée ne peut pas faire partie d'une zone de départ ;
  - **zone de départ des héros** : les cases de départ imprimées sur la face (`heroStart`) ;
  - murs et portes ; scan de la face (facultatif, nommé d'après sa face : « 3B.png »).
  Toucher une face vierge la crée comme tuile de rue. Les définitions s'exportent et s'importent en JSON (bouton Exporter / Importer un fichier) pour les conserver ou les partager.
- Mise en place du plateau : le choix de tuile désactive toute tuile déjà posée (les deux faces) ; l'étape de vérification refuse un plateau qui en pose une deux fois. Les zones de départ des tuiles posées sont surlignées en jaune quand on place les héros.
- Les tuiles de test (tuile de rue vierge, maison de démonstration) restent disponibles pour la démo, rangées à part ; la vérification signale que le plateau n'est pas réalisable avec le matériel.
- Les anciens codes (A1 à I2) ne sont plus reconnus : les scans importés sous cet ancien nom sont des tuiles « hors du jeu » à redéfinir sous leur face (1A à 9B).

## Tuile d'apparition (Spawn Tile)

- Elle compte **5 emplacements**. Un monstre tué quitte le plateau et prend le **premier emplacement libre**.
- Dès qu'elle est **pleine, à n'importe quel moment** (sans attendre le tour des monstres), chaque monstre de la tuile, dans l'ordre des emplacements : on lance 2 dés d'attaque (ni relance ni dé supplémentaire) pour désigner un jeton Spawn.
  - Pas de jeton correspondant sur le plateau : le monstre est **retiré définitivement du jeu**.
  - Space du jeton **pleine** (2 figurines) : le monstre se place sur **une Space voisine** (orthogonale) qui a encore de la place, au choix du joueur ; s'il n'y en a aucune, il est retiré du jeu. (Le livret le remettait dans la boîte.)
  - Sinon il se place sur la Space du jeton.
- Au début du Monster Turn, la tuile est de toute façon résolue si elle était pleine (garde-fou, ce qui ne devrait plus arriver).
- Code : `resolveSpawnTile` dans `src/engine/spawn/spawn.ts`, déclenché après chaque monstre tué par un héros.

## Repos

Un joueur qui se repose **passe son tour** : toutes ses cartes équipement redeviennent disponibles et peuvent être réorganisées (les joueurs gèrent leurs cartes, l'application n'en suit aucune), et les **héros tués sont ressuscités** (position choisie sur le plateau). Aucun héros ne doit avoir été activé ce tour-là.

## Pions porte

- Le jeu physique compte **22 pions porte**, recto/verso : un côté « porte ouverte », l'autre « porte fermée ». **Un seul** est spécial, **violet**, et désigne la porte spéciale du scénario (`src/engine/doorTokens.ts`).
- Un plateau ne peut donc pas compter plus de 22 portes (portes de tuiles non retirées + portes ajoutées), dont au plus une spéciale. Une porte retirée rend son pion. La mise en place et la validation des scénarios le contrôlent.
- Mise en place : l'outil « Porte spéciale » marque une porte (violette), un compteur indique « pions porte posés : n / 22 ». DSL de scénario : `door d1 3,2-4,2 closed special`.
- La porte spéciale est pour l'instant un repère : l'application ne lui applique aucune règle propre (à définir avec le scénario).

## Tuiles dans les scénarios

- Les **18 faces du jeu physique** (1A à 9B) sont livrées avec l'application dans `src/game-data/original/tiles.json` (export de l'éditeur de tuiles : bouton « Exporter »). Pour les mettre à jour, on remplace ce fichier par un nouvel export. Les tuiles de la bibliothèque de l'appareil l'emportent à code égal. Les scans sont facultatifs et ne sont pas encore dans ce fichier.
- Un scénario peut indiquer ses tuiles (`tiles` : numéro et face de chaque tuile, rotation par quarts de tour). Son plateau est alors **construit depuis les définitions des tuiles** (`scenarioBoard`) : bâtiments, salles, cases bloquées, murs, rotation. La description textuelle du scénario ne donne plus que les **pions porte**, les jetons Spawn, les murs et les portails qu'il ajoute ; elle ne décrit ni `room` ni `hole` (ils viennent des tuiles).
- Une tuile ne se pose que sur **une seule face** par scénario : si on utilise le verso (B), le recto (A) n'est pas utilisé, et inversement. La validation refuse les deux faces d'une même tuile, la même face deux fois, une tuile non définie et une taille de plateau qui ne correspond pas (3 cases par tuile).
- **Affichage** : le numéro de chaque tuile (par exemple 3B) est écrit au centre de la tuile, sur le plateau de jeu, l'aperçu du briefing et la mise en place ; pas d'indication d'orientation (le dessin suffit). Le briefing n'affiche ni liste de tuiles ni rotation. Un bouton « Voir les tuiles », **uniquement au briefing** (il aide à construire le plateau sur la table), montre les tuiles **en réduit dans un dialogue**. Il n'existe plus pendant la partie : ni à la mise en place, ni dans le menu.
- Scénario 1 (« Les Braises de Port-Cendre ») : 3×3 tuiles, 5A, 3B (90°), 2A (chapelle, bâtiment en L), 8A (remise, bâtiment en L), 4A (la case bloquée du centre est le puits), 9A, 7A (départ des héros), 6B (180°), 1B (grande salle). **Cet assemblage reste un choix à confirmer** : il n'est pas issu de la boîte du jeu.
- **Population du scénario 1** (niveau 1, boîtes respectées, renforts du script compris) : le **Seigneur Cendre est un Minotaur** (vilain, 5 de vie, 4 dés, un critique donne une blessure en plus), tenu en **garde** au fond de la chapelle ; un **Troll** (son attaque touche tous les héros adjacents) garde la **grande salle** ; un **Orc Captain** garde la porte de la chapelle et un autre la remise ; deux **Spear Beastman** (tireurs : l'un au centre de la rue, l'autre collé à un Orc Marauder, donc avec son dé en plus) ; un **Hammer Beastman** (étourdit) patrouille devant la remise ; quatre **Orc Marauder** dans la rue. Les 2 renforts du script (porte de la chapelle ouverte, brasero éteint) sont des Orc Marauder : avec les 2 Orc Captain et les 4 Orc Marauder du départ, cela fait les 8 Orcs de la boîte. Le chef est le Minotaur plutôt que le Troll : c'est lui qui a le plus de vie (5) et une seule défense, le Troll gardant la salle où l'on peut l'éviter. La quête « seigneur » suit le Minotaur (`M1`).

## Moins de 9 tuiles, tuiles décalées

- Un scénario n'a **pas à utiliser les 9 tuiles** : une grille d'emplacements (`tilesW × tilesH`) peut n'en contenir que quelques-unes. Les emplacements vides sont des cases absentes, donc impassables.
- Une tuile peut être **décalée** (`dx`, `dy`, en cases, positifs ou négatifs) par rapport à son emplacement, pour créer des espaces bloquants entre les tuiles : les cases que aucune tuile ne couvre sont des cases absentes (impassables, ni déplacement ni ligne de vue). Le plateau s'agrandit si une tuile décalée dépasse la grille (`layoutExtent`) et la taille `size` de la description du scénario doit suivre.
- Une tuile ne peut pas être décalée hors du plateau (coordonnée négative : on décale plutôt les autres vers la droite ou vers le bas), et deux tuiles ne peuvent pas se chevaucher. L'assistant de mise en place propose des boutons ← ↑ ↓ → (une case par clic), « Recaler » et garde le décalage quand on tourne ou change la tuile.
- Le numéro de tuile écrit sur le plateau et les zones de départ suivent le décalage.

## Pions porte et murs

- Les tuiles n'ont pas de portes : les portes sont des **pions** posés par le scénario (22 au plus, dont une spéciale violette).
- Un pion porte se pose **sur un mur** et le remplace. Fermé, il se franchit en l'ouvrant (1 PM). Posé **côté « porte ouverte »**, il **supprime le mur** : on s'en sert pour agrandir un bâtiment (relier deux bâtiments) ou pour l'ouvrir sur la rue. Un pion sur une arête sans mur est refusé.
- **Départ des héros** : il faut au moins une porte sur le contour de leur bâtiment de départ pour qu'ils puissent en sortir (`heroStartsEnclosed`) ; un scénario ou une mise en place qui les enferme est refusé.

## Mode aléatoire

- Dans « Jouer un scénario », la carte « 🎲 Scénario aléatoire » demande le **nombre de tuiles du terrain** (1 à 9) et génère un scénario (`generateScenario`, `src/engine/scenario/generate.ts`). « ↻ Autre tirage » en génère un autre avec le même nombre de tuiles. Le tirage est reproductible : même graine, même scénario (la graine fait partie de l'identifiant `aleatoire-<graine>`).
- **Terrain** : les numéros de tuiles sont tirés sans remise, chacune sur une face (A ou B) tirée parmi celles qui sont définies, avec une rotation tirée par quarts de tour ; l'assemblage est d'un seul tenant (chaque tuile touche une autre par un côté). Pas de décalage de tuiles pour l'instant.
- **Portes** : les bâtiments et salles sont murés par les tuiles, le générateur pose les pions porte : une porte **ouverte** sur le bâtiment de départ des héros (pour qu'ils sortent), une porte sur chaque autre bâtiment (fermée aux trois quarts). Jamais plus de 22 portes.
- **Départ des héros** : une zone de départ d'une tuile (3 cases d'un même bâtiment) ; à défaut, trois cases de rue côte à côte.
- **Jetons Spawn** : jusqu'à 5, de types différents (parmi les 5 qui existent), sur des cases de rue distinctes loin du départ.
- **Monstres** : 2 à 8 Orc Marauder (le nombre croît avec le terrain), les seuls dont le niveau 1 est saisi ; un tiers environ sont des gardes, un chef gardien tient souvent un bâtiment fermé.
- **Quêtes** : atteindre un objectif tiré (relique, clé, brasier, coffre) puis abattre le chef maraudeur ; l'histoire (introduction, victoire, défaite) est tirée dans de courtes listes.
- Un tirage n'est gardé que s'il est **valide et jouable** : le scénario passe la validation, les héros peuvent sortir de leur départ, et monstres, objectif et jetons Spawn sont atteignables (une porte, fermée ou ouverte, se franchit). Sinon, un nouveau tirage est essayé (300 au plus), puis une erreur claire est affichée.
- Le scénario généré n'existe pas dans les données livrées : la partie le **garde avec elle** (`generatedScenario`, JSON de sa définition), ce qui permet de reprendre la partie, d'annuler et d'afficher son épilogue.
- Aucun équilibrage n'est garanti : difficulté conseillée « moyenne » dans tous les cas.

## Monstres du niveau 1

Bestiaire de niveau 1 complet (`src/game-data/original/monsters.ts`), avec le Goblin Archer du niveau 2-3 :

| Monstre | Classe | Vie | Overkill | Mvt | Défense | Attaque | PO | Compétence | Boîte |
|---|---|---|---|---|---|---|---|---|---|
| Orc Marauder (OM) | minion minor | 2 | 3 | 1 | | 3 dés épée | 1 | | 8 Orcs (avec OC) |
| Orc Captain (OC) | minion minor | 2 | 4 | 1 | | 3 dés épée | 2 | 1 relance | 8 Orcs (avec OM) |
| Minotaur (M) | vilain minor | 5 | 6 | 2 | 1 dé | 4 dés épée | 3 | chaque critique = 1 blessure en plus (et un dé de plus, règle habituelle) | 1 |
| Troll (T) | vilain minor | 4 | 6 | 2 | 2 dés | 4 dés épée | 3 | son attaque cible tous les héros adjacents | 1 |
| Spear Beastman (SB) | minion major | 3 | 5 | 1 | | 3 dés arc | 2 | un dé d'attaque de plus s'il est adjacent à un autre monstre | 2 |
| Hammer Beastman (HB) | minion major | 3 | 5 | 1 | | 4 dés épée | 2 | si au moins une blessure passe, le héros est étourdi | 2 |

- **Rang** : SB et HB existent en **major** au niveau 1 (stats dans `majorLevels['1']`). Sans rang précisé sur la figurine, l'application prend celui où le monstre existe au niveau du scénario ; l'interface affiche la classe (« minion majeur », « vilain mineur »…).
- **`tier`** (utilisé pour désigner qui riposte en premier) est un **choix** : minion minor 1, minion major 2, vilain 3.
- **Boîtes partagées** : les 8 figurines d'Orc servent à l'Orc Marauder comme à l'Orc Captain (`group: 'orc'`) ; la mise en place, la validation des scénarios, le terrain d'essai et le générateur comptent par boîte (« Trop de figurines Orc Marauder et Orc Captain : 9 pour 8 dans la boîte »).
- **Défense des monstres** : le joueur lance les dés blancs du monstre quand un héros l'attaque (un bouclier ou un critique annule une touche) avant d'indiquer les blessures ; le dialogue d'attaque rappelle la défense, la classe et les capacités du monstre ciblé.
- **Générateur de scénarios** : il utilise tout le bestiaire de niveau 1 dans les limites des boîtes ; le chef gardien est un vilain (Minotaur ou Troll, tiré) et la quête s'appelle « Abattre le <nom du chef> » ; le deck liste tous les types présents. Terrain d'essai : le deck contient les six types du niveau 1 (le menu du terrain les propose tous).

## Terrain d'essai

- Banc d'essai (`sandbox: true`) : placement libre, menu « Terrain d'essai » (ajouter ou retirer des monstres, régler blessures et dés, sauter le tour de guilde, remettre la disposition de départ).
- **Plateau de 10×6 cases, 6 tuiles du jeu** (une seule face par tuile) : 5A, 4A (sa case bloquée, au centre, est le puits en (4,1)), 2A (bâtiment en L : la chapelle), 7A (bâtiment de départ des héros), 1B (la grande salle) et 3B **décalée d'une case vers la droite** : la colonne (6,3) à (6,5) est un espace vide, bloquant, entre la salle et 3B.
- **Pions porte** : `porte-chapelle` (fermée, c'est la **porte spéciale violette**, en repère), `porte-salle` (fermée) et `porte-depart` (ouverte, pour que les héros sortent de leur bâtiment).
- **Jetons Spawn** : les 5 (épée+épée en S1, arc+arc en S2 : les préréglages de dés du terrain visent S1 et S2), sur des cases de rue.
- **Un monstre de chaque type du niveau 1**, placés pour essayer les compétences : OM1, OM2 et OM3 (Orc Marauder ; OM2 touche SB1), OC1 (Orc Captain, 1 relance, garde la porte de la chapelle), M1 (Minotaur, critique = blessure en plus, garde le fond de la chapelle), T1 (Troll, partage la case de départ de Zazu : Close à deux héros, son attaque les cible tous), SB1 (Spear Beastman, un dé d'attaque de plus car adjacent à OM2) et HB1 (Hammer Beastman, étourdit, près de la sortie du départ). Orcs : 4 en jeu sur les 8 de la boîte ; Minotaur et Troll : leur unique figurine est posée ; Spear et Hammer Beastman : 1 sur 2.
- Le deck liste les six types ; `monsterCardSet` « 1 ».

## Petite campagne « La Chute des Braises »

- **Trois chapitres** joués dans l'ordre avec la même guilde de 3 héros (nom et points de vie, gardés d'une partie à l'autre) : 1. *Les Braises de Port-Cendre* (le scénario 1 existant), 2. *Le Marché des Ombres*, 3. *La Forge du Maître-Fer*. Définition : `src/game-data/original/campaigns/chute-des-braises.ts`. Tous les chapitres sont au **niveau de cartes « 1 »**, les seules statistiques de monstres saisies pour l'instant ; aucun Goblin Archer.
- **Chapitre 2** (moyen, 6 tuiles : 9B, 5A, 7B, 6B, 4A, 2A) : le Troll Gorge-Sombre tient la maison de comptes. Quêtes : forcer le coffre-fort (le **pion porte spécial violet**), reprendre la bourse dans la salle du marché, abattre le Troll. Population : Troll, 2 Orc Captain, 2 Hammer Beastman, 2 Spear Beastman, 4 Orc Marauder, 2 renforts (les 8 Orcs). Un pion porte posé **côté ouvert** supprime le mur entre la salle du marché et la maison de comptes.
- **Chapitre 3** (difficile, 9 tuiles dont la 9A **décalée d'une case** : une colonne vide, bloquante, isole la forge, qu'on n'atteint que par une porte) : le Minotaur Maître-Fer en garde dans la fonderie, le Troll dans la grande salle. Quêtes : éteindre deux braseros, abattre le Maître-Fer. Population : Minotaur, Troll, 2 Orc Captain, 2 Spear Beastman, 2 Hammer Beastman, 3 Orc Marauder, 3 renforts (les 8 Orcs). Le pion violet est l'entrée de l'île.
- **Progression** (`src/engine/campaignRun.ts`, `stores/campaignRunStore.ts`) : le chapitre suivant se déverrouille quand le précédent est **gagné** ; une défaite le laisse « à rejouer » et ne débloque rien. Les **PO gagnés par la guilde** (monstres tués + une pièce par quête accomplie) se cumulent sur tout le parcours, défaites comprises. Une partie ne compte qu'une fois (enregistrée par identifiant de partie), et un chapitre verrouillé ou déjà gagné n'est pas enregistré. La progression est gardée sur l'appareil (préférence `campaign-run`). La phase d'amélioration (cartes) reste physique ; la campagne à 6 scénarios historique (`campaign.ts`) n'est pas touchée.
- **Interface** : la carte « Campagne » est en tête du choix des scénarios (commencer, chapitres et leur état, PO de la guilde, jouer/rejouer, recommencer avec confirmation). L'écran de résultat d'un chapitre l'enregistre automatiquement et propose « Retour à la campagne ». Les chapitres 2 et 3 n'apparaissent pas dans la liste des scénarios isolés.

# Guide d'utilisation

L'application est un arbitre et un automate : le plateau, les figurines, les cartes et (si vous le souhaitez) les dés restent sur la table. Les règles suivies sont celles du livret de base et du livret Solo Mode v1.3.

## Installation

1. Ouvrez l'application dans un navigateur récent (tablette en paysage de préférence).
2. Ajoutez-la à l'écran d'accueil (« Installer l'application » ou « Ajouter à l'écran d'accueil ») : elle fonctionne ensuite sans connexion.
3. Vos parties sont enregistrées sur l'appareil. Rien n'est envoyé à un serveur.

## Avant la première partie

1. **Paramètres → Faces des dés** : comparez les faces à vos dés d'attaque et de défense (les livrets ne les décrivent pas) et corrigez-les.
2. Choisissez dés et cartes numériques (l'agent tire tout) ou matériels (vous annoncez les résultats).

## Une partie

1. **Bibliothèque de tuiles** (une fois) : importez le scan de chaque face de tuile et alignez la grille 3×3 avec les curseurs de cadrage. Une tuile est une **tuile de rue** par défaut : toutes les cases sont franchissables en orthogonal. Avec l'outil **Intérieur**, touchez les cases qui sont à l'intérieur d'un bâtiment : des cases d'intérieur contiguës forment un seul bâtiment, dont le contour est muré automatiquement. Avec **Murs**, ajoutez un mur ou supprimez un mur du contour (il reste visible en pointillés gris pour pouvoir le remettre). Avec **Portes**, posez ou retirez une porte sur un mur. Les arêtes du bord de la tuile sont cliquables pour les murs vers la tuile voisine.
2. **Nouvelle partie** : cinq étapes (scénario, héros et types de monstres, plateau, quêtes et deck, vérification). À l'étape « Plateau », posez les tuiles (3×3 en général), puis l'état des portes des tuiles (fermée, ouverte, retirée : le mur revient) et d'éventuelles portes ou murs propres au scénario, les portails, les jetons Spawn, les héros et les monstres directement sur le plateau.
   Le bouton **Charger la démo** remplit un exemple non officiel (8 tuiles de rue et une tuile avec une maison au centre).
3. **Tour de guilde** : touchez un héros sur le plateau : les cases qu'il peut atteindre (3 PM) s'allument en vert, en orange avec ⚠ si le chemin déclenche une réaction Guard. Touchez la case : le héros est déplacé et activé. Touchez un monstre pour l'attaquer : choisissez mêlée ou distance, saisissez les coups obtenus (et les parades du monstre si vous les lancez), l'application calcule Payback et Guard.
4. **Défense** : quand un monstre attaque un de vos héros, l'application annonce les coups reçus ; lancez les dés de défense du héros et saisissez les coups parés. Les blessures sont calculées.
5. **Monster Turn** : « Lancer le Monster Turn ». L'agent résout le Spawn et deux activations : les monstres avancent vers les héros et attaquent si possible. Les trajets s'affichent en pointillés jaunes sur le plateau (figure fantôme à l'ancienne position) ; déplacez les figurines sur la table puis confirmez.
6. Si le plateau ne correspond plus à l'état : **Corrections**, ou **Historique → Annuler** (les actions physiques déjà faites ne sont pas annulées).
7. **Fin** : l'écran de résultat donne les pièces, les morts et les cartes à révéler à la phase d'amélioration ; la campagne continue après une victoire comme après une défaite.

## Sauvegarde

Automatique après chaque action. **Exporter** crée un fichier JSON ; **Importer** le relit après validation et garde une copie de secours de l'existant.

## Ce que l'application ne fait pas

Voir `docs/known-limits.md`.

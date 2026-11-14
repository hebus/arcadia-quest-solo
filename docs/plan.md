# Arcadia Quest Solo Companion
## Cahier des charges et plan complet de réalisation

**Version du document :** 1.0  
**Date :** 1 novembre 2026  
**Statut :** spécification de projet et feuille de route de développement  
**Cible :** application web locale servant d'automate pour jouer en solo à *Arcadia Quest* avec le matériel physique.

---

# 1. Vision du projet

## 1.1 Objectif

Créer une application web qui automatise les adversaires et la gestion du mode solo d'**Arcadia Quest**, afin qu'une personne puisse jouer seule avec le jeu physique.

L'application n'est pas une adaptation numérique complète du jeu. Le plateau, les figurines, les cartes physiques, les dés et les manipulations matérielles restent au centre de l'expérience. L'application agit comme un arbitre et un automate :

- elle gère les phases et les tours ;
- elle gère les cartes d'activation des monstres ;
- elle détermine quels monstres doivent agir ;
- elle calcule leurs déplacements et leurs cibles à partir de l'état du plateau renseigné ;
- elle guide le joueur étape par étape ;
- elle mémorise l'état de la partie et de la campagne ;
- elle explique pourquoi chaque décision de l'automate a été prise.

Le joueur conserve la maîtrise des actions physiques et confirme dans l'application les événements qui ont effectivement eu lieu.

## 1.2 Principes directeurs

1. **Fidélité aux règles.** Les règles officielles fournies constituent la référence. Aucune règle ne doit être inventée silencieusement.
2. **Automatisation explicable.** Chaque décision doit pouvoir être comprise et justifiée.
3. **Compagnon, pas jeu vidéo.** L'application ne remplace ni les figurines, ni les cartes, ni les dés physiques.
4. **Saisie minimale.** Ne demander au joueur que les informations nécessaires à la prochaine décision.
5. **Reprise fiable.** Une partie doit pouvoir être sauvegardée, fermée puis reprise sans perdre son état.
6. **Architecture extensible.** Le jeu de base doit être jouable avant d'intégrer les extensions.
7. **Règles séparées de l'interface.** Le moteur ne doit dépendre ni de React, ni de PixiJS.
8. **Traçabilité.** Les décisions, tirages et modifications d'état doivent être historisés.
9. **Offline-first.** L'application doit rester utilisable sans connexion Internet.
10. **Pas de dépendance à un LLM pour arbitrer.** Les décisions de jeu doivent être déterministes, testables et fondées sur des règles explicites.

## 1.3 Périmètre fonctionnel

### Inclus

- Création et configuration d'une guilde de trois héros.
- Préparation d'un scénario et de ses éléments.
- Gestion des tours de guilde et des tours des monstres.
- Automatisation des activations de monstres du mode solo.
- Gestion des gardes, des apparitions et des cartes d'activation.
- Suivi des héros, monstres, blessures, morts, quêtes et objectifs.
- Prise en charge progressive des règles des extensions.
- Campagne, phases d'amélioration et sauvegardes.
- Historique, explication des décisions et annulation contrôlée.
- Interface tactile adaptée à une tablette en paysage.
- Carte tactique schématique facultative pour représenter les positions.

### Exclus du premier MVP

- Remplacement numérique du plateau physique.
- Modélisation 3D complète des figurines ou du plateau.
- Reconnaissance automatique du plateau par caméra.
- Lecture automatique des cartes physiques par caméra.
- Simulation graphique des combats à la place des dés et cartes physiques.
- Mode multijoueur en ligne.
- Synchronisation cloud obligatoire.
- Automatisation de toutes les extensions dès la première version.

---

# 2. Références de règles et méthode de formalisation

## 2.1 Documents de référence

Le développement s'appuie d'abord sur les documents fournis dans la conversation :

1. **Arcadia Quest – Règle française** (`Arcadia_Quest_-_Regle.pdf`), livret de règles de base.
2. **Arcadia Quest Solo Mode – Version 1.3** (`AQ-Solo Mode-1.3.pdf`), document spécifique au mode solo, incluant des changements pour plusieurs extensions et scénarios.

Les deux documents doivent être conservés comme références du projet. Le second document est en anglais : la terminologie du moteur pourra être normalisée en anglais dans le code, mais l'interface utilisateur sera en français.

Les règles officielles doivent être transcrites dans une base de règles structurée. Le présent document donne les exigences et les comportements déjà identifiables ; il ne remplace pas une transcription exhaustive de chaque paragraphe des livrets.

## 2.2 Hiérarchie des règles

Le moteur doit appliquer les règles dans cet ordre :

1. règle spécifique du scénario ;
2. règle spécifique au mode solo ;
3. règle spécifique à une extension activée ;
4. règle de base d'Arcadia Quest.

Lorsqu'un texte spécifique indique explicitement qu'il remplace une règle générale, la règle remplacée ne doit pas être exécutée.

Toute contradiction ou ambiguïté doit être inscrite dans un registre de décisions à arbitrer. Ne pas choisir arbitrairement une interprétation.

## 2.3 Registre de traçabilité

Chaque règle implémentée doit posséder :

- un identifiant stable (`RULE-...`) ;
- son texte ou une reformulation fidèle ;
- sa source (document, page, section) ;
- son contexte d'application ;
- ses préconditions ;
- ses effets ;
- ses exceptions ;
- son niveau de certitude ;
- les tests qui la couvrent ;
- les éventuelles questions ouvertes.

Exemple de fiche :

```ts
interface RuleDefinition {
  id: string;
  title: string;
  source: {
    document: string;
    page?: number;
    section?: string;
  };
  scope: "base" | "solo" | "expansion" | "scenario";
  priority: number;
  description: string;
  preconditions: string[];
  effects: string[];
  exceptions: string[];
  status: "verified" | "to-verify" | "ambiguous";
  testIds: string[];
}
```

## 2.4 Registre des points à vérifier avant de déclarer le jeu complet

Le développeur doit extraire et vérifier dans les livrets, sans extrapoler :

- toutes les règles de déplacement, d'attaque, de défense et de ligne de vue ;
- les effets des portes, murs, obstacles, cases, zones et portails ;
- les règles de ciblage et de portée propres à chaque arme et monstre ;
- les dés, symboles, relances, critiques, blessures et effets spéciaux ;
- les réactions Guard et Payback ;
- les règles complètes de spawn et de remplissage de la Spawn Tile ;
- les conditions et résolutions de toutes les quêtes PvE ;
- les règles de mort, résurrection, malédictions et compteur de morts ;
- les règles de campagne et de phase d'amélioration ;
- les interactions de cartes et de jetons ;
- les particularités de chaque scénario ;
- les règles propres aux extensions réellement prises en charge ;
- les FAQ et clarifications présentes dans les documents.

Une règle non vérifiée ne doit pas être présentée comme une règle officielle validée.

---

# 3. Règles du mode solo à intégrer

Cette section formalise les éléments directement identifiables dans le livret Solo Mode v1.3. Les détails du jeu de base doivent être complétés à partir du livret français.

## 3.1 Guilde et campagne

- La guilde du joueur comporte **trois héros**.
- Le joueur choisit un tableau de guilde.
- Il distribue cinq objets de départ entre les trois héros.
- La campagne suit une progression de trois scénarios dans l'Outer Circle, deux dans l'Inner Circle, puis le Final Showdown.
- Chaque scénario a une issue de victoire ou de défaite, mais la campagne continue vers le scénario suivant.
- Les règles précises de sélection des scénarios, de récompenses et d'amélioration doivent être modélisées à partir du livret de base et des éléments applicables du mode solo.

## 3.2 Objectif et seuil de défaite

Le scénario est gagné lorsque toutes les quêtes PvE sont accomplies avant que la guilde n'atteigne son seuil de morts.

Le scénario est perdu lorsque le nombre de morts de héros atteint la difficulté choisie :

| Difficulté | Seuil de morts |
|---|---:|
| Legendary | 1 |
| Hard | 2 |
| Medium | 3 |
| Easy | 4 |

L'interface doit afficher le compteur de morts et le seuil de défaite en permanence.

Les morts de familiers ne comptent pas dans ce seuil. Avec l'extension Riders, la mort d'une monture compte comme une mort de héros, mais la monture ne reçoit pas de carte Malédiction.

## 3.3 Structure d'une manche

Une manche standard du mode solo comporte :

1. Guild Turn ;
2. Monster Turn.

Après chaque tour de guilde, qu'il s'agisse d'activer les héros ou de se reposer, le tour des monstres est exécuté.

Le moteur doit représenter les phases par une machine à états explicite, et non par une série de booléens indépendants.

## 3.4 Tour de guilde

Le joueur choisit l'une des options :

- activer tous ses héros ;
- se reposer.

### Activation des héros

- Chaque héros est activé une fois.
- Le joueur choisit librement l'ordre d'activation.
- L'activation d'un héros conserve les règles normales : déplacement, portes, portails, attaque et autres actions permises par le jeu de base.
- Chaque héros peut se déplacer, attaquer, faire les deux ou ne rien faire.
- Les monstres continuent à appliquer leurs réactions normales Guard et Payback avec les caractéristiques correspondant à leur niveau.
- Les trois points de mouvement attribués à un monstre pendant son activation du Monster Turn ne s'appliquent pas à ses réactions Guard ou Payback.

### Repos

Le repos reprend les règles normales :

- aucun héros n'est activé ;
- les jetons Guilde sont retirés des cartes du tableau de guilde ;
- les héros morts sont ressuscités selon les règles applicables ;
- le joueur peut réorganiser cartes et jetons.

Le tour des monstres intervient tout de même après le repos.

### Extensions pendant le tour de guilde

- **Riders :** lors de l'activation des héros, une monture peut également être activée une fois pendant le tour, avec trois points de mouvement. Les règles d'appel, de montée et de descente doivent être appliquées.
- **Pets :** chaque familier peut être activé une fois lorsque le joueur active ses héros ; les familiers ne sont pas activés pendant un repos.
- Les extensions non prises en charge dans le scénario ne doivent pas apparaître dans l'interface.

## 3.5 Tour des monstres

Le Monster Turn comporte deux étapes :

1. Spawn ;
2. activation des monstres.

### Spawn

- Le spawn intervient au début du Monster Turn.
- Si la Spawn Tile est pleine, les monstres sont spawnés selon les règles normales.
- Le traitement exact des figurines, emplacements disponibles et cas de dépassement doit être vérifié dans les règles applicables et la FAQ du livret solo.

L'application doit guider le joueur pour résoudre les apparitions physiques, puis demander confirmation des résultats.

### Activation de deux monstres

Deux monstres sont activés l'un après l'autre.

Pour chaque activation :

1. Lancer deux dés d'attaque pour déterminer le Spawn Point de référence.
2. Si la combinaison obtenue ne correspond à aucun jeton Spawn présent, relancer jusqu'à obtenir une combinaison valide.
3. Révéler la carte supérieure du Monster Activation deck.
4. Identifier le monstre du type indiqué qui est le plus proche du Spawn Point désigné.
5. Pour cette seule recherche de proximité, compter les cases orthogonales sans tenir compte des portes, murs, portails ou autres éléments de terrain.
6. Si plusieurs monstres sont à égalité, le joueur en choisit un.
7. Le monstre choisi reçoit trois points de mouvement.
8. Il se déplace vers le héros le plus proche et attaque si possible.
9. Il utilise uniquement le nombre minimal de points de mouvement nécessaire pour attaquer.
10. Si plusieurs héros peuvent être ciblés, il attaque celui qui possède le plus de blessures.
11. Si plusieurs héros restent à égalité, le joueur choisit le héros attaqué.
12. Défausser la carte d'activation et recommencer pour le deuxième monstre.

La deuxième carte peut activer un monstre du même type que le premier.

### Distinction essentielle : sélection et déplacement

La proximité utilisée pour sélectionner le monstre est une distance orthogonale simplifiée depuis le Spawn Point, sans tenir compte du terrain.

Une fois le monstre sélectionné, son déplacement doit suivre les règles normales d'activation, avec les éléments de terrain, portes et portails applicables.

Ces deux calculs doivent être implémentés séparément. Il serait incorrect de réutiliser le pathfinding normal pour sélectionner le monstre.

### Cartes d'activation et caractéristiques

La carte révélée sert à déterminer quel type de monstre doit être activé. Ses statistiques ne doivent pas être utilisées pour résoudre son activation.

Le moteur utilise les statistiques du Monster card set correspondant au niveau du monstre défini pour le scénario, à l'exception de la valeur de mouvement spécifique au Monster Turn.

### Monstres gardes

- Les gardes ne se déplacent pas et protègent leur position.
- Si le monstre sélectionné pour activation est un garde, l'ignorer et sélectionner le prochain monstre le plus proche du type requis.
- Les gardes conservent normalement leurs réactions Guard et Payback.
- Lorsqu'un garde est tué, il cesse d'être un garde ; sa figurine rejoint la Spawn Tile selon les règles normales et son jeton Guard est retiré.
- Un garde réapparu ultérieurement n'est plus un garde.
- Les cartes d'activation ne doivent pas être supprimées simplement parce que toutes les figurines d'un type ont temporairement disparu du plateau : elles peuvent réapparaître.

## 3.6 Pioche d'activation

À la mise en place :

- placer les monstres du scénario normalement ;
- sélectionner pour les monstres les cartes correspondant à leur niveau courant ;
- réunir les cartes des autres niveaux des monstres listés pour constituer le Monster Activation deck ;
- mélanger et placer le deck face cachée.

Quand le deck est épuisé, appliquer la règle de recyclage prévue par le mode solo : reprendre les cartes de défausse et les mélanger pour former un nouveau deck.

Le cas d'un type de monstre retiré explicitement du deck par une règle de scénario doit être géré par la configuration de ce scénario, et non par une règle globale implicite.

## 3.7 Extensions

### Inferno et Beyond the Grave

- Utiliser les nouveaux jeux de cartes Brimstone ou Tombstone prévus pour le mode solo à la place des cartes originales.
- Lorsqu'une carte est révélée, le joueur peut appliquer immédiatement son effet si la situation le permet.
- Le joueur peut choisir de défausser la carte sans effet après avoir dépensé un point de mouvement d'un héros pour la révéler.
- Certaines cartes permettent d'activer un monstre d'un tier donné : le joueur choisit le monstre, qui se déplace selon ses statistiques normales.
- Un monstre activé par ce moyen ne compte pas comme un héros de la guilde et ne peut pas accomplir de quête.
- Ces cartes ne peuvent pas activer un garde.

### Pets

- Ajouter au Monster Activation deck le nombre de cartes Wild Pet indiqué pour le scénario.
- Une carte Wild Pet ne fait pas agir un familier : elle modifie la cible de la prochaine activation de monstre.
- Après une carte Wild Pet, révéler une autre carte de monstre ; ce monstre cible le familier de guilde le plus proche.
- Si deux cartes Wild Pet sont révélées à la suite, reprendre les cartes d'activation défaussées, les mélanger avec le deck et piocher à nouveau.
- Les morts de familiers ne comptent pas pour la défaite.
- Les familiers sont activés pendant le tour de guilde lorsque les héros sont activés, jamais pendant un repos.
- Des cartes spécifiques au mode solo existent pour certains familiers ; elles doivent être référencées comme composants requis si l'extension est activée.

### Huge Characters

Lorsqu'un Huge Character est activé, il doit utiliser son déplacement de manière à tenter de pousser les héros autant que possible, selon les règles applicables.

### Riders

- Les montures peuvent être activées une fois pendant le tour de guilde lorsque les héros sont activés.
- Les déplacements, portes, portails, montée et descente utilisent les points de mouvement indiqués.
- La mort d'une monture compte comme une mort de héros pour le seuil de défaite.
- Une monture ne reçoit pas de carte Malédiction.

### Dragons

Les rencontres de dragon sont divisées en deux parties.

**Partie 1 :**
- appliquer les règles solo de base ;
- accomplir la quête PvE « Ground the Dragon » ;
- construire le deck de monstres et activer les monstres après le tour de guilde ;
- le dragon ne peut pas être activé pendant le Monster Turn ;
- appliquer les récompenses et cartes spécifiques prévues par le scénario ;
- utiliser les nouveaux Dragonstone cards du mode solo ;
- ne pas accorder les bonus de pièces pour les médailles pendant la phase d'amélioration précédant la Partie 1, selon le livret.

**Partie 2 :**
- les conditions de victoire et de défaite sont celles du dragon concerné, et non les seuils habituels du mode solo ;
- les manches sont composées du Dragon Turn puis du Guild Turn ;
- piocher une Dragon Turn card, exécuter son effet et la défausser ;
- il n'y a pas de Monster Turn après le Guild Turn ;
- l'activation d'un héros concerne un seul héros, et non les trois.

Les règles exactes de chaque dragon doivent être configurées à partir de son scénario et de ses cartes.

## 3.8 Changements propres aux scénarios

Le livret Solo Mode v1.3 comporte des sections de changements par familles de scénarios, notamment :

- Whole Lotta Lava ;
- Beyond the Grave ;
- Pets ;
- Riders ;
- Dragons.

Ces modifications peuvent notamment :
- ajouter des jetons Guild aux monstres gardes indiqués sur la carte ;
- ajouter un nombre déterminé de cartes Wild Pet ;
- exclure certains types de monstres du Monster Activation deck ;
- n'ajouter certaines cartes qu'après le retour d'un monstre sur le plateau ;
- définir des exceptions de quête ou de victoire.

**Exigence impérative :** chaque scénario doit avoir une fiche de configuration explicite, relue à partir de la page correspondante du livret. Ne pas inférer la liste des monstres à exclure ou le nombre de cartes Wild Pet à partir d'un autre scénario.

Les scénarios avec règles spéciales (par exemple plusieurs quêtes PvE parmi lesquelles un nombre donné doit être accompli) doivent être décrits comme des règles de victoire spécifiques, et non comme une simple liste de quêtes standard.

## 3.9 FAQ du mode solo

La FAQ fournie précise notamment :

- une même quête PvE ne peut être accomplie qu'une fois par scénario ;
- les monstres tués qui dépassent les emplacements disponibles de la Spawn Tile sont remis dans la boîte lorsque celle-ci est pleine, selon le cas décrit ;
- lorsqu'une attaque de héros cible plusieurs monstres, un seul monstre est activé en réaction Payback : celui du tier le plus élevé ; en cas d'égalité, le joueur choisit ;
- un garde tué perd son statut de garde et son jeton ;
- les cartes d'activation ne sont pas retirées simplement parce qu'il n'y a plus de figurine de ce type sur le plateau.

Chaque entrée de FAQ doit devenir une règle ou un test de non-régression.

---

# 4. Expérience utilisateur et parcours

## 4.1 Plateforme cible

- Application web React.
- Utilisation prioritaire sur tablette, en mode paysage.
- Utilisable sur ordinateur.
- Installation possible comme PWA.
- Fonctionnement hors ligne après chargement initial.
- Interface tactile avec zones de clic généreuses.
- Pas de compte utilisateur obligatoire.

## 4.2 Parcours général

1. Ouvrir l'application.
2. Créer une campagne ou reprendre une sauvegarde.
3. Choisir les extensions activées.
4. Créer ou sélectionner les trois héros de la guilde.
5. Configurer les objets de départ.
6. Choisir le scénario et la difficulté.
7. Suivre l'assistant de mise en place physique.
8. Renseigner les monstres, gardes, Spawn Points et positions initiales nécessaires.
9. Lancer le scénario.
10. Suivre le tour de guilde.
11. Lancer le Monster Turn guidé par l'automate.
12. Confirmer les actions physiques et mettre à jour l'état.
13. Continuer jusqu'à la victoire ou la défaite.
14. Effectuer la phase de campagne / amélioration.
15. Enregistrer et poursuivre le scénario suivant.

## 4.3 Écrans

### A. Accueil

- Nouvelle campagne.
- Reprendre une campagne.
- Partie rapide / scénario isolé si les règles le permettent.
- Gestion des paramètres.
- Accès au guide d'utilisation et aux règles.

### B. Configuration de campagne

- Nom local de la campagne.
- Sélection du contenu disponible.
- Extensions activées.
- Progression de campagne.
- Héros disponibles.
- Historique des scénarios.

### C. Sélection des héros

- Sélection de trois héros.
- Fiche de héros.
- Statistiques et capacités.
- Objets de départ.
- Répartition des équipements.
- Validation des contraintes de sélection.

### D. Préparation du scénario

Assistant en étapes :

1. scénario et difficulté ;
2. extensions compatibles ;
3. niveau des monstres ;
4. héros et départ ;
5. placement des monstres ;
6. identification des gardes ;
7. configuration des Spawn Points ;
8. cartes et decks requis ;
9. quêtes PvE ;
10. vérification finale.

L'assistant doit signaler les composants physiques à sortir de la boîte et les cartes à écarter.

### E. Tableau de bord de partie

Doit présenter en permanence :

- phase courante ;
- numéro de manche ;
- trois héros et leurs états ;
- blessures et morts ;
- seuil de défaite ;
- quêtes PvE et progression ;
- Spawn Tile et contenu ;
- deck d'activation et défausse (au moins les compteurs) ;
- monstres en jeu ;
- extension(s) active(s) ;
- prochaine action attendue.

### F. Agent IA autonome — gestion complète du Monster Turn

Cet écran n'est pas un assistant qui attend que le joueur prenne les décisions une par une. Il constitue le poste de contrôle d'un **agent IA autonome chargé de piloter intégralement le Monster Turn**, depuis le début de la phase Spawn jusqu'à la fin des deux activations de monstres.

Le joueur ne choisit plus les monstres, leurs cibles, leurs déplacements ou leurs actions. Ces décisions relèvent de l'agent IA, dans le respect strict des règles officielles et des données du scénario.

L'agent doit être capable de :
- lire l'état courant de la partie fourni par le moteur ;
- déterminer les événements à résoudre ;
- effectuer les tirages numériques nécessaires (dés et cartes) ;
- appliquer les règles de spawn ;
- sélectionner les monstres à activer ;
- ignorer correctement les gardes lorsqu'ils ne sont pas activables ;
- déterminer les cibles ;
- calculer les déplacements et chemins légaux ;
- choisir les actions à effectuer ;
- résoudre les séquences de décisions jusqu'à la fin du Monster Turn ;
- mettre à jour l'état logique de la partie ;
- expliquer ses décisions et conserver une trace complète de son raisonnement opérationnel.

**Autonomie attendue :** une fois le Monster Turn lancé, l'agent doit pouvoir le conduire de bout en bout sans demander au joueur de prendre une décision stratégique ou de valider chaque sous-étape. Il ne doit interrompre son exécution que lorsqu'une intervention physique est indispensable, que l'état du plateau est insuffisant ou contradictoire, ou qu'une règle officielle ne permet pas de déterminer une issue unique.

#### Déroulement autonome

1. Le moteur transmet à l'agent un instantané validé de l'état de la partie.
2. L'agent vérifie que les préconditions du Monster Turn sont satisfaites.
3. Il résout la phase Spawn et les éventuels tirages.
4. Il tire ou reçoit la première carte d'activation.
5. Il identifie le monstre admissible, sa cible et son plan d'action.
6. Il résout la première activation.
7. Il tire ou reçoit la deuxième carte d'activation.
8. Il résout la seconde activation.
9. Il vérifie les conditions de fin de phase et les éventuels effets différés.
10. Il produit un résumé des actions à exécuter physiquement et remet le contrôle au tour de guilde.

#### Rôle de l'agent IA

L'agent est responsable de la stratégie et de l'orchestration des décisions du Monster Turn. Il doit choisir une action cohérente parmi les actions légales, en respectant notamment :
- les priorités de ciblage officielles ;
- les distances et règles de sélection spécifiques au mode solo ;
- les gardes et exceptions ;
- les points de mouvement disponibles ;
- les portes, portails, obstacles et lignes de vue ;
- les capacités spéciales des monstres ;
- les règles particulières du scénario et des extensions ;
- les règles de départage lorsque le livret en prévoit.

L'agent ne doit jamais inventer une règle pour résoudre une situation ambiguë. Il doit appliquer une règle de départage officielle lorsqu'elle existe. Si le livret laisse réellement le choix au joueur, le comportement par défaut doit être défini dans les préférences de campagne (par exemple une politique tactique configurable) ; l'agent peut alors choisir automatiquement selon cette politique, sans interrompre le tour.

#### Rôle de l'écran

L'écran devient un **tableau de suivi de l'agent**, et non un assistant de décision.

Il affiche :
- état de l'agent : prêt, en cours, en attente d'une action physique, bloqué ou terminé ;
- phase et étape actuellement traitées ;
- animation ou indicateur de progression ;
- dés et cartes tirés par l'application ;
- monstres activés et cibles choisies ;
- déplacements et actions décidés ;
- instructions physiques regroupées et ordonnées ;
- résultat des attaques et conséquences calculées ;
- journal des décisions et règles appliquées ;
- alertes si l'état du plateau doit être corrigé.

L'agent doit pouvoir traiter plusieurs décisions successives sans afficher un dialogue à chaque étape. Le joueur peut consulter le détail d'une décision, mais cette consultation ne doit pas être nécessaire au déroulement normal.

#### Interventions physiques et exceptions

L'autonomie logicielle ne signifie pas que l'application manipule les figurines ou les cartes physiques. Le joueur reste chargé d'exécuter les actions matérielles et de saisir les informations que l'application ne peut pas observer.

L'agent peut demander une intervention uniquement dans les cas suivants :
- déplacer une figurine ou appliquer physiquement un effet ;
- résoudre un résultat de dé ou de carte physique si le mode matériel est activé ;
- renseigner une position inconnue ou corriger une divergence avec le plateau ;
- départager un cas que les règles laissent explicitement au choix du joueur et pour lequel aucune politique automatique n'a été configurée ;
- résoudre une ambiguïté de règle non documentée.

En mode entièrement numérique pour les tirages, l'agent tire lui-même les dés et cartes virtuels. En mode matériel, il attend uniquement la saisie du résultat physique concerné, puis reprend automatiquement son exécution.

#### Contrôles disponibles pour le joueur

- Lancer le Monster Turn.
- Suspendre l'agent.
- Reprendre l'exécution.
- Arrêter le Monster Turn en cours.
- Consulter le journal détaillé.
- Corriger l'état physique ou logique.
- Annuler la dernière transaction lorsque cela est encore sûr.
- Rejouer une séquence avec une graine aléatoire connue (mode debug).

Une interruption ne doit jamais laisser un état partiellement modifié sans transaction récupérable. Chaque activation doit être enregistrée comme une transaction cohérente, avec son état avant/après et les événements associés.

### G. Gestion manuelle de l'état

Le joueur doit pouvoir corriger :
- position d'une figurine ;
- blessures d'un héros ;
- mort ou résurrection ;
- présence d'un monstre ;
- contenu de la Spawn Tile ;
- état d'une porte ;
- état d'un portail si applicable ;
- garde ou non-garde ;
- accomplissement d'une quête ;
- état d'un familier ou d'une monture.

Toute modification manuelle importante doit être historisée.

### H. Fin de scénario et campagne

- Résultat : victoire ou défaite.
- Nombre de morts.
- Quêtes réalisées.
- Récompenses.
- Pièces et trésors.
- Malédictions éventuelles.
- Phase d'amélioration.
- Choix du prochain scénario.
- Mise à jour de la campagne.

## 4.4 Principes UX

- Ne jamais afficher un grand formulaire pendant la partie si une question ponctuelle suffit.
- Présenter les informations indispensables à l'action courante en premier.
- Distinguer visuellement une instruction officielle, une décision automatique et une saisie du joueur.
- Toujours proposer une explication consultable.
- Ne pas imposer de saisie de position pour les éléments qui n'influencent pas la décision en cours.
- Prévoir un mode compact et un mode détaillé.
- Prévoir une confirmation avant les opérations irréversibles.
- Les actions de correction ne doivent pas effacer l'historique.

---

# 5. Architecture technique

## 5.1 Stack retenue

| Domaine | Technologie | Décision |
|---|---|---|
| Application | React | Retenu |
| Langage | TypeScript | Retenu |
| Bundler | Vite | Retenu |
| UI | React + Tailwind CSS | Recommandé |
| État d'interface | Zustand | Recommandé |
| Moteur de règles | TypeScript pur | Obligatoire |
| Validation de données | ArkType | Recommandé |
| Persistance locale | IndexedDB via Dexie | Recommandé |
| Tests | Vitest | Retenu |
| Tests composants | React Testing Library | Retenu |
| DOM de test | jsdom | Retenu |
| Carte tactique | PixiJS | Optionnelle / progressive |
| 3D | Three.js | Non retenu pour le MVP |
| PWA | Vite PWA ou solution équivalente | À intégrer |
| Tests navigateur | Playwright | **Exclu à la demande** |

Ne pas ajouter Playwright au projet, aux scripts ou à la CI.

## 5.2 Pourquoi pas Three.js en V1

Le jeu se déroule physiquement sur une table. Le besoin est de représenter des positions et des relations tactiques, pas de reconstruire le plateau en 3D.

Three.js ajouterait :
- une couche de rendu et de caméra ;
- une gestion de modèles et de matériaux ;
- des interactions spatiales plus complexes ;
- une charge de maintenance sans bénéfice fonctionnel décisif pour le MVP.

Il pourra être réévalué uniquement si un besoin concret de visualisation 3D apparaît.

## 5.3 Rôle de PixiJS

PixiJS peut fournir une carte tactique 2D facultative :

- représentation schématique des cases ;
- positions des héros et monstres ;
- Spawn Points ;
- gardes ;
- portes, murs, portails et obstacles ;
- surbrillance du chemin calculé ;
- portée d'attaque et zones pertinentes ;
- sélection et déplacement manuel des pions.

La carte ne doit pas devenir une dépendance du moteur. Le moteur reçoit un modèle abstrait du plateau et renvoie des décisions ; PixiJS ne fait que visualiser ce modèle.

La première version peut fonctionner sans carte PixiJS, avec une liste des unités et une saisie de position simplifiée.

## 5.4 Structure de dossiers proposée

```text
src/
├── app/
│   ├── routes/
│   ├── layout/
│   └── providers/
├── features/
│   ├── campaign/
│   ├── setup/
│   ├── guild/
│   ├── monster-turn/
│   ├── scenario/
│   ├── inventory/
│   ├── history/
│   └── settings/
├── engine/
│   ├── domain/
│   │   ├── entities/
│   │   ├── identifiers/
│   │   ├── state/
│   │   └── events/
│   ├── rules/
│   │   ├── base/
│   │   ├── solo/
│   │   ├── expansions/
│   │   └── scenarios/
│   ├── turn/
│   ├── spawn/
│   ├── activation/
│   ├── targeting/
│   ├── movement/
│   ├── combat/
│   ├── campaign/
│   └── validation/
├── game-data/
│   ├── heroes/
│   ├── monsters/
│   ├── items/
│   ├── cards/
│   ├── quests/
│   ├── scenarios/
│   └── expansions/
├── rendering/
│   └── pixi/
│       ├── board/
│       ├── entities/
│       ├── interactions/
│       └── overlays/
├── infrastructure/
│   ├── persistence/
│   ├── export/
│   └── import/
├── stores/
├── components/
└── tests/
    ├── fixtures/
    ├── scenarios/
    └── rules/
```

## 5.5 Règle d'architecture fondamentale

`engine/` ne doit importer aucun module React, Zustand, PixiJS, navigateur ou IndexedDB.

Le moteur doit pouvoir être exécuté directement dans Vitest avec un état de jeu en mémoire.

Les dépendances doivent aller vers le domaine, jamais l'inverse :

```text
React UI ───────┐
Pixi renderer ──┼──> Application services / Orchestrator ───> Engine
Persistence ────┘                                      └────> Game data
```

---

# 6. Modèle de domaine et données

## 6.1 Entités principales

Prévoir au minimum :

- Campaign
- Scenario
- ScenarioDefinition
- GameSession
- Round
- Turn
- Guild
- Hero
- Monster
- Pet
- Mount
- Board
- Space
- SpawnPoint
- SpawnTile
- Door
- Portal
- Obstacle
- Quest
- Item
- UpgradeCard
- MonsterCard
- MonsterActivationCard
- ActivationDeck
- DiscardPile
- GuardAssignment
- Wound
- Death
- Curse
- Reward
- GameEvent
- RuleDefinition

## 6.2 Séparer définition et instance

Les données statiques ne doivent pas être mélangées avec l'état de la partie.

Exemple :

```ts
interface MonsterDefinition {
  id: string;
  name: string;
  tier: number;
  movement: number;
  cardSets: Record<string, MonsterLevelStats>;
  abilities: MonsterAbility[];
}

interface MonsterInstance {
  id: string;
  definitionId: string;
  level: number;
  position: Position;
  status: "board" | "spawn-tile" | "box" | "removed";
  isGuard: boolean;
  wounds: number;
}
```

Même principe pour héros, cartes, scénarios, objets et quêtes.

## 6.3 État de partie

Le `GameState` doit contenir au minimum :

- identifiant de session ;
- scénario et difficulté ;
- extensions activées ;
- manche et phase ;
- héros et états ;
- monstres et états ;
- familiers et montures ;
- positions ;
- portes, portails et obstacles utiles ;
- Spawn Tile ;
- Spawn Points ;
- deck d'activation ;
- défausse ;
- cartes temporaires ;
- quêtes ;
- compteur de morts ;
- journal d'événements ;
- état de campagne associé ;
- version du schéma de sauvegarde ;
- graine RNG si les tirages numériques sont activés.

## 6.4 Decks et cartes

Ne pas coder un deck comme un simple nombre restant. Il doit distinguer :

- cartes disponibles ;
- carte supérieure ;
- cartes révélées ;
- cartes défaussées ;
- cartes temporairement exclues ;
- cartes ajoutées en cours de partie ;
- cartes à réintégrer lors du recyclage.

Les modifications de deck spécifiques à un scénario doivent être explicites et auditables.

## 6.5 Positions et plateau

Le modèle de plateau doit permettre de représenter :
- adjacency orthogonale ;
- adjacency diagonale si une règle le permet ;
- coûts de déplacement ;
- murs et cases bloquées ;
- portes ouvertes ou fermées ;
- portails et liens de téléportation ;
- obstacles ;
- zones ou effets de terrain ;
- ligne de vue ;
- portée d'attaque ;
- Spawn Points.

Ne pas supposer que tous les scénarios partagent une géométrie identique.

## 6.6 Versionnement des données

Les définitions de cartes et de scénarios doivent être versionnées. Les sauvegardes doivent embarquer ou référencer une version de contenu précise afin qu'une mise à jour de l'application ne change pas silencieusement une campagne en cours.

---

# 7. Moteur de règles et automate

## 7.1 Architecture IA : autonomie avec garde-fous de règles

Le Monster Turn est piloté par un agent IA autonome. Il ne s'agit pas d'un simple moteur de règles qui affiche des consignes : l'agent analyse l'état, planifie et enchaîne les décisions jusqu'à la fin de la phase.

L'IA ne doit toutefois pas être l'unique source de vérité. L'architecture sépare trois responsabilités :

1. **Agent IA (décision et orchestration)** : interprète le contexte structuré, choisit les actions, planifie les activations et appelle les outils nécessaires.
2. **Moteur de règles déterministe (validation)** : vérifie qu'une action est légale, calcule les distances, chemins, portées, effets et transitions selon les règles formalisées.
3. **Gestionnaire d'état (exécution transactionnelle)** : applique les actions validées, journalise les événements et garantit que l'état ne peut pas être corrompu.

L'agent est autonome dans ses décisions, mais il ne peut pas contourner les validations du moteur. Une action proposée par l'IA qui ne respecte pas les règles est rejetée ; l'agent reçoit l'erreur structurée et doit recalculer.

L'agent doit être contraint à utiliser les règles et outils exposés par l'application. Il ne doit pas inventer de statistiques, de cartes, de capacités ou de règles. Les règles officielles et les données du scénario restent la source de vérité.

L'agent doit fonctionner avec un état de jeu structuré et versionné, jamais à partir d'une simple description textuelle libre du plateau.

Les tirages doivent passer par une interface injectée :

```ts
interface RandomSource {
  nextInt(min: number, max: number): number;
}
```

Deux modes :
- dés physiques : le joueur saisit les résultats ;
- dés numériques : l'application génère les résultats.

Ne pas imposer l'un des deux modes.

## 7.2 Agent Monster Turn et orchestrateur de partie

Créer un agent dédié au Monster Turn et un orchestrateur qui pilote les phases globales. L'agent dispose d'outils métier strictement typés, par exemple :

- `getGameState`
- `validateMonsterTurn`
- `drawSpawnDice`
- `drawActivationCard`
- `getEligibleMonsters`
- `getMonsterSelectionDistances`
- `getLegalTargets`
- `getReachableAttackPositions`
- `calculateLegalPath`
- `simulateMonsterAction`
- `validateAction`
- `commitAction`
- `getPendingPhysicalActions`
- `completeMonsterTurn`

Ces outils ne doivent pas exposer de mutation arbitraire. Toute mutation passe par une commande validée par le moteur et appliquée transactionnellement.

L'agent doit suivre une boucle contrôlée :

1. observer l'état ;
2. identifier l'étape courante ;
3. choisir l'action suivante ;
4. appeler l'outil métier correspondant ;
5. vérifier le résultat ;
6. poursuivre tant que le Monster Turn n'est pas terminé et qu'aucune intervention physique n'est requise.

L'orchestrateur global valide les transitions :

```text
SCENARIO_SETUP
  -> GUILD_TURN
      -> HERO_ACTIVATIONS
      -> REST
  -> MONSTER_TURN
      -> SPAWN
      -> MONSTER_ACTIVATION_1
      -> MONSTER_ACTIVATION_2
  -> GUILD_TURN
  -> ...
  -> SCENARIO_WON | SCENARIO_LOST
```

Cette machine standard doit être extensible pour les Dragons et les exceptions de scénario.

Les transitions doivent être centralisées et testées.

## 7.3 Pipeline d'une activation de monstre

Le traitement doit être décomposé en services distincts :

1. `resolveSpawnPhase`
2. `rollOrAcceptSpawnPoint`
3. `drawMonsterActivationCard`
4. `findEligibleMonster`
5. `skipGuardMonsters`
6. `resolveMonsterTarget`
7. `calculateMonsterMovement`
8. `buildActivationInstructions`
9. `confirmPhysicalAction`
10. `resolveAttackAndReactions`
11. `discardActivationCard`

Chaque service doit retourner un résultat structuré et une liste d'explications.

## 7.4 Sélection du monstre

Algorithme spécifique :

- prendre le Spawn Point tiré ;
- filtrer les monstres du type de la carte ;
- considérer les monstres activables présents sur le plateau ;
- calculer la distance orthogonale simplifiée ;
- trier par distance ;
- si le plus proche est un garde, l'ignorer et poursuivre avec le suivant ;
- en cas d'égalité entre plusieurs candidats admissibles, demander un choix au joueur ;
- si aucun monstre n'est disponible, appliquer le comportement prévu par le livret ou la FAQ, après vérification.

Ne jamais fusionner ce calcul avec le calcul de chemin de déplacement.

## 7.5 Ciblage

Le ciblage standard doit :
- identifier les héros éligibles ;
- calculer la proximité conformément aux règles officielles ;
- choisir le héros le plus proche ;
- départager en faveur du héros ayant le plus de blessures si plusieurs héros sont éligibles ;
- demander au joueur de choisir si l'égalité persiste.

Avec Wild Pet, la cible devient le familier de guilde le plus proche pour l'activation concernée.

Les règles des Huge Characters, monstres à capacité spéciale et scénarios doivent être des stratégies de ciblage dédiées.

## 7.6 Déplacement

Le déplacement doit calculer un chemin valide selon les règles du jeu de base et les règles spécifiques :

- coût des cases ;
- portes ;
- portails ;
- obstacles ;
- unités bloquantes ;
- destination d'attaque ;
- points de mouvement disponibles ;
- règle d'utilisation minimale des points de mouvement pour atteindre une attaque.

Le moteur doit retourner :
- chemin proposé ;
- coût de chaque étape ;
- actions intermédiaires ;
- destination ;
- points de mouvement restants ;
- raisons d'impossibilité éventuelles.

Si plusieurs chemins sont équivalents, la règle de départage doit être définie et documentée. Si le livret ne définit pas ce départage, demander au joueur de choisir ou appliquer une option configurable clairement identifiée comme choix d'implémentation.

## 7.7 Attaque et réactions

Le moteur doit formaliser séparément :
- attaque du monstre pendant son activation ;
- réaction Guard ;
- réaction Payback ;
- attaques ciblant plusieurs unités ;
- choix du monstre activé en Payback selon la FAQ ;
- effets de cartes et capacités ;
- résolution des blessures et morts.

Le moteur peut guider la résolution tout en laissant le joueur lancer les dés physiques et saisir le résultat.

## 7.8 Décision explicable et journal de l'agent

Chaque décision de l'agent doit produire un objet structuré. Il faut conserver une explication opérationnelle vérifiable, et non exposer une chaîne de pensée interne libre. Le journal doit indiquer les données observées, les règles appliquées, les candidats, le choix effectué et le résultat de validation.

Chaque décision de l'automate doit produire un objet du type :

```ts
interface DecisionTrace {
  decisionId: string;
  ruleIds: string[];
  summary: string;
  explanation: string[];
  candidates?: string[];
  selectedEntityId?: string;
  rejectedCandidates?: {
    entityId: string;
    reason: string;
  }[];
}
```

Exemple d'explication :
- « La carte révélée demande un Orc. »
- « Le Spawn Point indiqué est celui associé au résultat des dés. »
- « Cet Orc est le plus proche selon la distance orthogonale utilisée pour la sélection. »
- « Le garde situé plus près a été ignoré, car les gardes ne sont pas activés par le Monster Turn. »

## 7.9 Fiabilité et limites de l'agent IA

- Utiliser des sorties structurées validées par schéma, jamais du texte libre comme commande.
- Définir un nombre maximal d'appels et une limite de temps par Monster Turn.
- Prévoir une détection de boucle : l'agent ne doit pas répéter indéfiniment la même action.
- Vérifier chaque action avant son application.
- Rendre les commandes idempotentes ou munies d'identifiants de transaction pour éviter les doubles applications.
- Enregistrer le prompt système, la version du modèle, les outils disponibles, les entrées et les décisions nécessaires à la reproductibilité, dans le respect de la confidentialité.
- Prévoir un mode déterministe de simulation pour les tests, sans appel à un modèle distant.
- Prévoir un mode de secours fondé sur des règles déterministes si le service IA est indisponible.
- Si l'agent ne peut pas produire une action légale, il doit s'arrêter proprement, conserver l'état précédent et signaler le blocage.
- Ne jamais laisser le modèle modifier directement la base de données ou le GameState.
- La logique de règles ne doit pas être confiée à la mémoire implicite du modèle : elle doit être fournie par les données et outils du jeu.

### Politique de choix lorsque le livret laisse le choix au joueur

Certaines situations peuvent laisser un choix explicite au joueur, notamment une égalité. Pour rendre le Monster Turn réellement autonome, la campagne doit proposer une politique de décision configurable, par exemple :
- priorité à la cible la plus proche ;
- priorité au héros ayant le plus de blessures ;
- priorité à la cible présentant le meilleur potentiel d'attaque ;
- priorité à la progression vers un objectif ;
- ordre stable par identifiant en dernier recours.

Ces critères sont des **politiques d'automatisation**, pas des règles officielles. Elles doivent être clairement identifiées comme telles et ne s'appliquer que lorsque le livret laisse une liberté de choix.

---

# 8. Gestion des actions physiques et synchronisation

## 8.1 Répartition des responsabilités

| Action | Responsable |
|---|---|
| Décider de l'activation et du plan d'action | Agent IA |
| Tirer les dés numériques | Agent via service RNG |
| Tirer les cartes numériques | Agent via service de deck |
| Déterminer le monstre activé | Agent IA, validé par le moteur |
| Déterminer la cible | Agent IA, validé par le moteur |
| Calculer et choisir le chemin | Agent IA via outils de pathfinding |
| Valider la légalité du déplacement | Moteur de règles |
| Mettre à jour l'état numérique | Gestionnaire d'état |
| Déplacer physiquement une figurine | Joueur |
| Lancer les dés physiques | Joueur, si mode matériel |
| Saisir un résultat physique | Joueur |
| Tirer une carte physique | Joueur, si mode matériel |
| Exécuter physiquement les effets | Joueur |
| Confirmer une action matérielle | Joueur |

L'application ne doit jamais supposer qu'une action physique a été réalisée sans confirmation.

## 8.2 Mode autonome recommandé et mode matériel

Pour obtenir une autonomie réelle de l'agent, le mode recommandé est :
- dés numériques ;
- deck d'activation numérique ;
- décisions et déplacements calculés par l'agent ;
- mise à jour automatique de l'état logique ;
- joueur chargé uniquement de déplacer les figurines et d'appliquer les effets physiques.

Un mode matériel reste disponible :
- le joueur lance les dés ou tire les cartes physiques ;
- il saisit le résultat ;
- l'agent reprend automatiquement le traitement sans lui demander de choisir la suite.

Chaque élément aléatoire ou deck peut donc être paramétré en matériel, numérique ou hybride. Le choix est mémorisé dans la campagne.

## 8.3 Confirmation et divergence

Après chaque instruction :
- le joueur confirme que l'action a été réalisée ;
- ou indique qu'elle est impossible ;
- ou corrige la position réelle ;
- ou demande un recalcul.

Le moteur ne doit pas continuer avec un état supposé si la réalité physique diverge.

---

# 9. Persistance, historique et reprise

## 9.1 Persistance

Utiliser IndexedDB via Dexie, avec :
- campagnes ;
- sessions ;
- états de partie ;
- événements ;
- préférences ;
- contenu installé.

## 9.2 Sauvegarde

Sauvegarder :
- après chaque transition importante ;
- après chaque confirmation physique ;
- après chaque tirage ;
- après chaque modification manuelle ;
- à la fin d'une phase.

Prévoir aussi une sauvegarde manuelle.

## 9.3 Historique et annulation

Journaliser les événements sous forme d'actions :
- activation commencée ;
- carte révélée ;
- monstre sélectionné ;
- mouvement confirmé ;
- attaque résolue ;
- blessure appliquée ;
- mort enregistrée ;
- quête accomplie ;
- carte défaussée ;
- phase changée.

L'annulation doit restaurer un état cohérent. Ne pas simplement décrémenter une valeur isolée.

Pour les actions physiques déjà réalisées, afficher un avertissement et demander confirmation avant d'annuler l'état numérique.

## 9.4 Export et import

Prévoir :
- export JSON d'une campagne ;
- import JSON avec validation ArkType ;
- version de schéma ;
- migrations de sauvegarde ;
- sauvegarde de secours avant migration.

Aucune donnée personnelle ne doit être envoyée à un serveur dans le MVP.

---

# 10. Contenu du jeu et administration des données

## 10.1 Données à inventorier

Construire un inventaire structuré des éléments effectivement possédés et pris en charge :

- héros ;
- monstres et tiers ;
- cartes de monstres par niveau ;
- cartes d'activation ;
- objets ;
- cartes d'amélioration ;
- quêtes PvE ;
- jetons ;
- scénarios ;
- extensions ;
- cartes spéciales solo ;
- exceptions de scénario.

Ne pas présumer que l'utilisateur possède toutes les extensions.

## 10.2 Format des données

Les données statiques doivent être stockées dans des fichiers TypeScript ou JSON validés par ArkType.

Exemple de définition de scénario :

```ts
interface ScenarioDefinition {
  id: string;
  name: string;
  source: RuleSource[];
  supportedExpansions: string[];
  setup: ScenarioSetupDefinition;
  monsters: ScenarioMonsterSetup[];
  guards: GuardSetup[];
  spawnPoints: SpawnPointDefinition[];
  activationDeck: ActivationDeckSetup;
  quests: QuestDefinition[];
  victory: VictoryCondition;
  defeat: DefeatCondition;
  specialRules: RuleReference[];
}
```

## 10.3 Outil de contrôle du contenu

Créer un script ou une page de développement qui vérifie :
- références inconnues ;
- cartes manquantes ;
- doublons d'identifiants ;
- scénario sans condition de victoire ;
- monstre sans statistiques pour un niveau utilisé ;
- règle spéciale sans source ;
- nombre de cartes incohérent ;
- extension incompatible.

---

# 11. Tests et qualité

## 11.1 Outils

- Vitest pour les tests unitaires et d'intégration.
- React Testing Library pour les composants.
- jsdom pour les tests DOM.
- Mocks ciblés pour PixiJS.
- ArkType pour valider les données.
- Aucun Playwright.

## 11.2 Tests du moteur

Tester au minimum :

### Phases
- activation des héros ;
- ordre libre des héros ;
- repos ;
- Monster Turn après activation ;
- Monster Turn après repos ;
- transitions invalides ;
- fin de scénario.

### Spawn
- Spawn Tile non pleine ;
- Spawn Tile pleine ;
- plusieurs monstres à faire apparaître ;
- absence de place ;
- règles de scénario modifiant le spawn.

### Activation
- résultat de dés valide ;
- résultat de dés absent et relance ;
- carte de monstre standard ;
- deux activations successives ;
- même type de monstre activé deux fois ;
- deck vide et recyclage ;
- monstre absent ;
- garde le plus proche ;
- plusieurs gardes ;
- égalité de distance.

### Ciblage et déplacement
- héros le plus proche ;
- plusieurs héros éligibles ;
- départage par blessures ;
- égalité persistante ;
- porte fermée ;
- porte ouverte ;
- portail ;
- chemin bloqué ;
- points de mouvement insuffisants ;
- destination d'attaque ;
- familier ciblé par Wild Pet ;
- Huge Character et poussée.

### Combat et morts
- attaque ;
- Payback ;
- Guard ;
- attaque visant plusieurs monstres ;
- sélection du monstre de tier le plus élevé en Payback ;
- mort de héros ;
- seuil de défaite ;
- mort de familier ;
- mort de monture.

### Campagne
- victoire ;
- défaite ;
- progression ;
- récompenses ;
- malédictions ;
- phase d'amélioration ;
- sauvegarde/reprise.

## 11.3 Tests de scénarios complets

Créer des scénarios de test reproductibles avec :
- état initial ;
- extensions activées ;
- séquence de tirages ;
- actions confirmées ;
- résultats attendus ;
- journal attendu.

Chaque règle officielle doit être couverte par au moins un test lorsque cela est possible.

## 11.4 Reproductibilité

- Injecter une source aléatoire.
- Utiliser des graines fixes dans les tests.
- Conserver les tirages dans le journal.
- Permettre de rejouer un scénario de test à l'identique.

## 11.5 Tests manuels de validation

Préparer une checklist de tests sur tablette :
- orientation paysage ;
- taille des zones tactiles ;
- lisibilité à distance de jeu ;
- utilisation d'une seule main si possible ;
- reprise après fermeture ;
- mode hors ligne ;
- perte de focus ;
- correction d'une erreur de saisie ;
- scénario long avec plusieurs manches.

---

# 12. Plan de réalisation par phases

Chaque phase doit se terminer par un livrable vérifiable. Ne pas commencer la phase suivante si les critères de sortie ne sont pas remplis.

## Phase 0 — Audit des règles et cadrage

### Tâches
1. Extraire le sommaire et la structure des deux livrets.
2. Répertorier les règles de base utiles au compagnon.
3. Répertorier toutes les règles du mode solo.
4. Répertorier les extensions et changements de scénarios présents dans le livret solo.
5. Associer chaque règle à une source et une page.
6. Construire le registre des ambiguïtés.
7. Identifier les composants physiques nécessaires.
8. Définir le périmètre exact du premier scénario jouable.
9. Définir les choix configurables : dés physiques/numériques, cartes physiques/numériques.
10. Faire valider les interprétations par un test de jeu réel.

### Livrables
- `docs/rules/rule-inventory.md`
- `docs/rules/rule-traceability.csv` ou JSON
- `docs/rules/open-questions.md`
- inventaire des composants et scénarios.

### Critères de sortie
- toutes les règles utilisées par le MVP ont une source ;
- aucune règle ambiguë n'est codée comme certaine ;
- le scénario MVP est identifié ;
- les actions physiques et numériques sont séparées.

## Phase 1 — Initialisation du projet

### Tâches
1. Créer le projet Vite React TypeScript.
2. Configurer ESLint et Prettier.
3. Configurer les chemins d'import.
4. Installer Zustand.
5. Installer ArkType.
6. Installer Dexie.
7. Configurer Vitest et jsdom.
8. Configurer React Testing Library.
9. Ajouter les scripts de test, lint, typecheck et build.
10. Configurer Tailwind CSS.
11. Mettre en place la structure de dossiers.
12. Ajouter une documentation de développement.
13. Configurer l'intégration continue sans Playwright.

### Livrables
- application initiale ;
- pipeline CI ;
- conventions de code ;
- tests de démonstration.

### Critères de sortie
- build réussi ;
- tests réussis ;
- typecheck réussi ;
- aucun Playwright dans les dépendances ou scripts.

## Phase 2 — Modèle de domaine

### Tâches
1. Définir les identifiants.
2. Définir les entités statiques.
3. Définir les instances de jeu.
4. Définir le GameState.
5. Définir les positions et le plateau abstrait.
6. Définir les decks et défausses.
7. Définir les quêtes.
8. Définir les événements.
9. Définir les traces de décision.
10. Ajouter les schémas ArkType.
11. Créer des fixtures de test.
12. Valider les invariants du domaine.

### Critères de sortie
- domaine indépendant de React ;
- données valides ;
- états invalides détectés ;
- tests unitaires du modèle.

## Phase 3 — Règles de base

### Tâches
1. Implémenter les types et caractéristiques des unités.
2. Implémenter la géométrie des cases.
3. Implémenter les déplacements de base.
4. Implémenter portes et portails.
5. Implémenter les distances et adjacency.
6. Implémenter portée et ligne de vue.
7. Implémenter les attaques et défenses nécessaires au scénario MVP.
8. Implémenter blessures et morts.
9. Implémenter les réactions Guard et Payback.
10. Implémenter les quêtes PvE du scénario MVP.
11. Ajouter un test par règle.
12. Vérifier les résultats avec le livret français.

### Critères de sortie
- toutes les règles de base nécessaires au scénario MVP sont testées ;
- les règles non nécessaires sont documentées comme non implémentées, pas simulées.

## Phase 4 — Mode solo : tours et decks

### Tâches
1. Implémenter la machine à états des manches.
2. Implémenter le tour de guilde.
3. Implémenter activation des trois héros.
4. Implémenter repos.
5. Implémenter le Monster Turn après activation ou repos.
6. Implémenter le Spawn step.
7. Implémenter le Monster Activation deck.
8. Implémenter le recyclage de la défausse.
9. Implémenter les cartes de niveaux alternatifs.
10. Implémenter les deux activations de monstres.
11. Implémenter le suivi du compteur de morts.
12. Implémenter les seuils de difficulté.
13. Implémenter victoire et défaite.
14. Ajouter les tests de conformité au livret solo.

### Critères de sortie
- une manche complète fonctionne sans interface graphique ;
- les transitions sont déterministes ;
- le seuil de défaite est correct ;
- le journal retrace chaque étape.

## Phase 5 — Automate de sélection, ciblage et déplacement

### Tâches
1. Définir le contrat de l'agent IA et ses entrées/sorties structurées.
2. Définir les outils métier autorisés et leurs schémas.
3. Implémenter le calcul de distance Spawn Point → monstre.
2. Vérifier qu'il ignore les éléments de terrain pour la sélection.
3. Implémenter les égalités de sélection.
4. Implémenter l'exclusion des gardes.
5. Implémenter le ciblage des héros.
6. Implémenter le départage par blessures.
7. Implémenter les égalités de cible.
8. Implémenter le pathfinding normal.
9. Implémenter le coût des portes et portails.
10. Implémenter le choix du chemin optimal.
11. Implémenter les instructions de déplacement.
12. Implémenter le cas « aucun chemin possible ».
13. Implémenter les traces explicatives.
14. Ajouter les tests de scénarios limites.

### Critères de sortie
- l'agent pilote une activation de monstre de bout en bout ;
- l'agent peut enchaîner les deux activations du Monster Turn sans décision stratégique du joueur ;
- toutes les actions proposées sont validées par le moteur ;
- la sélection et le pathfinding sont bien distincts ;
- chaque choix est explicable ;
- les cas d'égalité sont gérés par une règle officielle ou une politique configurable ;
- les erreurs IA et boucles sont détectées et récupérables.

## Phase 6 — Orchestrateur et synchronisation physique

### Tâches
1. Créer l'orchestrateur applicatif.
2. Définir les commandes disponibles à chaque phase.
3. Gérer les confirmations du joueur.
4. Gérer les actions impossibles.
5. Gérer les corrections de position.
6. Gérer dés physiques et dés numériques.
7. Gérer cartes physiques et cartes numériques si retenues.
8. Empêcher les doubles activations.
9. Prévoir l'annulation contrôlée.
10. Prévoir les divergences entre état numérique et plateau physique.
11. Ajouter les tests d'intégration.

### Critères de sortie
- une partie peut être conduite étape par étape ;
- aucune action physique n'est considérée comme faite sans confirmation ;
- les erreurs de saisie peuvent être corrigées.

## Phase 7 — Interface React MVP

### Tâches
1. Créer le layout tablette paysage.
2. Créer l'accueil.
3. Créer la gestion des campagnes.
4. Créer la sélection de héros.
5. Créer l'assistant de préparation.
6. Créer le tableau de bord.
7. Créer la fiche héros.
8. Créer la liste des monstres.
9. Créer l'écran du Monster Turn.
10. Créer les dialogues de choix et d'égalité.
11. Créer les confirmations physiques.
12. Créer l'historique.
13. Créer l'écran de victoire/défaite.
14. Ajouter les états vides, erreurs et chargements.
15. Tester les composants avec React Testing Library.

### Critères de sortie
- un scénario MVP peut être joué de bout en bout depuis l'interface ;
- l'interface est utilisable sur tablette ;
- les décisions de l'automate sont compréhensibles.

## Phase 8 — Persistance et PWA

### Tâches
1. Créer le schéma Dexie.
2. Persister campagnes et sessions.
3. Persister l'état après chaque transition.
4. Ajouter reprise de partie.
5. Ajouter export/import JSON.
6. Ajouter migrations de schéma.
7. Configurer le cache applicatif.
8. Configurer le mode offline.
9. Tester fermeture et reprise.
10. Tester les erreurs de migration et sauvegarde.

### Critères de sortie
- une campagne est conservée localement ;
- une partie peut être reprise sans perte ;
- l'application fonctionne hors ligne après installation.

## Phase 9 — Carte tactique PixiJS

Cette phase peut être menée après un MVP jouable sans carte.

### Tâches
1. Définir un format de plateau indépendant du renderer.
2. Créer le canvas PixiJS.
3. Dessiner cases et limites.
4. Dessiner portes, murs, portails et obstacles.
5. Dessiner les Spawn Points.
6. Dessiner héros, monstres, gardes et familiers.
7. Ajouter zoom et déplacement de caméra.
8. Ajouter sélection d'entités.
9. Ajouter déplacement manuel des pions.
10. Ajouter surbrillance du chemin calculé.
11. Ajouter les overlays de portée et de ligne de vue.
12. Synchroniser la carte avec le GameState.
13. Ajouter des tests du mapping et des interactions critiques.

### Critères de sortie
- la carte reflète l'état du moteur ;
- elle ne contient aucune règle métier ;
- le joueur peut corriger rapidement une position.

## Phase 10 — Campagne et amélioration

### Tâches
1. Implémenter la structure de campagne.
2. Implémenter les résultats de scénario.
3. Implémenter récompenses et pièces.
4. Implémenter malédictions.
5. Implémenter les cartes d'amélioration.
6. Implémenter le draft selon le livret.
7. Implémenter les limites d'équipement.
8. Implémenter la sélection du prochain scénario.
9. Implémenter les règles de progression.
10. Ajouter les tests de campagne.

### Critères de sortie
- une campagne de bout en bout est jouable avec les scénarios intégrés ;
- les récompenses et améliorations correspondent aux règles vérifiées.

## Phase 11 — Extensions

Traiter chaque extension comme un lot isolé avec règles, données, UX et tests propres.

Ordre de travail recommandé :
1. règles solo du jeu de base ;
2. Inferno et Beyond the Grave ;
3. Pets ;
4. Riders ;
5. Dragons ;
6. autres contenus réellement possédés et documentés.

Pour chaque extension :
- inventorier les composants ;
- formaliser les changements de règles ;
- identifier les cartes spécifiques solo ;
- définir les incompatibilités ;
- ajouter les données ;
- implémenter les règles ;
- ajouter les scénarios ;
- écrire les tests ;
- valider avec une partie physique.

### Critères de sortie
Une extension n'est marquée « prise en charge » que si ses scénarios et règles spécifiques sont couverts par les tests et une validation de jeu.

## Phase 12 — Exhaustivité des scénarios

### Tâches
1. Construire le catalogue des scénarios du contenu retenu.
2. Transcrire chaque mise en place.
3. Transcrire les monstres et niveaux.
4. Transcrire les gardes.
5. Transcrire les Spawn Points.
6. Transcrire les exceptions de deck.
7. Transcrire les cartes Wild Pet à ajouter.
8. Transcrire les quêtes et objectifs.
9. Transcrire les conditions de victoire.
10. Transcrire les changements spécifiques d'extension.
11. Ajouter un test de configuration par scénario.
12. Comparer chaque scénario au livret source.

### Critères de sortie
- chaque scénario annoncé comme disponible possède une configuration vérifiée ;
- aucun scénario n'est rendu disponible par défaut avec des données incomplètes.

## Phase 13 — Qualité, accessibilité et finition

### Tâches
1. Tester l'application sur plusieurs tailles d'écran.
2. Vérifier les contrastes.
3. Vérifier les tailles tactiles.
4. Ajouter labels et navigation clavier.
5. Vérifier les erreurs et confirmations.
6. Vérifier la résilience hors ligne.
7. Tester les sauvegardes volumineuses.
8. Optimiser les rendus React.
9. Optimiser le canvas PixiJS si présent.
10. Ajouter des données de démonstration.
11. Rédiger le guide utilisateur.
12. Rédiger le guide de contribution.
13. Faire plusieurs parties réelles de validation.

### Critères de sortie
- aucune perte d'état connue ;
- aucune règle du périmètre annoncé non testée ;
- parcours de jeu compréhensible sans documentation technique.

## Phase 14 — Livraison

### Tâches
1. Préparer une version de production.
2. Générer les assets et données nécessaires.
3. Vérifier le fonctionnement offline.
4. Vérifier export et import.
5. Publier une version statique.
6. Documenter l'installation.
7. Documenter les limites connues.
8. Taguer une version.
9. Archiver les règles et tests associés à cette version.

### Critères de sortie
- version installable ;
- campagne sauvegardée localement ;
- documentation utilisateur disponible ;
- limites et contenus supportés annoncés honnêtement.

---

# 13. Stratégie de livraison incrémentale

Ne pas chercher à intégrer toutes les extensions et tous les scénarios avant de disposer d'une partie jouable.

## MVP 1 — Une partie solo guidée

- jeu de base ;
- un scénario sélectionné et entièrement formalisé ;
- trois héros ;
- difficulté ;
- tour de guilde ;
- spawn ;
- deux activations de monstres ;
- gardes ;
- ciblage et déplacement ;
- saisie des dés physiques ;
- confirmation des actions ;
- victoire/défaite ;
- sauvegarde locale.

## MVP 2 — Expérience tablette aboutie

- tableau de bord complet ;
- historique ;
- annulation contrôlée ;
- PWA offline ;
- export/import ;
- carte tactique PixiJS facultative.

## V1 — Campagne de base

- progression de campagne ;
- récompenses ;
- malédictions ;
- phase d'amélioration ;
- scénarios de base intégrés et vérifiés.

## V1.x — Extensions

- extensions ajoutées par lots ;
- cartes solo spécifiques ;
- règles et scénarios propres ;
- tests de non-régression.

## V2 — Améliorations avancées

- assistant de mise en place plus rapide ;
- outils d'édition de scénarios internes ;
- import/export avancé ;
- statistiques de campagne ;
- outils de debug des règles ;
- optimisation de la carte tactique.

---

# 14. Critères d'acceptation globaux

Le projet ne peut être considéré comme terminé que lorsque les critères suivants sont satisfaits :

## Fidélité
- Toutes les règles du périmètre annoncé ont une source.
- Les exceptions de scénario sont appliquées.
- Les règles de difficulté et de défaite sont exactes.
- Les extensions annoncées comme supportées ont été vérifiées.

## Agent IA
- L'agent prend en charge le Monster Turn complet de manière autonome.
- Il peut tirer les dés et cartes numériques sans intervention.
- Il décide des monstres, cibles, chemins et actions.
- Le moteur valide toutes ses décisions avant mutation de l'état.
- Il s'arrête uniquement pour une intervention physique ou une ambiguïté réelle.
- Ses décisions sont traçables, reproductibles en mode test et récupérables en cas d'erreur.

## Automate
- Les deux activations du Monster Turn sont correctement résolues.
- Le calcul de sélection depuis le Spawn Point est distinct du pathfinding.
- Les gardes sont ignorés pour l'activation et perdent leur statut lorsqu'ils sont tués.
- Les égalités sont traitées explicitement.
- Chaque décision est expliquée.

## Synchronisation
- L'application attend la confirmation des actions physiques.
- Le joueur peut signaler une impossibilité.
- L'état peut être corrigé sans corrompre la partie.

## Persistance
- Une partie peut être fermée et reprise.
- Les campagnes sont conservées localement.
- Les migrations sont testées.
- Export et import sont fonctionnels.

## Qualité
- Le moteur est indépendant de React et PixiJS.
- Les tests passent.
- Aucun Playwright n'est utilisé.
- L'application fonctionne hors ligne.
- L'interface est adaptée à une tablette en paysage.

---

# 15. Risques et mesures de prévention

| Risque | Conséquence | Prévention |
|---|---|---|
| Règle mal interprétée | Automate incorrect | Traçabilité et validation sur le livret |
| Trop de saisies | Partie ralentie | Saisie progressive et minimale |
| État physique différent de l'application | Décisions erronées | Confirmation et correction à chaque étape |
| Scénarios codés en dur | Maintenance difficile | Données déclaratives et règles modulaires |
| Extensions mélangées au cœur | Régressions | Modules d'extension isolés |
| Pathfinding confondu avec sélection | Mauvais monstre activé | Deux algorithmes distincts |
| Deck mal géré | Activations incorrectes | Modèle explicite de deck/défausse |
| Sauvegarde incomplète | Perte de campagne | Journal d'événements et tests de reprise |
| Règles non sourcées | Règles inventées | Registre des ambiguïtés |
| Dépendance 3D inutile | Complexité | Pas de Three.js en MVP |
| Tests navigateur coûteux ou non souhaités | Stack inadaptée | Vitest + RTL, aucun Playwright |

---

# 16. Consignes impératives à l'agent de développement

1. Lire ce document avant toute modification.
2. Lire les deux livrets sources et consulter les pages concernées avant d'implémenter une règle.
3. Ne jamais inventer une règle manquante.
4. Ne jamais transformer une hypothèse en règle officielle.
5. Documenter toute ambiguïté et demander une validation lorsqu'elle affecte le comportement.
6. Implémenter les règles sous forme de fonctions testables.
7. Ne pas placer de logique métier dans les composants React.
8. Ne pas placer de logique métier dans PixiJS.
9. Ne pas introduire Three.js dans le MVP.
10. Ne pas installer ou utiliser Playwright.
11. Utiliser Vitest et React Testing Library.
12. Prévoir les modes dés physiques et dés numériques.
13. Ne pas supposer que toutes les extensions sont possédées ou activées.
14. Ne pas rendre un scénario disponible tant que sa configuration n'est pas vérifiée.
15. Associer chaque décision automatique à une explication et à une règle source.
16. Ajouter les tests en même temps que les règles.
17. Préserver les sauvegardes lors des évolutions de schéma.
18. Maintenir une documentation des fonctionnalités effectivement supportées.
19. Faire valider les scénarios par des parties physiques.
20. Livrer à chaque phase une version fonctionnelle, testée et documentée.

---

# 17. Definition of Done d'une règle

Une règle est terminée uniquement si :

- [ ] la source et la page sont identifiées ;
- [ ] son périmètre d'application est clair ;
- [ ] ses préconditions sont définies ;
- [ ] ses effets sont implémentés ;
- [ ] ses exceptions sont implémentées ;
- [ ] les ambiguïtés sont résolues ou explicitement bloquantes ;
- [ ] les tests nominaux existent ;
- [ ] les tests limites existent ;
- [ ] une trace explicative est produite ;
- [ ] la règle est validée lors d'une partie physique si elle influence une décision de l'automate.

# 18. Definition of Done d'un scénario

- [ ] Mise en place transcrite.
- [ ] Héros et zone de départ vérifiés.
- [ ] Monstres et niveaux vérifiés.
- [ ] Gardes vérifiés.
- [ ] Spawn Points vérifiés.
- [ ] Deck d'activation vérifié.
- [ ] Cartes exclues ou ajoutées vérifiées.
- [ ] Nombre de Wild Pet vérifié le cas échéant.
- [ ] Quêtes PvE vérifiées.
- [ ] Conditions de victoire et de défaite vérifiées.
- [ ] Règles spéciales transcrites.
- [ ] Tests de configuration écrits.
- [ ] Partie physique de validation effectuée.

# 19. Questions à trancher avant le développement complet

Ces questions doivent être confirmées au cadrage :

1. Quels contenus physiques l'utilisateur possède-t-il exactement : jeu de base et quelles extensions ?
2. Quel scénario doit servir de premier scénario MVP ?
3. Le joueur souhaite-t-il utiliser systématiquement les dés et cartes physiques, ou souhaite-t-il pouvoir basculer vers des tirages numériques ?
4. Le joueur souhaite-t-il renseigner toutes les positions sur une carte tactique, ou uniquement les positions utiles à l'automate ?
5. L'application doit-elle gérer toute la campagne dès la première livraison, ou d'abord des scénarios indépendants ?
6. Les noms et textes de cartes doivent-ils être saisis manuellement, ou l'utilisateur fournira-t-il un inventaire de son matériel pour constituer les données ?

Ces choix ne doivent pas retarder la formalisation des règles communes, mais ils conditionnent le périmètre exact du MVP.

---

# 20. Conclusion

La priorité est de construire un **moteur de règles fiable et explicable**, puis de le piloter avec une interface React conçue pour accompagner une vraie partie sur table.

La meilleure trajectoire est :

1. formaliser et tracer les règles ;
2. construire le moteur indépendant ;
3. rendre jouable un scénario complet ;
4. concevoir l'interface de compagnon ;
5. ajouter sauvegarde et mode hors ligne ;
6. intégrer PixiJS si la carte apporte une vraie valeur ;
7. étendre progressivement la couverture aux campagnes, scénarios et extensions.

Le succès du projet ne se mesure pas au nombre d'écrans ou à la sophistication graphique, mais à sa capacité à prendre les bonnes décisions de jeu, à les expliquer, et à ne jamais désynchroniser l'application de la partie physique.

---

## Sources de référence

- *Arcadia Quest – Règle française*, PDF fourni par l'utilisateur.
- *Arcadia Quest Solo Mode – Version 1.3*, PDF fourni par l'utilisateur.

Les règles de mode solo citées dans ce document proviennent du second livret. Les règles générales de déplacement, combat, cartes, campagne et amélioration doivent être vérifiées et référencées précisément dans le livret français avant leur implémentation.

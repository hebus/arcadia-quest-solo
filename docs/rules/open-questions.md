# Registre des ambiguïtés et écarts (Phase 0)

Sources de référence :

- `AQ-Rulebook.pdf` : livret de base (anglais) ;
- `AQ-Solo_Mode-1.3.pdf` : livret Solo Mode **version 1.3**, qui fait foi. La v1.1 (`AQ-Solo_Mode-1-1.pdf`) est conservée pour l'historique : elle est remplacée sur tous les points.

Les extractions texte sont dans `docs/source/*.txt` (générées, non officielles). Les pages citées sont les pages imprimées des livrets.

## A. Écarts entre `docs/plan.md` et le livret solo v1.3

Le plan est globalement conforme à la v1.3. Points à corriger ou à noter :

| # | Plan | Livret v1.3 | Décision |
|---|---|---|---|
| A1 | §3.5 : sélection du monstre sans terrain | p.2 : confirmé (portes, murs, portails ignorés) | Conforme (RULE-SOLO-010) |
| A2 | §3.9 : FAQ | p.20 : confirmée, 5 questions | Conforme (RULE-SOLO-014/030, RULE-BASE-026/030) |
| A3 | §3.8 cite Whole Lotta Lava, Beyond the Grave, Pets, Riders, Dragons | p.8-20 : 53 scénarios répartis en 7 familles (voir `src/game-data/scenarios/solo-scenario-changes.json`) | Catalogue construit |
| A4 | §3.6 : ne pas retirer les cartes d'un type absent | p.6 dit de les retirer, p.20 (FAQ) dit de ne pas le faire | Contradiction interne : B13 |
| A5 | §3.7 « Partie 2 : l'activation d'un héros concerne un seul héros » | p.5 : conforme | Conforme |
| A6 | Phase d'amélioration solo non détaillée | p.7 : victoire 8 cartes + 3 par tranche de 5 pièces ; défaite 6 cartes ; achat max 3 | Ajoutée (RULE-SOLO-021/022) |
| A7 | Plan : « Dragons : ne pas accorder les bonus de pièces pour les médailles » | p.5 : uniquement pour la phase d'amélioration précédant la Partie 1 | Conforme |
| A8 | Plan §3.7 Dragons : « le deck de monstres… » | p.5 | Conforme |
| A9 | Livrets d'extension (Inferno, Beyond the Grave, Pets, Riders, Dragons, Whole Lotta Lava) non fournis | Les cartes, héros et scénarios de ces extensions ne sont décrits que par le livret solo | Aucune extension « prise en charge » sans ses règles et ses données |

## B. Questions ouvertes

Résolues par la v1.3 : ~~B1 murs et distance~~ (ignorés), ~~B3 Payback multi-cibles~~ (tier le plus élevé, sinon le joueur choisit), ~~B4 garde tué~~ (perd son statut), ~~B7~~ (relance seulement si la combinaison n'existe pas).

| # | Question | Impact | Défaut provisoire (choix d'implémentation, non officiel) |
|---|---|---|---|
| B2 | Comment mesurer « le Hero le plus proche » (étape 3, p.2) : chemin réel (portes et portails à 1 PM) ou distance simple ? | Ciblage | Chemin de coût minimal en points de mouvement |
| B5 | Égalité de proximité entre monstres, ou entre héros après le critère des blessures : « choose 1 », le joueur choisit | Autonomie de l'agent | Politique configurable (plan §7.9), identifiant en dernier recours |
| B6 | Que faire si aucun monstre non garde du type de la carte n'existe sur le plateau (que des gardes) ? | Sélection | Aucune activation ; à confirmer |
| B8 | Les positions des gardes, jetons Spawn, monstres, quêtes de chaque scénario sont dans le **Campaign Book** (et ceux des extensions), non fournis | Phase 12 | Bloquant pour passer un scénario à « vérifié » |
| B9 | Liste exacte des cartes Monster Activation par niveau et par scénario | Deck d'activation | À inventorier à partir du matériel physique |
| B10 | « Temple of Light » (livret de base p.28) et « Temple of Dawning Twilight » : même scénario ? | Catalogue | Supposé identique |
| B11 | « Utiliser relances, crits, capacités au mieux » (p.6) : quelle stratégie exacte ? | Agent | Relancer les dés ratés ; capacités au profit maximal |
| B12 | Pièces en solo : le livret de base donne une pièce aux autres guildes quand un héros meurt ; aucune autre guilde en solo | Récompenses | Aucune pièce pour les morts de héros |
| B13 | Cartes d'activation d'un type absent : retirer (p.6) ou conserver (FAQ p.20) ? | Deck d'activation | Conserver (FAQ) ; option de configuration |
| B14 | Règles de chaque dragon (Partie 2) : livrets de dragon non fournis | Extension Dragons | Hors périmètre |
| B15 | « Removed 3 Guard icons » pour Alchemist's District (p.9) : que signifie cette phrase ? | Scénario | À vérifier avec le Campaign Book |
| B16 | Cartes Brimstone, Tombstone, Dragonstone, Ivan, Korillas : cartes solo à imprimer, non fournies | Extensions | Données à saisir depuis le matériel |
| B17 | Faces des dés d'attaque et de défense | Spawn, attaques des monstres | **Réglée par l'utilisateur** : dé noir 3 épées / 2 arcs / 1 critique, dé blanc 2 boucliers / 1 critique / 3 vides (`src/game-data/dice.ts`) |
| B18 | Correspondance rang de scénario → jeu de cartes Monster : le livret de base ne cite que le rang 1 (« 1 ») et le rang 3 (« 2-3 ») | Campagne | Les autres rangs sont à saisir ; l'application refuse de deviner |
| B19 | Plusieurs monstres Payback ou Guard simultanés : ordre de résolution (joueur de droite en jeu normal) | Réactions | Ordre par identifiant ; sans effet sur le résultat sauf mort du héros entre deux attaques |
| B20 | Un monstre ciblant « le héros le plus proche » alors qu'un héros plus lointain serait atteignable avec moins de blessures | Ciblage | Le plus proche en coût de PM, puis le plus de blessures (B2) |

## C. Questions de cadrage du plan (§19), toujours sans réponse

1. Contenu physique possédé (jeu de base seul ? quelles extensions ?).
2. Scénario MVP (le livret déconseille Brightsun Arena et The Manor en premier ; District of Hammers est recommandé par le livret de base).
3. Dés et cartes physiques ou numériques.
4. Carte tactique complète ou positions minimales.
5. Campagne complète dès la première livraison ou scénarios isolés.
6. Saisie manuelle des cartes ou inventaire fourni.

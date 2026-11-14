import type { Expansion } from '../../domain/schemas';

/**
 * Statut des extensions (plan Phase 11). Une extension n'est « supported » que si ses règles ET ses scénarios
 * sont couverts par des tests et validés en partie réelle : aucune ne l'est à ce jour.
 */
export type SupportStatus = 'partial' | 'unsupported';

export interface ExpansionInfo {
  label: string;
  status: SupportStatus;
  implemented: string[];
  missing: string[];
  scenarioFamilies: string[];
}

export const EXPANSIONS: Record<Expansion, ExpansionInfo> = {
  pets: {
    label: 'Pets',
    status: 'partial',
    implemented: [
      'cartes Wild Pet ajoutées au deck (nombre propre au scénario)',
      'Wild Pet : le monstre suivant vise le familier le plus proche',
      'deux Wild Pet consécutives : défausse remélangée',
      'activation des familiers pendant le Guild Turn, jamais au repos',
      'la mort d\'un familier ne compte pas pour la défaite',
    ],
    missing: ['données des familiers', 'cartes spéciales Korillas', 'règles d\'attaque des familiers'],
    scenarioFamilies: ['pets'],
  },
  riders: {
    label: 'Riders',
    status: 'partial',
    implemented: [
      'activation de la monture une fois par Guild Turn',
      'la mort d\'une monture compte comme une mort de héros, sans Malédiction',
    ],
    missing: ['règles de monter, descendre et rappeler', 'données des montures'],
    scenarioFamilies: ['riders'],
  },
  dragons: {
    label: 'Dragons',
    status: 'partial',
    implemented: [
      'Partie 2 : Dragon Turn puis Guild Turn, sans Monster Turn',
      'Partie 2 : un seul héros activé',
      'Partie 1 : règles solo normales (le dragon n\'est jamais activé par le Monster Turn)',
    ],
    missing: ['cartes Dragon Turn, Dragonstone, Relic, Dragon Power', 'conditions de victoire et de défaite de chaque dragon'],
    scenarioFamilies: ['dragons'],
  },
  inferno: {
    label: 'Inferno',
    status: 'unsupported',
    implemented: ['catalogue des changements de scénario (exclusions de cartes, Wild Pet)'],
    missing: ['cartes Brimstone (effet à la révélation, activation d\'un monstre de tier choisi)', 'données des monstres et héros'],
    scenarioFamilies: ['inferno'],
  },
  'beyond-the-grave': {
    label: 'Beyond the Grave',
    status: 'unsupported',
    implemented: ['catalogue des changements de scénario (cartes retardées : Ghost, Slasher Zombie, Necromancer)'],
    missing: ['cartes Tombstone', 'cartes solo d\'Ivan', 'données des monstres'],
    scenarioFamilies: ['beyond-the-grave'],
  },
  'whole-lotta-lava': {
    label: 'Whole Lotta Lava',
    status: 'unsupported',
    implemented: ['catalogue des changements de scénario'],
    missing: ['règles de lave', 'données'],
    scenarioFamilies: ['whole-lotta-lava'],
  },
};

/** Huge Characters : poussée non modélisée (solo v1.3 p.4). */
export const UNSUPPORTED_RULES = ['Huge Characters (poussée des héros)', 'capacités spéciales des monstres', 'cartes d\'amélioration'];

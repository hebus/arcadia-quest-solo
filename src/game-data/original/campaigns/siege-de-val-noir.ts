import type { CampaignDefinition } from './chute-des-braises';

/**
 * Campagne moyenne de 5 chapitres écrits à la main : « Le Siège de Val-Noir » (entre la petite campagne à 3 chapitres et la grande
 * à 6 du livret). Montée en puissance sur les quatre niveaux de cartes Monster : chapitre 1 au niveau « 1 », chapitre 2 au niveau
 * « 2-3 », chapitres 3 et 4 au niveau « 4-5 », chapitre 5 au niveau « 6 ».
 */
export const SIEGE_DE_VAL_NOIR: CampaignDefinition = {
  id: 'siege-de-val-noir',
  title: 'Le Siège de Val-Noir',
  tagline: 'Cinq nuits pour lever le siège d’un bourg de montagne : un pont, une halle, des remparts, une fosse, un trône.',
  chapters: [
    { scenarioId: 'pont-du-guet', bridge: 'Val-Noir est assiégé par des orcs : il faut d’abord reprendre le pont et rallumer le phare du guet.' },
    { scenarioId: 'halle-aux-grains', bridge: 'Le pont est libre, mais le bourg a faim : les orcs tiennent la Halle aux Grains, gardée par un troll.' },
    { scenarioId: 'remparts-de-val-noir', bridge: 'La halle est reprise. La carte du troll mène aux remparts, où un minotaure a installé son trône.' },
    { scenarioId: 'fosse-aux-cendres', bridge: 'Cornelune est tombé, son sceau de guerre mène à la Fosse aux Cendres, ceinturée de tours.' },
    { scenarioId: 'trone-de-val-noir', bridge: 'L’étendard noir de l’antre porte un nom : Vel-Karn, le seigneur de guerre. Sa citadelle est la dernière étape du siège.' },
  ],
};

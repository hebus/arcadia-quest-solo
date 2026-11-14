import { parseBestiaryFile } from '@/engine/bestiaryFile';
import type { MonsterDefinition } from '@/engine/domain/schemas';
import data from './monsters.json';

/**
 * Bestiaire du jeu, lu dans `monsters.json` : deux catégories (minions et vilains), quatre niveaux (« 1 », « 2-3 », « 4-5 »,
 * « 6 ») et, à chaque niveau, une version minor ou major. Le fichier se remplit à la main (voir son champ « aide ») : une fiche
 * à null est « à saisir » et l'application la signale (« stats manquantes ») sans rien inventer.
 *
 * Choix de l'application : `tier` (qui riposte en premier) vaut 1 pour un minion minor, 2 pour un minion major, 3 pour un vilain.
 * Boîtes : les 8 figurines d'Orc servent à l'Orc Marauder comme à l'Orc Captain (même `group`, `copies` 8).
 */
export const ORIGINAL_MONSTERS: MonsterDefinition[] = parseBestiaryFile(data);

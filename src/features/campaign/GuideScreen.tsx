import { Panel } from '@/components/ui';

export function GuideScreen() {
  return (
    <div className="space-y-3">
      <Panel title="Comment jouer avec l'application">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Faites la mise en place physique du scénario comme dans le livret (le plateau, les figurines et les cartes restent sur la table).</li>
          <li>Une fois : « Bibliothèque de tuiles » — importez le scan de chaque face de tuile, alignez la grille 3×3 et tracez les murs en touchant les arêtes. Puis « Nouvelle partie » : posez les tuiles (3×3 en général), les portes, portails, jetons Spawn, héros et monstres directement sur le plateau, et saisissez les stats des monstres.</li>
          <li>Tour de guilde : touchez un héros puis une case verte pour le déplacer, ou un monstre pour l&apos;attaquer. Rejouez le geste sur la table.</li>
          <li>Monster Turn : appuyez sur « Lancer ». L&apos;agent résout le Spawn puis deux activations, puis liste les actions physiques à exécuter. Confirmez-les une à une, ou corrigez l&apos;état si le plateau diffère.</li>
          <li>Fin de scénario : victoire si les quêtes PvE sont accomplies avant le seuil de morts, défaite sinon ; la campagne continue dans les deux cas.</li>
        </ol>
      </Panel>
      <Panel title="Règles appliquées par l'automate (livret solo v1.3)">
        <ul className="list-disc space-y-1 pl-5">
          <li>Deux dés d&apos;attaque désignent un jeton Spawn (il n&apos;en existe que 5 : épée+épée, épée+arc, épée+critique, arc+arc, arc+critique). Sans jeton correspondant sur le plateau, rien ne se passe ; un monstre de la Spawn Tile qui devrait apparaître sur un jeton absent sort définitivement du jeu.</li>
          <li>La carte révélée désigne le type de monstre ; le plus proche du jeton (distance orthogonale, terrain ignoré) est activé ; les gardes sont ignorés.</li>
          <li>Le monstre a 3 PM (porte = 1, portail = 1), va vers le héros le plus proche et n&apos;utilise que les PM nécessaires pour attaquer ; à égalité, le héros le plus blessé.</li>
          <li>Payback : un seul monstre riposte, du tier le plus élevé parmi les cibles. Un garde tué n&apos;est plus garde.</li>
          <li>Seuil de défaite : Legendary 1, Hard 2, Medium 3, Easy 4 morts.</li>
        </ul>
      </Panel>
      <Panel title="Limites connues">
        <ul className="list-disc space-y-1 pl-5">
          <li>Les faces des dés sont à régler selon vos dés (Paramètres) : les livrets ne les décrivent pas.</li>
          <li>Aucun scénario n&apos;est préchargé : le Campaign Book n&apos;a pas été intégré, la mise en place se saisit à la main.</li>
          <li>Capacités spéciales des monstres, cartes d&apos;amélioration, Huge Characters, cartes Brimstone, Tombstone et Dragonstone : à appliquer à la main.</li>
          <li>Les extensions ne sont que partiellement prises en charge (voir Paramètres).</li>
          <li>Les règles n&apos;ont pas été validées en partie réelle : toute divergence doit être signalée et corrigée.</li>
        </ul>
      </Panel>
    </div>
  );
}

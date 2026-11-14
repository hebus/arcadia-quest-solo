import { Badge, Button, Panel, inputClass } from '@/components/ui';
import type { DieFaceDef } from '@/engine/domain/schemas';
import { EXPANSIONS, UNSUPPORTED_RULES } from '@/engine/rules/expansions/registry';
import { DEFAULT_ATTACK_DIE, DEFAULT_DEFENSE_DIE, DICE_STATUS } from '@/game-data/dice';
import { useGameStore } from '@/stores/gameStore';

function DiceEditor({ title, faces, onChange, defense }: { title: string; faces: DieFaceDef[]; onChange: (f: DieFaceDef[]) => void; defense?: boolean }) {
  const set = (i: number, patch: Partial<DieFaceDef>) => onChange(faces.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  return (
    <div>
      <h3 className="mb-1 font-medium">{title}</h3>
      {faces.map((f, i) => (
        <div key={i} className="mb-1 flex flex-wrap items-center gap-2">
          <input aria-label={`${title} face ${i + 1}`} className={`${inputClass} w-28`} value={f.symbol} onChange={(e) => set(i, { symbol: e.target.value })} />
          {!defense && (
            <>
              <label className="flex items-center gap-1"><input type="checkbox" checked={f.melee} onChange={(e) => set(i, { melee: e.target.checked })} />mêlée</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={f.ranged} onChange={(e) => set(i, { ranged: e.target.checked })} />distance</label>
            </>
          )}
          {defense && <label className="flex items-center gap-1"><input type="checkbox" checked={f.save} onChange={(e) => set(i, { save: e.target.checked })} />sauvegarde</label>}
          <label className="flex items-center gap-1"><input type="checkbox" checked={f.crit} onChange={(e) => set(i, { crit: e.target.checked })} />CRIT</label>
        </div>
      ))}
    </div>
  );
}

export function SettingsScreen() {
  const g = useGameStore((s) => s.game);
  const content = useGameStore((s) => s.content);
  const setSettings = useGameStore((s) => s.setSettings);
  const setDice = useGameStore((s) => s.setDice);
  return (
    <div className="space-y-3">
      {g && (
        <Panel title="Mode de jeu (mémorisé avec la partie)">
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              Dés
              <select className={inputClass} value={g.settings.diceMode} onChange={(e) => setSettings({ diceMode: e.target.value as 'digital' | 'physical' })}>
                <option value="digital">numériques (l&apos;agent tire)</option>
                <option value="physical">matériels (je saisis)</option>
              </select>
            </label>
            <label>
              Jet de défense des héros
              <select className={inputClass} value={g.settings.defenseRoll} onChange={(e) => setSettings({ defenseRoll: e.target.value as 'digital' | 'physical' })}>
                <option value="physical">je lance mes dés et j’indique les boucliers (recommandé)</option>
                <option value="digital">l’application lance la défense à ma place</option>
              </select>
            </label>
            <label>
              Activation de la guilde
              <select className={inputClass} value={g.settings.heroActivation ?? 'all'} onChange={(e) => setSettings({ heroActivation: e.target.value as 'one' | 'all' })}>
                <option value="one">un seul héros par tour (livret de base)</option>
                <option value="all">tous les héros à chaque tour (mode solo v1.3)</option>
              </select>
            </label>
            <label>
              Ligne de vue (attaque à distance)
              <select className={inputClass} value={g.settings.lineOfSight ?? 'rulebook'} onChange={(e) => setSettings({ lineOfSight: e.target.value as 'rulebook' | 'any-character' })}>
                <option value="any-character">tout personnage traversé la bloque (+ murs et portes fermées)</option>
                <option value="rulebook">livret : seulement une case bloquée par 2 ennemis</option>
              </select>
            </label>
            <label>
              Cartes d&apos;activation
              <select className={inputClass} value={g.settings.cardMode} onChange={(e) => setSettings({ cardMode: e.target.value as 'digital' | 'physical' })}>
                <option value="digital">numériques</option>
                <option value="physical">matérielles</option>
              </select>
            </label>
            <label>
              Égalités laissées au joueur par le livret
              <select className={inputClass} value={g.settings.tiePolicy} onChange={(e) => setSettings({ tiePolicy: e.target.value as 'ask' | 'stable-id' })}>
                <option value="stable-id">automatique (ordre par identifiant, politique d&apos;automatisation)</option>
                <option value="ask">me demander</option>
              </select>
            </label>
            <label className="flex items-center gap-2 self-end">
              <input type="checkbox" checked={g.settings.removeCardsOfEliminatedTypes} onChange={(e) => setSettings({ removeCardsOfEliminatedTypes: e.target.checked })} />
              Retirer les cartes d&apos;un type éliminé (notes p.6) — sinon on les garde (FAQ p.20)
            </label>
          </div>
        </Panel>
      )}
      <Panel title="Faces des dés" actions={<Badge tone={DICE_STATUS === 'to-verify' ? 'warn' : 'good'}>à vérifier</Badge>}>
        <p className="mb-2 text-amber-300">
          Les livrets ne décrivent pas les faces des dés. Les valeurs ci-dessous sont un point de départ : comparez-les à vos dés avant une partie réelle. Les symboles servent aussi aux jetons Spawn.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <DiceEditor title="Dé d'attaque" faces={content.attackDie} onChange={(f) => setDice(f, content.defenseDie)} />
          <DiceEditor title="Dé de défense" faces={content.defenseDie} onChange={(f) => setDice(content.attackDie, f)} defense />
        </div>
        <div className="mt-2">
          <Button onClick={() => setDice(DEFAULT_ATTACK_DIE, DEFAULT_DEFENSE_DIE)}>Valeurs par défaut</Button>
        </div>
      </Panel>
      <Panel title="Extensions : niveau de prise en charge">
        <ul className="space-y-2">
          {Object.entries(EXPANSIONS).map(([id, e]) => (
            <li key={id}>
              <strong>{e.label}</strong> <Badge tone={e.status === 'partial' ? 'warn' : 'bad'}>{e.status === 'partial' ? 'partielle' : 'non prise en charge'}</Badge>
              <details className="text-sm">
                <summary className="cursor-pointer">Détail</summary>
                <p>Implémenté : {e.implemented.join(' ; ')}.</p>
                <p>Manquant : {e.missing.join(' ; ')}.</p>
              </details>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-stone-400">Jamais modélisé : {UNSUPPORTED_RULES.join(', ')} (à appliquer à la main).</p>
      </Panel>
    </div>
  );
}

import { Badge, Button, Panel } from '@/components/ui';
import { MiniPawn } from '@/components/MiniPawn';
import { ObjectiveIcon } from '@/components/ObjectiveIcon';
import type { GameState } from '@/engine/domain/schemas';
import { defeatThreshold, questsDone } from '@/engine/state';
import { SoundToggle } from '@/features/game/SoundControls';
import { actorInfo } from '@/rendering/instructions/overlay';
import { useGameStore } from '@/stores/gameStore';

export const PHASE_LABEL: Record<GameState['phase'], string> = {
  SCENARIO_SETUP: 'Mise en place',
  GUILD_TURN: 'Tour de guilde',
  MONSTER_TURN_SPAWN: 'Monster Turn : Spawn',
  MONSTER_TURN_ACTIVATION_1: 'Monster Turn : activation 1',
  MONSTER_TURN_ACTIVATION_2: 'Monster Turn : activation 2',
  DRAGON_TURN: 'Dragon Turn',
  SCENARIO_WON: 'Victoire',
  SCENARIO_LOST: 'Défaite',
};

/** État de la partie en une ligne, sans cadre : icône + valeur, rangée dans l'en-tête près du bouton Accueil. */
export function StatusBar({ onMenu }: { onMenu: () => void }) {
  const g = useGameStore((s) => s.game);
  const group = useGameStore((s) => s.instructions.find((i) => !i.confirmed)?.group);
  if (!g) return null;
  const threshold = defeatThreshold(g);
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1" aria-label="État de la partie">
      <Badge tone="warn">{group ? `Phase des monstres · ${group}` : PHASE_LABEL[g.phase]}</Badge>
      <span>Manche {g.round}</span>
      <span title="Morts de héros / seuil de défaite" className={g.deaths >= threshold - 1 ? 'text-red-300' : ''}>
        ☠ {g.deaths}/{threshold}
      </span>
      <span title="Quêtes accomplies">
        ⚑ {questsDone(g)}/{g.questsRequired}
      </span>
      <span title="Pièces">🪙 {g.coins}</span>
      <span className="flex items-center gap-1">
        <SoundToggle />
        <Button variant="ghost" aria-label="Menu" onClick={onMenu}>
          ☰ Menu
        </Button>
      </span>
    </div>
  );
}

/** Équipe, monstres en jeu, deck : détails consultables dans le menu. */
export function TeamPanels() {
  const g = useGameStore((s) => s.game);
  const select = useGameStore((s) => s.select);
  if (!g) return null;
  const onBoard = g.monsters.filter((m) => m.status === 'board');
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Panel title="Héros">
        <ul className="space-y-2">
          {g.heroes.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" className="flex items-center gap-2 text-left" aria-label={`Repérer ${h.name} sur le plateau`} onClick={() => select(h.id)}>
                <MiniPawn kind="hero" label={actorInfo(g, h.id).label} size={32} dead={h.dead} />
                <span className={h.dead ? 'text-stone-400 line-through' : ''}>{h.name}</span>
              </button>
              <span className="flex gap-2">
                <Badge tone={h.dead ? 'bad' : h.wounds ? 'warn' : 'good'}>
                  {h.wounds}/{h.life} blessures
                </Badge>
                {h.dead && <Badge tone="bad">mort</Badge>}
                {g.activatedHeroIds.includes(h.id) && <Badge>activé</Badge>}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title={`Monstres (${onBoard.length} en jeu)`}>
        <ul className="space-y-1 text-sm">
          {onBoard.map((m) => (
            <li key={m.id}>
              <button type="button" className="flex items-center gap-2 text-left" aria-label={`Repérer ${m.id} sur le plateau`} onClick={() => select(m.id)}>
                <MiniPawn kind="monster" label={actorInfo(g, m.id).label} size={28} />
                <span>{m.definitionId}</span>
                {m.isGuard && <Badge tone="warn">garde</Badge>}
                {m.wounds > 0 && <Badge>{m.wounds} bl.</Badge>}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-stone-400">
          Spawn Tile : {g.spawnTile.length}/{g.spawnTileCapacity}
          {g.spawnTile.length ? ` (${g.spawnTile.join(', ')})` : ''} · Deck : {g.deck.draw.length} · défausse : {g.deck.discard.length}
        </p>
      </Panel>
    </div>
  );
}

/** Objectifs : état de chaque quête, avec validation manuelle en secours (le script les valide normalement). */
export function QuestsPanel() {
  const g = useGameStore((s) => s.game);
  const complete = useGameStore((s) => s.completeQuest);
  if (!g) return null;
  return (
    <Panel title="Objectifs">
      <ul className="space-y-2">
        {g.quests.map((q) => (
          <li key={q.id} className="flex items-center justify-between gap-2">
            <span className={`flex items-center gap-2 ${q.done ? 'text-emerald-300' : ''}`}>
              <ObjectiveIcon icon={q.icon} size={22} color={q.done ? '#34d399' : '#fbbf24'} />
              {q.done && <span aria-hidden="true">✔</span>}
              {q.title}
            </span>
            <Button variant="ghost" disabled={q.done} onClick={() => complete(q.id)}>
              Valider à la main
            </Button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

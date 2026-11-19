import { monsterClassLabel, skillLines, statsOfMonster } from '@/engine/monsters';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Badge, Button, Panel } from '@/components/ui';
import { Stepper } from '@/components/Tally';
import { monsterCanPayback } from '@/engine/combat/heroActions';
import { adjacentDoors, canHeroTarget, mpLeft, reachableCells } from '@/engine/combat/heroMove';
import { CELL_CAPACITY, isClose } from '@/engine/movement/board';
import type { Position } from '@/engine/domain/schemas';
import { BoardView, type BoardToken, type Highlight, type PlacedTile } from '@/rendering/board/BoardView';
import { MiniPawn } from '@/components/MiniPawn';
import { MonsterStatsIcons } from '@/components/MonsterStatsIcons';
import { blockedByOtherHero } from '@/engine/state';
import { useAttackAnnouncement } from '@/features/game/announce';
import { AttackAnnouncement } from '@/features/game/ActionDock';
import { InstructionPlayer } from '@/features/instructions/InstructionPlayer';
import { useIsSandbox } from '@/features/game/SandboxPanel';
import { actorInfo, overlayForAttackAnnouncement, overlayForQueue } from '@/rendering/instructions/overlay';
import { useGameStore } from '@/stores/gameStore';
import { useTileStore } from '@/stores/tileStore';
import { TurnBanner, turnSide } from './TurnBanner';
import { allTiles } from '../setup/builtinTiles';

const same = (a: Position, b: Position) => a.x === b.x && a.y === b.y;

/**
 * Dialogue d'attaque. L'application ne calcule que la portée (type de l'arme) : le joueur lance les dés physiques de la
 * carte arme et indique les blessures subies par chaque monstre ciblé (parades du monstre comprises).
 */
function AttackDialog({ heroId, targets, fixedType, onToggle, onClose, onAddTargets }: { heroId: string; targets: string[]; fixedType: 'melee' | 'ranged' | null; onToggle: (id: string) => void; onClose: () => void; onAddTargets?: () => void }) {
  const g = useGameStore((s) => s.game)!;
  const content = useGameStore((s) => s.content);
  const attackHero = useGameStore((s) => s.attackHero);
  const hero = g.heroes.find((h) => h.id === heroId)!;
  const [choice, setChoice] = useState<'melee' | 'ranged'>('melee');
  // Un seul compteur : en général, toutes les cibles subissent les mêmes blessures que la cible d'origine.
  const [dealt, setDealt] = useState(0);
  const attacked = g.heroTurn[heroId]?.attacked ?? false;
  // Arme choisie avant la cible : le type est imposé. Sinon il se déduit, et on ne demande que s'il est ambigu.
  const validMelee = targets.length > 0 && targets.every((t) => canHeroTarget(g, heroId, t, 'melee'));
  const validRanged = targets.length > 0 && targets.every((t) => canHeroTarget(g, heroId, t, 'ranged'));
  const ambiguous = !fixedType && validMelee && validRanged;
  const type: 'melee' | 'ranged' = fixedType ?? (ambiguous ? choice : validMelee ? 'melee' : validRanged ? 'ranged' : choice);
  const invalid = targets.filter((t) => !canHeroTarget(g, heroId, t, type));
  return (
    <Panel title="Combat" actions={<Button variant="ghost" onClick={onClose}>Annuler</Button>}>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {ambiguous ? (
          <fieldset className="flex gap-3">
            <legend className="sr-only">Type d&apos;attaque</legend>
            <label className="flex items-center gap-1"><input type="radio" name="atk-type" checked={type === 'melee'} onChange={() => setChoice('melee')} /> ⚔ Corps à corps</label>
            <label className="flex items-center gap-1"><input type="radio" name="atk-type" checked={type === 'ranged'} onChange={() => setChoice('ranged')} /> 🏹 Distance</label>
          </fieldset>
        ) : (
          <Badge tone={invalid.length === 0 ? 'good' : 'bad'}>{invalid.length > 0 ? 'Hors de portée' : type === 'melee' ? '⚔ Corps à corps' : '🏹 Distance'}</Badge>
        )}
      </div>
      <ul className="mb-3 space-y-2">
        {targets.map((t, idx) => {
          const m = g.monsters.find((x) => x.id === t);
          const stats = m ? statsOfMonster(content, g, m) : undefined;
          const total = (m?.wounds ?? 0) + dealt;
          const outright = !!stats && dealt >= stats.overkill;
          const dies = !!stats && (outright || total >= stats.life);
          return (
            <li key={t} className="relative flex flex-wrap items-center gap-3 rounded-lg bg-stone-800 p-2">
              <MiniPawn kind="monster" label={actorInfo(g, t).label} size={36} />
              <strong>{t}</strong>
              {stats && <span className="text-sm text-stone-300" title="Points de vie">{'❤'.repeat(Math.max(0, stats.life - total))}{'🖤'.repeat(Math.min(stats.life, total))}</span>}
              {idx === 0 && onAddTargets && (
            <button
              type="button"
              data-testid="add-targets"
              aria-label="Ajouter des cibles"
              title="Ajouter des cibles : le combat se masque, touchez d’autres monstres sur le plateau. Après votre lancer, indiquez les blessures subies par chaque monstre."
              onClick={onAddTargets}
              className="flex h-9 items-center gap-0.5 rounded-lg border-2 border-stone-600 bg-stone-900 px-2 text-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <span aria-hidden="true">🎯</span>
              <span aria-hidden="true" className="text-base font-bold text-amber-300">＋</span>
            </button>
              )}
              {invalid.includes(t) && <Badge tone="bad">hors de portée</Badge>}
              {dealt > 0 && (outright ? <Badge tone="good">tué sur le coup : pas de riposte</Badge> : dies ? (monsterCanPayback(g, content, t, heroId) ? <Badge tone="good">tué (il peut riposter)</Badge> : <Badge tone="good">tué : il ne peut pas riposter, retiré directement</Badge>) : <Badge tone="warn">survit : il riposte</Badge>)}
              {m && stats && (
                <div className="basis-full space-y-0.5 text-sm text-stone-300" data-testid={`monster-card-${t}`}>
                  <p>
                    <strong>{content.monsters[m.definitionId]?.name ?? m.definitionId}</strong> · {monsterClassLabel(content.monsters[m.definitionId], g.monsterCardSet)}
                  </p>
                  <MonsterStatsIcons stats={stats} wounds={m.wounds} />
                  {!!stats.defense && (
                    <p data-testid={`monster-defense-${t}`}>
                      Défense : {stats.defense} dé{stats.defense > 1 ? 's' : ''} blanc{stats.defense > 1 ? 's' : ''} : un bouclier ou un critique annule une touche, lancez-les avant d’indiquer les blessures.
                    </p>
                  )}
                  {skillLines(stats).map((line) => (
                    <p key={line} className="text-amber-200" data-testid={`monster-skill-${t}`}>
                      ✦ {line}
                    </p>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => onToggle(t)} aria-label={`Retirer ${t}`} title="Retirer de la liste de combat" className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full text-lg text-stone-300 hover:bg-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400">
                ✕
              </button>
            </li>
          );
        })}
      </ul>
      {attacked && <p className="mb-2 text-amber-300">{hero.name} a déjà attaqué pendant cette activation.</p>}
      <div className="mb-3 flex items-end gap-3">
        {targets.length > 0 && <Stepper label={targets.length === 1 ? `Blessures de ${targets[0]}` : 'Blessures de toutes les cibles'} value={dealt} onChange={setDealt} />}
        <Button
          variant="primary"
          className="flex-1"
          title="Riposte et Guard calculées"
          disabled={targets.length === 0 || invalid.length > 0 || attacked}
          onClick={() => {
            attackHero(heroId, targets.map((t) => ({ monsterId: t, wounds: dealt })), type);
            onClose();
          }}
        >
          Résoudre l&apos;attaque
        </Button>
      </div>
    </Panel>
  );
}

type BuildTool = 'wall' | 'door' | 'interior' | 'room' | 'blocked';
const BUILD_TOOLS: { id: BuildTool; label: string; hint: string }[] = [
  { id: 'wall', label: '🧱 Mur', hint: 'Touchez une arête entre deux cases : un mur est posé, ou retiré.' },
  { id: 'door', label: '🚪 Porte', hint: 'Touchez une arête : porte fermée, puis ouverte, puis retirée.' },
  { id: 'interior', label: '🏠 Bâtiment', hint: 'Touchez une case : elle devient un intérieur (ou non) ; les murs du contour suivent.' },
  { id: 'room', label: '🟫 Salle', hint: 'Touchez une case : son sol change (salle), sans murs. Utile avec les murs et les portes pour dessiner une pièce.' },
  { id: 'blocked', label: '⛔ Case bloquée', hint: 'Touchez une case : elle devient impassable (ou libre).' },
];

/** Terrain d'essai : construire le plateau comme dans l'éditeur de tuiles, pour tester toutes sortes de conditions. */
function BuildStrip({ tool, onTool }: { tool: BuildTool | null; onTool: (t: BuildTool | null) => void }) {
  const current = BUILD_TOOLS.find((t) => t.id === tool);
  return (
    <section aria-label="Construire" data-testid="build-strip" className="space-y-2 rounded-xl border border-dashed border-sky-500 bg-stone-900/90 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-sky-200">🏗 Construire</span>
        {BUILD_TOOLS.map((t) => (
          <Button key={t.id} variant={tool === t.id ? 'primary' : 'secondary'} aria-pressed={tool === t.id} onClick={() => onTool(tool === t.id ? null : t.id)}>
            {t.label}
          </Button>
        ))}
      </div>
      <p className="text-sm text-stone-300">{current ? current.hint : 'Choisissez un outil, puis touchez le plateau. Touchez de nouveau l’outil pour le ranger.'}</p>
    </section>
  );
}

/**
 * Mode sync (placement libre) : recale l'écran sur la table. Les pions se glissent et les portes se touchent sur le plateau ;
 * ce panneau, à la place des cartes héros, montre ce qui peut être modifié sur le pion touché.
 */
function SyncPanel({ selectedId }: { selectedId: string | null }) {
  const g = useGameStore((s) => s.game)!;
  const content = useGameStore((s) => s.content);
  const correct = useGameStore((s) => s.correct);
  const select = useGameStore((s) => s.select);
  const m = selectedId ? g.monsters.find((x) => x.id === selectedId && x.status === 'board') : undefined;
  const h = selectedId ? g.heroes.find((x) => x.id === selectedId && !x.dead) : undefined;
  const stats = m ? statsOfMonster(content, g, m) : undefined;
  const close = <Button variant="ghost" onClick={() => select(null)}>Fermer</Button>;
  return (
    <section aria-label="Mode sync" data-testid="sync-panel" className="space-y-2 rounded-xl border-2 border-sky-500 bg-stone-900/90 p-2">
      <p className="text-sm text-sky-200">
        ⟳ Sync : glissez les héros et les monstres vers leur vraie case, touchez une porte pour l’ouvrir ou la fermer, touchez un pion pour régler son état.
      </p>
      {m && (
        <div className="space-y-2 rounded-lg bg-stone-800 p-2" data-testid="sync-monster">
          <div className="flex items-center gap-3">
            <MiniPawn kind="monster" label={actorInfo(g, m.id).label} size={36} />
            <strong className="flex-1">
              {content.monsters[m.definitionId]?.name ?? m.definitionId} · {m.id}
            </strong>
            {close}
          </div>
          {stats && <MonsterStatsIcons stats={stats} wounds={m.wounds} />}
          <Stepper label={`Blessures de ${m.id}`} value={m.wounds} onChange={(n) => correct({ kind: 'monster-wounds', monsterId: m.id, wounds: n })} {...(stats ? { max: Math.max(0, stats.life - 1) } : {})} />
          <div className="flex flex-wrap gap-2">
            <Button variant={m.isGuard ? 'primary' : 'secondary'} aria-pressed={m.isGuard} onClick={() => correct({ kind: 'monster-guard', monsterId: m.id, isGuard: !m.isGuard })}>
              🛡 Garde
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                correct({ kind: 'monster-status', monsterId: m.id, status: 'removed' });
                select(null);
              }}
            >
              🪦 Cimetière
            </Button>
          </div>
        </div>
      )}
      {h && (
        <div className="space-y-2 rounded-lg bg-stone-800 p-2" data-testid="sync-hero">
          <div className="flex items-center gap-3">
            <MiniPawn kind="hero" label={actorInfo(g, h.id).label} size={36} />
            <strong className="flex-1">{h.name}</strong>
            {close}
          </div>
          <Stepper
            label={`Blessures de ${h.name}`}
            value={h.wounds}
            max={h.life}
            onChange={(n) => {
              correct({ kind: 'hero-wounds', heroId: h.id, wounds: n });
              if (n >= h.life) correct({ kind: 'hero-dead', heroId: h.id, dead: true });
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant={h.stunned ? 'primary' : 'secondary'} aria-pressed={!!h.stunned} onClick={() => correct({ kind: 'hero-stunned', heroId: h.id, stunned: !h.stunned })}>
              💫 Étourdi
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                correct({ kind: 'hero-dead', heroId: h.id, dead: true });
                select(null);
              }}
            >
              ☠ Hors combat
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Plateau de jeu : sélection d'un héros, cases atteignables, déplacement au clic, attaque en touchant un monstre. */
export function GameBoard({ roster, footer, monsterInput, selectionCard }: { /** Fiche de la figurine touchée (portrait) : reçoit les boutons de type d'attaque, à loger dans la carte. */ selectionCard?: (attackBar: ReactNode) => ReactNode; /** Saisie des dés d'une attaque de monstre : remplace les cartes héros. */ monsterInput?: ReactNode;/** Cartes héros : remplacées par les réglages du pion touché en mode sync. */ roster?: ReactNode; footer?: ReactNode }) {
  const g = useGameStore((s) => s.game)!;
  const selectedId = useGameStore((s) => s.selectedId);
  const select = useGameStore((s) => s.select);
  const moveHero = useGameStore((s) => s.moveHero);
  const openDoor = useGameStore((s) => s.openDoor);
  const closeDoor = useGameStore((s) => s.closeDoor);
  const instructions = useGameStore((s) => s.instructions);
  const confirmInstruction = useGameStore((s) => s.confirmInstruction);
  const placing = useGameStore((s) => s.placing);
  const cancelPlacing = useGameStore((s) => s.cancelPlacing);
  const correctionMode = useGameStore((s) => s.correctionMode);
  const correct = useGameStore((s) => s.correct);
  const setCorrectionMode = useGameStore((s) => s.setCorrectionMode);
  const { tiles, loaded, load } = useTileStore();
  const [targets, setTargets] = useState<string[]>([]);
  /** Choix de cibles supplémentaires : la boîte de combat se masque pour laisser le plateau libre. */
  const [picking, setPicking] = useState(false);
  /** Arme choisie avant de viser : seules les cibles valides pour ce type sont désignables. */
  const [attackType, setAttackType] = useState<'melee' | 'ranged' | null>(null);
  /** Terrain d'essai : outil de construction actif (mur, porte, bâtiment, case bloquée), appliqué en touchant le plateau. */
  const [buildTool, setBuildTool] = useState<BuildTool | null>(null);
  const sandbox = useIsSandbox();
  /** Boutons Mêlée / Distance affichés près du héros sélectionné (2e touche sur le héros). */
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [aimHint, setAimHint] = useState<string | null>(null);
  /** Case où un pion a été lâché à tort : clignote en rouge un instant. */
  const [wrongDrop, setWrongDrop] = useState<Position | null>(null);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const hero = g.heroes.find((h) => h.id === selectedId && !h.dead) ?? null;
  /** Mode sync : un pion du plateau est touché, ses réglages remplacent les cartes héros. */
  const inspected = !!selectedId && (g.heroes.some((h) => h.id === selectedId && !h.dead) || g.monsters.some((m) => m.id === selectedId && m.status === 'board'));
  const guildTurn = g.phase === 'GUILD_TURN';
  const activeType = attackType;
  const turn = hero ? g.heroTurn[hero.id] : undefined;
  const mp = hero ? mpLeft(g, hero.id) : 0;
  // Tant qu'une attaque de monstre est annoncée, qu'une saisie est en attente ou que des étapes de monstre sont à jouer
  // sur la table, les héros ne peuvent pas agir : on ne se déplace pas pendant que le monstre attaque. Seule exception,
  // le déplacement que le joueur vient de faire lui-même, qui reste à valider.
  const announcement = useAttackAnnouncement();
  const awaitingInput = useGameStore((st) => st.agent.status === 'awaiting-input');
  /** Le tour des monstres vient d'être calculé : ses étapes se jouent encore sur la table. */
  const agentDone = useGameStore((st) => st.agent.status === 'done');
  const endTurn = useGameStore((s) => s.endTurn);
  const restWithPlacement = useGameStore((s) => s.restWithPlacement);
  const locked =
    awaitingInput ||
    !!announcement ||
    instructions.some((i) => !i.confirmed && !(i.kind === 'move' && g.heroes.some((h) => h.id === i.actorId)));
  const canMove = !!hero && guildTurn && !locked && mp > 0 && !turn?.moveLocked;

  /** Cibles désignables avec l'arme choisie : adjacentes (corps à corps) ou visibles (distance). */
  const validTargets = useMemo<string[]>(
    () =>
      hero && activeType
        ? g.monsters.filter((m) => m.status === 'board' && m.position && canHeroTarget(g, hero.id, m.id, activeType)).map((m) => m.id)
        : [],
    [g, hero, activeType],
  );
  const aimFailure = activeType === 'melee' ? 'Hors de portée : le corps à corps ne touche que les cases voisines, sans mur ni porte fermée entre vous.' : 'Pas de ligne de vue : un mur, une porte fermée ou un personnage coupe le trait entre les centres des cases.';

  // Portes que le héros sélectionné peut retourner, ouvertes ou fermées (1 PM chacune) : halo et zone touchable, seulement celles-là.
  const nearDoors = hero && canMove && !correctionMode ? adjacentDoors(g, hero.id) : [];

  const reach = useMemo(() => (canMove && hero ? reachableCells(g, hero.id, mp) : []), [canMove, hero, g, mp]);
  /** Une case est pleine quand deux personnages (héros, monstres ou familiers) s'y tiennent, sauf `exceptId`. */
  const occupied = (p: Position, exceptId?: string): boolean =>
    g.heroes.filter((h) => !h.dead && h.id !== exceptId && h.position && same(h.position, p)).length +
      g.monsters.filter((m) => m.status === 'board' && m.id !== exceptId && m.position && same(m.position, p)).length +
      g.pets.filter((x) => !x.dead && x.id !== exceptId && x.position && same(x.position, p)).length >=
    CELL_CAPACITY;
  const allCells: Position[] = Array.from({ length: g.board.width * g.board.height }, (_, i) => ({ x: i % g.board.width, y: Math.floor(i / g.board.width) })).filter((p) => !g.board.holes.some((h) => same(h, p)));
  const highlights: Highlight[] = [
    ...reach.map((r): Highlight => ({ pos: r.pos, kind: r.triggers > 0 ? 'danger' : 'reach', label: `${r.cost}${r.triggers > 0 ? '⚠' : ''}` })),
    ...targets.flatMap((t) => {
      const m = g.monsters.find((x) => x.id === t);
      return m?.position ? [{ pos: m.position, kind: 'target' as const }] : [];
    }),
    ...(activeType === 'melee' && hero?.position
      ? allCells.filter((p) => !same(p, hero.position!) && isClose(g.board, hero.position!, p)).map((pos): Highlight => ({ pos, kind: 'close' }))
      : []),
    ...(activeType ? validTargets.flatMap((id) => { const m = g.monsters.find((x) => x.id === id); return m?.position ? [{ pos: m.position, kind: 'target' as const }] : []; }) : []),
    ...(wrongDrop ? [{ pos: wrongDrop, kind: 'target' as const }] : []),
    ...(placing ? allCells.filter((p) => !occupied(p)).map((pos): Highlight => ({ pos, kind: 'close' })) : []),
  ];

  // Attaque à distance : le trait va du centre de la case du héros au centre de chaque monstre ; rouge = visible, gris = coupé.
  const sightLines =
    activeType === 'ranged' && hero?.position
      ? g.monsters.filter((m) => m.status === 'board' && m.position).map((m) => ({ from: hero.position!, to: m.position!, tone: validTargets.includes(m.id) ? ('clear' as const) : ('blocked' as const) }))
      : [];

  const tileMap = useMemo(() => Object.fromEntries(allTiles(tiles).map((t) => [t.id, t])), [tiles]);
  const placed: PlacedTile[] = (g.tileLayout?.placements ?? []).flatMap((pl) => (tileMap[pl.tileId] ? [{ def: tileMap[pl.tileId]!, placement: pl }] : []));

  // Étapes physiques en attente : la première est montrée en détail sur le plateau, les suivantes laissent les figurines à leur case d'avant.
  const queue = instructions.filter((i) => !i.confirmed);
  const current = queue[0];
  const queueOverlay = useMemo(() => {
    const visuals = queue.flatMap((i) => (i.visual ? [i.visual] : []));
    return visuals.length && current?.visual ? overlayForQueue(visuals, g) : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instructions, g]);
  // Avant la saisie des dés d'une attaque de monstre : le plateau montre qui attaque qui.
  const overlay = announcement ? overlayForAttackAnnouncement(announcement) : queueOverlay;
  const content = useGameStore((st) => st.content);
  /** Type d'attaque et dés du monstre pour le jeu de cartes courant, montrés sur son pion. */
  const monsterAttack = (m: { definitionId: string; rank?: 'minor' | 'major' | undefined }): BoardToken['attack'] => {
    const stats = statsOfMonster(content, g, m);
    return stats ? { type: stats.attackType, dice: stats.attackDice } : undefined;
  };
  // Tant que le Monster Turn attend une saisie, l'état de la partie n'est pas encore à jour : les déplacements de monstres déjà
  // validés sur la table sont appliqués ici, pour que le plateau suive (les étapes encore à jouer sont gérées par l'overlay).
  const movedTo: Record<string, Position> = {};
  if (awaitingInput) {
    for (const i of instructions) {
      const v = i.visual;
      if (i.confirmed && v?.type === 'move' && g.monsters.some((m) => m.id === v.actorId)) movedTo[v.actorId] = v.path[v.path.length - 1]!;
    }
  }
  const tokens: BoardToken[] = [
    ...g.heroes.filter((h) => !h.dead && h.position).map((h) => ({ id: h.id, kind: 'hero' as const, label: h.name.slice(0, 2).toUpperCase(), at: h.position!, wounded: h.wounds > 0, selected: h.id === selectedId, dimmed: (guildTurn && blockedByOtherHero(g, h.id)) || guildTurn && g.activatedHeroIds.includes(h.id) && (g.heroTurn[h.id]?.mpLeft ?? 3) === 0 && (g.heroTurn[h.id]?.attacked ?? false) })),
    ...g.monsters.filter((m) => m.status === 'board' && m.position).map((m) => ({ id: m.id, kind: 'monster' as const, label: m.definitionId.slice(0, 2).toUpperCase(), at: movedTo[m.id] ?? m.position!, guard: m.isGuard, attack: monsterAttack(m), wounded: m.wounds > 0, selected: m.id === selectedId || targets.includes(m.id), dimmed: !!activeType && !!hero && !validTargets.includes(m.id) })),
  ];

  /** Toucher la case de l'étape en cours (arrivée, pose, retrait, cible) la valide, comme le bouton « Fait ». */
  const confirmAt = (p: Position): boolean => {
    // Annonce d'attaque : toucher l'attaquant ou la cible la valide et ouvre le dialogue de dés.
    if (announcement) {
      const hit = [announcement.attackerAt, announcement.targetAt].some((c) => c && same(p, c));
      if (hit) announcement.acknowledge();
      return hit;
    }
    if (!current || !overlay?.focus || !same(p, overlay.focus)) return false;
    confirmInstruction(current.id);
    return true;
  };

  const resetAim = () => {
    setTargets([]);
    setPicking(false);
    setAttackType(null);
    setAimHint(null);
  };

  /** Le combat s'affiche en surimpression sur le plateau (plus de boîte de dialogue). */
  const attacking = !!hero && guildTurn && targets.length > 0;
  useEffect(() => {
    if (!attacking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resetAim();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [attacking]);

  /** Choix du type d'attaque (les cartes équipement sont gérées par les joueurs). */
  const chooseType = (t: 'melee' | 'ranged') => {
    setAimHint(null);
    setAttackType(activeType === t ? null : t);
  };

  // Le menu est lié au héros : en changer ou le désélectionner le referme.
  const menuVisible = !!hero?.position && menuFor === hero.id && guildTurn && !locked && !correctionMode && !placing && !turn?.attacked && targets.length === 0;
  // En portrait, les boutons d'attaque sont dans la fiche du héros et visibles dès qu'il est sélectionné.
  const attackBarVisible = selectionCard ? !!hero?.position && guildTurn && !locked && !correctionMode && !placing && !turn?.attacked && targets.length === 0 : menuVisible;
  const attackChoices = (['melee', 'ranged'] as const).map((t) => ({ id: t, label: t === 'melee' ? 'Mêlée' : 'Distance', icon: t === 'melee' ? '⚔' : '🏹' }));
  const attackBar = (
    <div role="group" aria-label="Type d'attaque" data-testid="board-menu" className="flex flex-nowrap items-center gap-2">
      {attackChoices.map((c) =>
        selectionCard ? (
          <button
            key={c.id}
            type="button"
            data-testid={`menu-${c.id}`}
            aria-label={c.label}
            title={c.label}
            aria-pressed={activeType === c.id}
            onClick={() => chooseType(c.id)}
            className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 text-2xl transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${activeType === c.id ? 'border-amber-400 bg-amber-700 text-white' : 'border-stone-600 bg-stone-900 text-stone-100'}`}
          >
            <span aria-hidden="true">{c.icon}</span>
          </button>
        ) : (
          <button
            key={c.id}
            type="button"
            data-testid={`menu-${c.id}`}
            aria-pressed={activeType === c.id}
            onClick={() => chooseType(c.id)}
            className={`min-h-12 whitespace-nowrap rounded-xl border-2 px-4 text-base font-semibold transition-colors sm:px-5 sm:text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${activeType === c.id ? 'border-amber-400 bg-amber-700 text-white' : 'border-stone-600 bg-stone-900 text-stone-100'}`}
          >
            {c.icon} {c.label}
          </button>
        ),
      )}
    </div>
  );

  const onToken = (id: string) => {
    const tokenAt = tokens.find((t) => t.id === id)?.at;
    if (tokenAt && confirmAt(tokenAt)) return;
    // Mode sync : toucher un pion le sélectionne (héros : fiche ; monstre : blessures et cimetière sous le plateau).
    if (correctionMode) return select(id === selectedId ? null : id);
    if (locked) return;
    const isHero = g.heroes.some((h) => h.id === id);
    if (isHero) {
      if (guildTurn && blockedByOtherHero(g, id)) return;
      resetAim();
      // 1re touche : sélection (cases atteignables). Touches suivantes : affiche / masque les boutons d'attaque.
      if (id === selectedId) setMenuFor((v) => (v === id ? null : id));
      else {
        setMenuFor(null);
        select(id);
      }
      return;
    }
    if (hero && guildTurn) {
      if (!activeType) {
        setAimHint('Touchez le héros, puis choisissez Mêlée ou Distance avant de viser un monstre.');
        return;
      }
      if (!validTargets.includes(id)) {
        const at = tokens.find((t) => t.id === id)?.at;
        if (at) flashWrong(at);
        setAimHint(aimFailure);
        return;
      }
      setAimHint(null);
      setTargets((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
    }
    else select(id === selectedId ? null : id);
  };

  const onCell = (p: Position) => {
    if (confirmAt(p)) return;
    if (buildTool === 'interior' || buildTool === 'room' || buildTool === 'blocked') return correct({ kind: buildTool === 'interior' ? 'board-interior' : buildTool === 'room' ? 'board-room' : 'board-blocked', at: p });
    if (placing) {
      // Deux figurines au maximum par case : on ne pose pas sur une case déjà pleine.
      if (occupied(p)) return flashWrong(p);
      cancelPlacing();
      placing.onPlace(p);
      return;
    }
    if (locked) return;
    if (hero && canMove && reach.some((r) => same(r.pos, p))) {
      setMenuFor(null);
      moveHero(hero.id, p);
    }
  };

  const flashWrong = (p: Position) => {
    setWrongDrop(p);
    setTimeout(() => setWrongDrop(null), 700);
  };

  /** Un pion se glisse s'il est l'acteur de l'étape en cours, ou si c'est un héros déplaçable du tour de guilde. */
  const canDrag = (id: string): boolean => {
    if (overlay?.dropTarget && !announcement) return overlay.dropTarget.actorId === id;
    if (announcement || awaitingInput) return false;
    if (placing || queue.length > 0) return false;
    if (correctionMode) return g.heroes.some((h) => h.id === id) || g.monsters.some((m) => m.id === id);
    if (!guildTurn) return false;
    const h = g.heroes.find((x) => x.id === id);
    const t = g.heroTurn[id];
    return !!h && !h.dead && !blockedByOtherHero(g, id) && !t?.moveLocked && (mpLeft(g, id) > 0 || !(t?.attacked ?? false));
  };

  const onTokenMove = (id: string, to: Position) => {
    // Étape en cours : lâcher la figurine sur la case cible la valide.
    if (overlay?.dropTarget && current) {
      if (overlay.dropTarget.actorId !== id) return;
      if (same(to, overlay.dropTarget.at)) confirmInstruction(current.id);
      else flashWrong(to);
      return;
    }
    // Mode correction : le pion glissé fixe la nouvelle position (la table fait foi), sans règle de déplacement.
    if (correctionMode) {
      if (occupied(to, id)) return flashWrong(to);
      if (g.heroes.some((h) => h.id === id)) correct({ kind: 'hero-position', heroId: id, to });
      else if (g.monsters.some((m) => m.id === id)) correct({ kind: 'monster-position', monsterId: id, to });
      return;
    }
    // Déplacement libre d'un héros : la figurine a déjà bougé sur la table, le miroir suit (aucune étape à rejouer).
    const h = g.heroes.find((x) => x.id === id);
    if (!h || !guildTurn) return;
    // Glisser le héros sur un monstre déclare l'attaque : le dialogue s'ouvre avec cette cible.
    const victim = g.monsters.find((m) => m.status === 'board' && m.position && same(m.position, to));
    if (victim) {
      if (activeType && selectedId === id && !validTargets.includes(victim.id)) {
        flashWrong(to);
        setAimHint(aimFailure);
        return;
      }
      select(id);
      setAimHint(null);
      setTargets([victim.id]);
      return;
    }
    if (g.heroTurn[id]?.moveLocked || !reachableCells(g, id, mpLeft(g, id)).some((r) => same(r.pos, to))) return flashWrong(to);
    setMenuFor(null);
    moveHero(id, to);
    for (const i of useGameStore.getState().instructions) {
      if (!i.confirmed && i.kind === 'move' && i.actorId === id) confirmInstruction(i.id);
    }
  };

  return (
    <div
      style={{ '--board-ratio': g.board.width / g.board.height } as React.CSSProperties}
      className="grid gap-3 lg:grid-cols-[min(max(18rem,calc((100dvh_-_9rem_-_var(--aq-banner,0px))*var(--board-ratio))),72vw)_minmax(0,1fr)] lg:items-stretch"
    >
      {/* En haut, cartes héros sur toute la largeur, puis étapes des monstres + Fin de tour ; en dessous, plateau | commandes. */}
      {!(correctionMode && inspected) && roster && <div className="min-w-0 max-lg:order-1 lg:col-span-2">{roster}</div>}
      <div className={`min-w-0 space-y-2 max-lg:order-2 lg:col-span-2 lg:min-h-12`}>
      {placing && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-amber-500 bg-amber-950 p-2" data-testid="placing-banner">
          <span className="flex items-center gap-3">
            <MiniPawn kind={actorInfo(g, placing.actorId).kind} label={actorInfo(g, placing.actorId).label} />
            <span className="text-2xl text-amber-300" aria-hidden="true">⤓</span>
            <span>Touchez la case où elle se trouve</span>
          </span>
          <Button variant="ghost" onClick={cancelPlacing}>
            Annuler
          </Button>
        </div>
      )}
      {/* Étapes de la phase des monstres : au-dessus du plateau, pour les lire sans quitter la table des yeux. */}
      {/* Barre de choix du type d'attaque, hors du plateau pour ne cacher aucune case ; hauteur réservée pour que le plateau ne bouge pas. */}
      {!placing && (
        <div className={`flex h-full flex-nowrap items-center gap-2 min-h-12`}>
          {/* Pendant la phase des monstres, la hauteur du bloc d'activation est réservée : le plateau ne bouge pas quand il apparaît ou disparaît. */}
          {announcement ? (
            <AttackAnnouncement announcement={announcement} />
          ) : (
            queue.length > 0 && (
              <div className="min-w-0 flex-1 self-center">
                <InstructionPlayer />
              </div>
            )
          )}
          {guildTurn && (!selectionCard && menuVisible && hero ? attackBar : (
            !locked && !correctionMode && !(selectionCard && hero) && <p className="min-w-0 truncate text-sm text-stone-500">{hero ? `Touchez ${hero.name} de nouveau pour attaquer.` : 'Touchez un héros pour voir où il peut aller.'}</p>
          ))}
          <div className="ml-auto flex flex-nowrap items-center gap-2 self-start">
            {guildTurn && !locked && !correctionMode && queue.length === 0 && (
              <button
                type="button"
                disabled={g.activatedHeroIds.length > 0}
                onClick={restWithPlacement}
                className="h-12 whitespace-nowrap rounded-xl border-2 border-stone-600 bg-stone-900 px-4 text-base font-semibold text-stone-100 transition-colors hover:bg-stone-800 disabled:opacity-40 sm:px-6 sm:text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                Repos
              </button>
            )}
            {guildTurn && !locked && !correctionMode && (
              <button
                type="button"
                onClick={endTurn}
                className="h-12 whitespace-nowrap rounded-xl border-2 border-amber-400 bg-amber-700 px-4 text-base font-bold text-white sm:px-6 sm:text-lg transition-colors hover:bg-amber-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
              >
                Fin de tour
              </button>
            )}
            <button
              type="button"
              data-testid="sync-toggle"
              aria-label="Sync"
              aria-pressed={correctionMode}
              title="Recaler le plateau sur la table : glisser les pions, ouvrir ou fermer les portes, régler les blessures des monstres"
              onClick={() => {
                resetAim();
                setMenuFor(null);
                select(null);
                setCorrectionMode(!correctionMode);
              }}
              className={`h-12 shrink-0 whitespace-nowrap rounded-xl border-2 px-3 text-xl font-semibold sm:px-5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 ${correctionMode ? 'border-sky-400 bg-sky-700 text-white' : 'border-stone-600 bg-stone-900 text-stone-100'}`}
            >
              <span aria-hidden="true">⟳</span>
            </button>
          </div>
        </div>
      )}
      </div>

      {/* Plateau entier visible : il se réduit à la hauteur disponible (sous la bannière) sans jamais déborder. */}
      <div className="relative min-w-0 max-lg:order-3">
      <div className="relative [&_svg]:mx-auto [&_svg]:block [&_svg]:max-h-[calc(100dvh-9rem-var(--aq-banner,0px))]">
      <BoardView
        label="Plateau de jeu"
        board={g.board}
        tiles={placed}
        tileLabels={(g.tileLayout?.placements ?? []).map((pl) => ({ tx: pl.tx, ty: pl.ty, dx: pl.dx, dy: pl.dy, label: pl.tileId }))}
        spawns={g.spawnPoints}
        tokens={tokens}
        highlights={highlights}
        overlay={overlay}
        lines={sightLines}
        objectives={g.quests.flatMap((q) => (q.at ? [{ id: q.id, at: q.at, icon: q.icon, title: q.title, done: q.done }] : []))}
        onCell={onCell}
        onEdge={buildTool === 'wall' || buildTool === 'door' ? (a, b) => correct({ kind: buildTool === 'wall' ? 'board-wall' : 'board-door', a, b }) : undefined}
        onToken={onToken}
        canDrag={canDrag}
        onTokenMove={onTokenMove}
        onDoor={correctionMode ? (id) => correct({ kind: 'door', doorId: id, open: !g.board.doors.find((d) => d.id === id)?.open }) : nearDoors.length ? (id) => hero && (g.board.doors.find((d) => d.id === id)?.open ? closeDoor(hero.id, id) : openDoor(hero.id, id)) : undefined}
        doorIds={correctionMode ? undefined : nearDoors}
        doorHints={nearDoors}
      />
      <TurnBanner side={turnSide(g.phase, agentDone && instructions.some((i) => !i.confirmed))} />
      </div>
      {/* Blocs de combat : en surimpression, centrés sur le plateau mais hors de son conteneur ; les cartes héros restent visibles. */}
      {(monsterInput || (attacking && hero)) && (
        <div className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-1 sm:p-3 ${attacking && picking ? 'hidden' : ''}`}>
         <div className="pointer-events-auto max-h-full w-full max-w-3xl overflow-y-auto rounded-xl shadow-2xl shadow-black/70">
          {monsterInput ? (
            <div data-testid="monster-input">{monsterInput}</div>
          ) : (
            hero && (
              <div data-testid="attack-panel">
                <AttackDialog heroId={hero.id} targets={targets} fixedType={activeType} onToggle={(id) => { const rest = targets.filter((x) => x !== id); if (rest.length === 0) setPicking(false); setTargets(rest); }} onClose={resetAim} onAddTargets={() => setPicking(true)} />
              </div>
            )
          )}
         </div>
        </div>
      )}
      {attacking && picking && (
        <div role="status" data-testid="picking-bar" className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl border-2 border-amber-400 bg-stone-900/95 px-3 py-1 shadow-xl shadow-black/70">
            <span className="text-2xl" aria-hidden="true">🎯</span>
            <span className="text-lg font-bold" title="Cibles choisies">{targets.length}</span>
            <button type="button" data-testid="picking-done" aria-label="Terminer le choix des cibles" title="Terminer" onClick={() => setPicking(false)} className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-emerald-400 bg-emerald-800 text-2xl text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">
              ✓
            </button>
          </div>
        </div>
      )}
      </div>

      <div className="min-w-0 space-y-3 max-lg:order-4">
      {correctionMode && <SyncPanel selectedId={selectedId} />}
      {sandbox && !placing && <BuildStrip tool={buildTool} onTool={setBuildTool} />}
      {selectionCard?.(attackBarVisible && hero ? attackBar : null)}
      {aimHint && <p className="text-amber-300" role="status">{aimHint}</p>}
      {footer}
      </div>

    </div>
  );
}

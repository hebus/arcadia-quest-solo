import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Badge, Button, Panel } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { Stepper } from '@/components/Tally';
import { monsterCanPayback } from '@/engine/combat/heroActions';
import { adjacentDoors, canHeroTarget, mpLeft, reachableCells } from '@/engine/combat/heroMove';
import { isClose } from '@/engine/movement/board';
import type { Position } from '@/engine/domain/schemas';
import { BoardView, type BoardMenu, type BoardToken, type Highlight, type PlacedTile } from '@/rendering/board/BoardView';
import { MiniPawn } from '@/components/MiniPawn';
import { blockedByOtherHero } from '@/engine/state';
import { useAttackAnnouncement } from '@/features/game/announce';
import { actorInfo, overlayForAttackAnnouncement, overlayForQueue } from '@/rendering/instructions/overlay';
import { useGameStore } from '@/stores/gameStore';
import { useTileStore } from '@/stores/tileStore';
import { BUILTIN_TILES } from '../setup/builtinTiles';

const same = (a: Position, b: Position) => a.x === b.x && a.y === b.y;

/**
 * Dialogue d'attaque. L'application ne calcule que la portée (type de l'arme) : le joueur lance les dés physiques de la
 * carte arme et indique les blessures subies par chaque monstre ciblé (parades du monstre comprises).
 */
function AttackDialog({ heroId, targets, fixedType, onToggle, onClose }: { heroId: string; targets: string[]; fixedType: 'melee' | 'ranged' | null; onToggle: (id: string) => void; onClose: () => void }) {
  const g = useGameStore((s) => s.game)!;
  const content = useGameStore((s) => s.content);
  const attackHero = useGameStore((s) => s.attackHero);
  const hero = g.heroes.find((h) => h.id === heroId)!;
  const [choice, setChoice] = useState<'melee' | 'ranged'>('melee');
  const [wounds, setWounds] = useState<Record<string, number>>({});
  const attacked = g.heroTurn[heroId]?.attacked ?? false;
  // Arme choisie avant la cible : le type est imposé. Sinon il se déduit, et on ne demande que s'il est ambigu.
  const validMelee = targets.length > 0 && targets.every((t) => canHeroTarget(g, heroId, t, 'melee'));
  const validRanged = targets.length > 0 && targets.every((t) => canHeroTarget(g, heroId, t, 'ranged'));
  const ambiguous = !fixedType && validMelee && validRanged;
  const type: 'melee' | 'ranged' = fixedType ?? (ambiguous ? choice : validMelee ? 'melee' : validRanged ? 'ranged' : choice);
  const invalid = targets.filter((t) => !canHeroTarget(g, heroId, t, type));
  return (
    <Panel title={`${hero.name} attaque`} actions={<Button variant="ghost" onClick={onClose}>Annuler</Button>}>
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
      <p className="mb-2 text-sm text-stone-400">Touchez d&apos;autres monstres sur le plateau pour les ajouter aux cibles. Après votre lancer, indiquez les blessures subies par chaque monstre.</p>
      <ul className="mb-3 space-y-2">
        {targets.map((t) => {
          const m = g.monsters.find((x) => x.id === t);
          const stats = m ? content.monsters[m.definitionId]?.levels[g.monsterCardSet] : undefined;
          const dealt = wounds[t] ?? 0;
          const total = (m?.wounds ?? 0) + dealt;
          const outright = !!stats && dealt >= stats.overkill;
          const dies = !!stats && (outright || total >= stats.life);
          return (
            <li key={t} className="flex flex-wrap items-center gap-3 rounded-lg bg-stone-800 p-2">
              <MiniPawn kind="monster" label={actorInfo(g, t).label} size={36} />
              <strong>{t}</strong>
              {stats && <span className="text-sm text-stone-300" title="Points de vie">{'❤'.repeat(Math.max(0, stats.life - total))}{'🖤'.repeat(Math.min(stats.life, total))}</span>}
              {invalid.includes(t) && <Badge tone="bad">hors de portée</Badge>}
              {dealt > 0 && (outright ? <Badge tone="good">tué sur le coup : pas de riposte</Badge> : dies ? (monsterCanPayback(g, content, t, heroId) ? <Badge tone="good">tué (il peut riposter)</Badge> : <Badge tone="good">tué : il ne peut pas riposter, retiré directement</Badge>) : <Badge tone="warn">survit : il riposte</Badge>)}
              <span className="ml-auto">
                <Stepper label={`Blessures de ${t}`} value={dealt} onChange={(n) => setWounds({ ...wounds, [t]: n })} />
              </span>
              <Button variant="ghost" onClick={() => onToggle(t)} aria-label={`Retirer ${t}`}>✕</Button>
            </li>
          );
        })}
      </ul>
      {attacked && <p className="mb-2 text-amber-300">{hero.name} a déjà attaqué pendant cette activation.</p>}
      <Button
        variant="primary"
        disabled={targets.length === 0 || invalid.length > 0 || attacked}
        onClick={() => {
          attackHero(heroId, targets.map((t) => ({ monsterId: t, wounds: wounds[t] ?? 0 })), type);
          onClose();
        }}
      >
        Résoudre l&apos;attaque (riposte et Guard calculées)
      </Button>
    </Panel>
  );
}

/** Plateau de jeu : sélection d'un héros, cases atteignables, déplacement au clic, attaque en touchant un monstre. */
export function GameBoard({ header, footer }: { header?: ReactNode; footer?: ReactNode }) {
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
  const { tiles, loaded, load } = useTileStore();
  const [targets, setTargets] = useState<string[]>([]);
  /** Arme choisie avant de viser : seules les cibles valides pour ce type sont désignables. */
  const [attackType, setAttackType] = useState<'melee' | 'ranged' | null>(null);
  /** Boutons Mêlée / Distance affichés près du héros sélectionné (2e touche sur le héros). */
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [aimHint, setAimHint] = useState<string | null>(null);
  /** Case où un pion a été lâché à tort : clignote en rouge un instant. */
  const [wrongDrop, setWrongDrop] = useState<Position | null>(null);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const hero = g.heroes.find((h) => h.id === selectedId && !h.dead) ?? null;
  const guildTurn = g.phase === 'GUILD_TURN';
  const activeType = attackType;
  const turn = hero ? g.heroTurn[hero.id] : undefined;
  const mp = hero ? mpLeft(g, hero.id) : 0;
  // Tant qu'une attaque de monstre est annoncée, qu'une saisie est en attente ou que des étapes de monstre sont à jouer
  // sur la table, les héros ne peuvent pas agir : on ne se déplace pas pendant que le monstre attaque. Seule exception,
  // le déplacement que le joueur vient de faire lui-même, qui reste à valider.
  const announcement = useAttackAnnouncement();
  const awaitingInput = useGameStore((st) => st.agent.status === 'awaiting-input');
  const locked =
    awaitingInput ||
    !!announcement ||
    instructions.some((i) => !i.confirmed && !(i.kind === 'move' && g.heroes.some((h) => h.id === i.actorId)));
  const canMove = !!hero && guildTurn && !locked && mp > 0 && !(turn?.attacked && turn?.moved);

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
  /** Une seule figurine par case : une case est occupée si un héros, un monstre ou un familier s'y tient (sauf `exceptId`). */
  const occupied = (p: Position, exceptId?: string): boolean =>
    g.heroes.some((h) => !h.dead && h.id !== exceptId && h.position && same(h.position, p)) ||
    g.monsters.some((m) => m.status === 'board' && m.id !== exceptId && m.position && same(m.position, p)) ||
    g.pets.some((x) => !x.dead && x.id !== exceptId && x.position && same(x.position, p));
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

  const tileMap = useMemo(() => Object.fromEntries([...BUILTIN_TILES, ...tiles].map((t) => [t.id, t])), [tiles]);
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
  const monsterAttack = (definitionId: string): BoardToken['attack'] => {
    const stats = content.monsters[definitionId]?.levels[g.monsterCardSet];
    return stats ? { type: stats.attackType, dice: stats.attackDice } : undefined;
  };
  const tokens: BoardToken[] = [
    ...g.heroes.filter((h) => !h.dead && h.position).map((h) => ({ id: h.id, kind: 'hero' as const, label: h.name.slice(0, 2).toUpperCase(), at: h.position!, wounded: h.wounds > 0, selected: h.id === selectedId, dimmed: (guildTurn && blockedByOtherHero(g, h.id)) || guildTurn && g.activatedHeroIds.includes(h.id) && (g.heroTurn[h.id]?.mpLeft ?? 3) === 0 && (g.heroTurn[h.id]?.attacked ?? false) })),
    ...g.monsters.filter((m) => m.status === 'board' && m.position).map((m) => ({ id: m.id, kind: 'monster' as const, label: m.definitionId.slice(0, 2).toUpperCase(), at: m.position!, guard: m.isGuard, attack: monsterAttack(m.definitionId), wounded: m.wounds > 0, selected: m.id === selectedId || targets.includes(m.id), dimmed: !!activeType && !!hero && !validTargets.includes(m.id) })),
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
    setAttackType(null);
    setAimHint(null);
  };

  /** Choix du type d'attaque (les cartes équipement sont gérées par les joueurs). */
  const chooseType = (t: 'melee' | 'ranged') => {
    setAimHint(null);
    setAttackType(activeType === t ? null : t);
  };

  // Le menu est lié au héros : en changer ou le désélectionner le referme.
  const menuVisible = !!hero?.position && menuFor === hero.id && guildTurn && !locked && !correctionMode && !placing && !turn?.attacked && targets.length === 0;
  const menu: BoardMenu | undefined = menuVisible
    ? {
        at: hero!.position!,
        items: (['melee', 'ranged'] as const).map((t) => ({
          id: t,
          label: t === 'melee' ? 'Mêlée' : 'Distance',
          icon: t === 'melee' ? '⚔' : '🏹',
          active: activeType === t,
          onClick: () => chooseType(t),
        })),
      }
    : undefined;

  const onToken = (id: string) => {
    const tokenAt = tokens.find((t) => t.id === id)?.at;
    if (tokenAt && confirmAt(tokenAt)) return;
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
    if (placing) {
      // Une seule figurine par case : on ne pose pas sur une case déjà occupée.
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
    return !!h && !h.dead && !blockedByOtherHero(g, id) && (mpLeft(g, id) > 0 || !(g.heroTurn[id]?.attacked ?? false));
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
    if (!reachableCells(g, id, mpLeft(g, id)).some((r) => same(r.pos, to))) return flashWrong(to);
    setMenuFor(null);
    moveHero(id, to);
    for (const i of useGameStore.getState().instructions) {
      if (!i.confirmed && i.kind === 'move' && i.actorId === id) confirmInstruction(i.id);
    }
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[min(calc(100dvh_-_7rem),62vw)_minmax(0,1fr)] lg:items-start">
      <div className="min-w-0 space-y-2">
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
      <BoardView
        label="Plateau de jeu"
        board={g.board}
        tiles={placed}
        spawns={g.spawnPoints}
        tokens={tokens}
        highlights={highlights}
        overlay={overlay}
        menu={menu}
        lines={sightLines}
        objectives={g.quests.flatMap((q) => (q.at ? [{ id: q.id, at: q.at, icon: q.icon, title: q.title, done: q.done }] : []))}
        onCell={onCell}
        onToken={onToken}
        canDrag={canDrag}
        onTokenMove={onTokenMove}
        onDoor={correctionMode ? (id) => correct({ kind: 'door', doorId: id, open: !g.board.doors.find((d) => d.id === id)?.open }) : nearDoors.length ? (id) => hero && (g.board.doors.find((d) => d.id === id)?.open ? closeDoor(hero.id, id) : openDoor(hero.id, id)) : undefined}
        doorIds={correctionMode ? undefined : nearDoors}
        doorHints={nearDoors}
      />
      </div>

      <div className="min-w-0 space-y-3">
      {header}
      {aimHint && <p className="text-amber-300" role="status">{aimHint}</p>}
      {footer}
      </div>

      {hero && guildTurn && targets.length > 0 && (
        <Modal title="Attaque" onClose={() => { setTargets([]); setAttackType(null); setAimHint(null); }}>
        <AttackDialog heroId={hero.id} targets={targets} fixedType={activeType} onToggle={(id) => setTargets(targets.filter((x) => x !== id))} onClose={() => { setTargets([]); setAttackType(null); setAimHint(null); }} />
        </Modal>
      )}
    </div>
  );
}

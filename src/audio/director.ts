import { useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { audio } from './engine';
import { cueForBeat, cuesForEvents, moodFor, type Cue, type Mood } from './cues';

/** Ce dont le chef d'orchestre a besoin du moteur audio (permet de le tester sans Web Audio). */
export interface AudioSink {
  play(cue: Cue): void;
  setMood(mood: Mood | null): void;
}

type Store = Pick<typeof useGameStore, 'getState' | 'subscribe'>;

/** Délai entre deux sons d'une même action (dés puis coup, par exemple). */
const STAGGER_MS = 170;

/**
 * Relie la partie au son : les nouveaux événements du journal déclenchent des effets, la phase choisit l'ambiance,
 * un moment de récit « danger » a son propre son. Ne rejoue jamais l'historique d'une partie chargée ou annulée.
 */
export function attachGameAudio(sink: AudioSink, store: Store = useGameStore): () => void {
  const initial = store.getState();
  let session = initial.game?.sessionId;
  let seq = initial.game?.eventSeq ?? 0;
  let phase = initial.game?.phase;
  let beatId = initial.beats[0]?.id;
  const timers: ReturnType<typeof setTimeout>[] = [];
  if (phase) sink.setMood(moodFor(phase));

  const playAll = (cues: Cue[]) =>
    cues.forEach((c, i) => {
      if (i === 0) sink.play(c);
      else timers.push(setTimeout(() => sink.play(c), i * STAGGER_MS));
    });

  const unsubscribe = store.subscribe((s) => {
    const g = s.game;
    if (!g) {
      if (session) sink.setMood(null);
      session = undefined;
      return;
    }
    if (g.sessionId !== session) {
      session = g.sessionId;
      seq = g.eventSeq;
      phase = g.phase;
      beatId = s.beats[0]?.id;
      sink.setMood(moodFor(g.phase));
      return;
    }
    if (g.eventSeq < seq) seq = g.eventSeq; // annulation : on ne rejoue rien
    else if (g.eventSeq > seq) {
      const fresh = g.events.filter((e) => e.seq > seq);
      seq = g.eventSeq;
      playAll(cuesForEvents(fresh));
    }
    if (g.phase !== phase) {
      phase = g.phase;
      sink.setMood(moodFor(g.phase));
    }
    const beat = s.beats[0];
    if (beat && beat.id !== beatId) {
      const cue = cueForBeat(beat.tone);
      if (cue) playAll([cue]);
    }
    beatId = beat?.id;
  });

  return () => {
    unsubscribe();
    timers.forEach(clearTimeout);
    sink.setMood(null);
  };
}

/** Son de l'écran de jeu : déverrouillage au premier geste, clic des boutons, effets et ambiance de la partie. */
export function useGameAudio(): void {
  useEffect(() => {
    const unlock = () => audio.unlock();
    const onClick = (e: MouseEvent) => {
      const button = (e.target as Element | null)?.closest?.('button');
      if (button && !button.disabled && !button.hasAttribute('data-silent')) audio.play('click');
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('click', onClick);
    const detach = attachGameAudio(audio);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('click', onClick);
      detach();
    };
  }, []);
}

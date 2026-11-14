import { useSyncExternalStore } from 'react';
import { Button, Panel } from '@/components/ui';
import { audio } from '@/audio/engine';
import type { Cue } from '@/audio/cues';

function useAudioSettings() {
  return useSyncExternalStore(audio.subscribe, () => audio.settings);
}

/** Bouton muet / son, toujours à portée dans la barre d'état. */
export function SoundToggle() {
  const s = useAudioSettings();
  return (
    <Button
      variant="ghost"
      aria-label={s.muted ? 'Activer le son' : 'Couper le son'}
      aria-pressed={s.muted}
      onClick={() => {
        audio.unlock();
        audio.setMuted(!s.muted);
      }}
    >
      {s.muted ? '🔇' : '🔊'}
    </Button>
  );
}

const TESTS: { cue: Cue; label: string }[] = [
  { cue: 'dice', label: 'Dés' },
  { cue: 'hit', label: 'Coup' },
  { cue: 'door', label: 'Porte' },
  { cue: 'quest', label: 'Quête' },
  { cue: 'danger', label: 'Danger' },
  { cue: 'victory', label: 'Victoire' },
];

/** Réglages du son : muet, volume de la musique et des effets, écoute des effets. Les préférences sont gardées sur l'appareil. */
export function SoundPanel() {
  const s = useAudioSettings();
  const slider = (label: string, value: number, set: (v: number) => void) => (
    <label className="flex items-center gap-3">
      <span className="w-24">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        aria-label={label}
        value={Math.round(value * 100)}
        onChange={(e) => {
          audio.unlock();
          set(Number(e.target.value) / 100);
        }}
        className="h-8 flex-1 accent-amber-500"
      />
      <span className="w-10 text-right text-sm text-stone-300">{Math.round(value * 100)}</span>
    </label>
  );
  return (
    <Panel title="Son">
      <div className="space-y-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={s.muted}
            onChange={(e) => {
              audio.unlock();
              audio.setMuted(e.target.checked);
            }}
          />
          Couper tout le son
        </label>
        {slider('Musique', s.music, (v) => audio.setMusicVolume(v))}
        {slider('Effets', s.sfx, (v) => audio.setSfxVolume(v))}
        <div className="flex flex-wrap gap-2" aria-label="Écouter un effet">
          {TESTS.map((t) => (
            <Button key={t.cue} data-silent="" onClick={() => { audio.unlock(); audio.play(t.cue); }}>
              ▶ {t.label}
            </Button>
          ))}
        </div>
        <p className="text-sm text-stone-400">Sons et ambiances sont générés par l’appareil : rien à télécharger. Le navigateur n’autorise le son qu’après votre premier geste.</p>
      </div>
    </Panel>
  );
}

import type { Instrument } from "@dawai/core/document";
import { SYNTH_PRESETS } from "@dawai/core/presets";
import * as Tone from "tone";

/**
 * Synth preset → Tone voice. Preset *data* lives in @dawai/core; this
 * module is the Tone-specific interpretation of it (boundary 3: Tone
 * exists only in the UI package).
 */

export interface InstrumentVoice {
  output: Tone.ToneAudioNode;
  triggerNote: (
    pitch: number,
    durationSeconds: number,
    time: number,
    velocity: number,
  ) => void;
  applyParam: (param: string, value: number) => void;
  dispose: () => void;
}

export function createSynthVoice(
  instrument: Extract<Instrument, { kind: "synth" }>,
): InstrumentVoice {
  const preset = SYNTH_PRESETS[instrument.preset];
  const { oscillator, envelope, filter } = preset;

  const synth = new Tone.PolySynth(Tone.MonoSynth, {
    oscillator:
      oscillator.voices > 1
        ? {
            type: `fat${oscillator.type}` as "fatsawtooth",
            count: oscillator.voices,
            spread: oscillator.spread,
          }
        : { type: oscillator.type },
    envelope,
    filter: { type: filter.mode, Q: filter.q, rolloff: -12 },
    filterEnvelope: {
      attack: 0.001,
      decay: 0.1,
      sustain: 1,
      release: 0.5,
      baseFrequency: filter.cutoff,
      octaves: 0,
    },
    ...instrument.params,
  });
  synth.maxPolyphony = 16;

  return {
    output: synth,
    triggerNote: (pitch, durationSeconds, time, velocity) => {
      synth.triggerAttackRelease(
        Tone.Frequency(pitch, "midi").toFrequency(),
        durationSeconds,
        time,
        velocity,
      );
    },
    applyParam: (param, value) => {
      synth.set({ [param]: value } as Record<string, number>);
    },
    dispose: () => synth.dispose(),
  };
}

import type { KitId } from "@dawai/core/kits";
import { KITS } from "@dawai/core/kits";
import * as Tone from "tone";

/**
 * Synthesized kit voices (decision 2026-07-18): every pad is a drum-
 * synthesis recipe, not a sample file — zero assets, deterministic.
 * The kit's pad → pitch mapping in @dawai/core stays the contract;
 * this module maps pad names to recipes.
 */

interface DrumVoice {
  trigger: (time: number, velocity: number) => void;
  dispose: () => void;
}

export interface KitVoices {
  output: Tone.ToneAudioNode;
  triggerPitch: (pitch: number, time: number, velocity: number) => void;
  dispose: () => void;
}

function noiseVoice(
  output: Tone.ToneAudioNode,
  options: {
    decay: number;
    filterType: "highpass" | "bandpass" | "lowpass";
    frequency: number;
    q?: number;
    gainDb?: number;
  },
): DrumVoice {
  const gain = new Tone.Gain(options.gainDb ?? 0, "decibels").connect(output);
  const filter = new Tone.Filter({
    type: options.filterType,
    frequency: options.frequency,
    Q: options.q ?? 0.8,
  }).connect(gain);
  const noise = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: options.decay, sustain: 0 },
  }).connect(filter);
  return {
    trigger: (time, velocity) =>
      noise.triggerAttackRelease(options.decay, time, velocity),
    dispose: () => {
      noise.dispose();
      filter.dispose();
      gain.dispose();
    },
  };
}

function membraneVoice(
  output: Tone.ToneAudioNode,
  options: {
    note: string;
    decay: number;
    pitchDecay?: number;
    octaves?: number;
    gainDb?: number;
  },
): DrumVoice {
  const gain = new Tone.Gain(options.gainDb ?? 0, "decibels").connect(output);
  const membrane = new Tone.MembraneSynth({
    pitchDecay: options.pitchDecay ?? 0.045,
    octaves: options.octaves ?? 6,
    oscillator: { type: "sine" },
    envelope: {
      attack: 0.001,
      decay: options.decay,
      sustain: 0,
      release: 0.05,
    },
  }).connect(gain);
  return {
    trigger: (time, velocity) =>
      membrane.triggerAttackRelease(
        options.note,
        options.decay,
        time,
        velocity,
      ),
    dispose: () => {
      membrane.dispose();
      gain.dispose();
    },
  };
}

function metalVoice(
  output: Tone.ToneAudioNode,
  options: {
    decay: number;
    frequency: number;
    harmonicity?: number;
    gainDb?: number;
  },
): DrumVoice {
  const gain = new Tone.Gain(options.gainDb ?? 0, "decibels").connect(output);
  const metal = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: options.decay, release: 0.1 },
    harmonicity: options.harmonicity ?? 5.1,
    modulationIndex: 24,
    resonance: options.frequency,
    octaves: 1.2,
  }).connect(gain);
  return {
    trigger: (time, velocity) =>
      metal.triggerAttackRelease(options.decay, time, velocity),
    dispose: () => {
      metal.dispose();
      gain.dispose();
    },
  };
}

/** Snare = noise crack + tonal body, blended. */
function snareVoice(output: Tone.ToneAudioNode): DrumVoice {
  const crack = noiseVoice(output, {
    decay: 0.16,
    filterType: "bandpass",
    frequency: 1800,
    q: 0.6,
  });
  const body = membraneVoice(output, {
    note: "G2",
    decay: 0.09,
    pitchDecay: 0.02,
    octaves: 2,
    gainDb: -8,
  });
  return {
    trigger: (time, velocity) => {
      crack.trigger(time, velocity);
      body.trigger(time, velocity * 0.9);
    },
    dispose: () => {
      crack.dispose();
      body.dispose();
    },
  };
}

const PAD_RECIPES: Record<string, (output: Tone.ToneAudioNode) => DrumVoice> = {
  kick: (output) =>
    membraneVoice(output, { note: "A0", decay: 0.32, octaves: 7 }),
  rim: (output) =>
    noiseVoice(output, {
      decay: 0.03,
      filterType: "bandpass",
      frequency: 3400,
      q: 3,
      gainDb: -4,
    }),
  snare: snareVoice,
  clap: (output) =>
    noiseVoice(output, {
      decay: 0.22,
      filterType: "bandpass",
      frequency: 1200,
      q: 1,
    }),
  chh: (output) =>
    noiseVoice(output, {
      decay: 0.045,
      filterType: "highpass",
      frequency: 8000,
      gainDb: -6,
    }),
  phh: (output) =>
    noiseVoice(output, {
      decay: 0.03,
      filterType: "highpass",
      frequency: 8500,
      gainDb: -10,
    }),
  ohh: (output) =>
    noiseVoice(output, {
      decay: 0.3,
      filterType: "highpass",
      frequency: 7500,
      gainDb: -8,
    }),
  crash: (output) =>
    metalVoice(output, { decay: 1.6, frequency: 4000, gainDb: -8 }),
  ride: (output) =>
    metalVoice(output, { decay: 0.9, frequency: 5200, gainDb: -12 }),
  perc1: (output) =>
    membraneVoice(output, {
      note: "E3",
      decay: 0.12,
      pitchDecay: 0.02,
      octaves: 3,
      gainDb: -6,
    }),
  perc2: (output) =>
    membraneVoice(output, {
      note: "G3",
      decay: 0.12,
      pitchDecay: 0.02,
      octaves: 3,
      gainDb: -6,
    }),
  shaker: (output) =>
    noiseVoice(output, {
      decay: 0.05,
      filterType: "bandpass",
      frequency: 6000,
      q: 2,
      gainDb: -10,
    }),
};

export function createKitVoices(kitId: KitId): KitVoices {
  const output = new Tone.Gain(1);
  const voicesByPitch = new Map<number, DrumVoice>();
  const lastTriggerByPitch = new Map<number, number>();
  for (const [padName, pad] of Object.entries(KITS[kitId])) {
    const recipe = PAD_RECIPES[padName];
    if (recipe) voicesByPitch.set(pad.pitch, recipe(output));
  }
  return {
    output,
    triggerPitch: (pitch, time, velocity) => {
      // Drum voices are monophonic: two triggers at the same instant
      // (layered patterns) must collapse to one, or Tone throws
      // "start time must be strictly greater than previous".
      const last = lastTriggerByPitch.get(pitch);
      if (last !== undefined && time <= last + 1e-4) return;
      lastTriggerByPitch.set(pitch, time);
      voicesByPitch.get(pitch)?.trigger(time, velocity);
    },
    dispose: () => {
      for (const voice of voicesByPitch.values()) voice.dispose();
      output.dispose();
    },
  };
}

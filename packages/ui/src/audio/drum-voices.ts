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
  release: () => void;
  dispose: () => void;
}

export interface KitVoices {
  output: Tone.ToneAudioNode;
  triggerPitch: (pitch: number, time: number, velocity: number) => void;
  /** Cuts every sounding pad now — pause/stop must not ring out. */
  releaseAll: () => void;
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
    release: () => noise.triggerRelease(),
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
    release: () => membrane.triggerRelease(),
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
    // MetalSynth is pitched: (note, duration, time, velocity). The strike
    // note sets the modal stack's root; 250Hz is a typical cymbal strike.
    trigger: (time, velocity) =>
      metal.triggerAttackRelease(250, options.decay, time, velocity),
    release: () => metal.triggerRelease(),
    dispose: () => {
      metal.dispose();
      gain.dispose();
    },
  };
}

/** Composes several voices into one pad trigger. */
function layered(...voices: DrumVoice[]): DrumVoice {
  return {
    trigger: (time, velocity) => {
      for (const voice of voices) voice.trigger(time, velocity);
    },
    release: () => {
      for (const voice of voices) voice.release();
    },
    dispose: () => {
      for (const voice of voices) voice.dispose();
    },
  };
}

/** Kick v2: pitch-envelope body + click transient + saturation. */
function kickVoice(output: Tone.ToneAudioNode): DrumVoice {
  const drive = new Tone.Distortion({ distortion: 0.35, wet: 0.6 }).connect(
    output,
  );
  const body = membraneVoice(drive, {
    note: "A0",
    decay: 0.34,
    octaves: 7,
    pitchDecay: 0.05,
  });
  const click = noiseVoice(drive, {
    decay: 0.015,
    filterType: "highpass",
    frequency: 3800,
    gainDb: -6,
  });
  const voice = layered(body, click);
  return {
    trigger: voice.trigger,
    release: voice.release,
    dispose: () => {
      voice.dispose();
      drive.dispose();
    },
  };
}

/** Snare v2: crack + tonal body + high rattle tail. */
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
  const rattle = noiseVoice(output, {
    decay: 0.3,
    filterType: "highpass",
    frequency: 5000,
    gainDb: -14,
  });
  return layered(
    crack,
    {
      trigger: (time, velocity) => body.trigger(time, velocity * 0.9),
      release: body.release,
      dispose: body.dispose,
    },
    rattle,
  );
}

/** Impact: cinematic downbeat boom — long sub drop + dark noise wash. */
function impactVoice(output: Tone.ToneAudioNode): DrumVoice {
  const boom = membraneVoice(output, {
    note: "A0",
    decay: 1.3,
    octaves: 8,
    pitchDecay: 0.22,
  });
  const wash = noiseVoice(output, {
    decay: 1.6,
    filterType: "lowpass",
    frequency: 500,
    gainDb: -8,
  });
  return layered(boom, wash);
}

const PAD_RECIPES: Record<string, (output: Tone.ToneAudioNode) => DrumVoice> = {
  impact: impactVoice,
  kick: kickVoice,
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
    metalVoice(output, { decay: 1.6, frequency: 4000, gainDb: -20 }),
  ride: (output) =>
    metalVoice(output, { decay: 0.9, frequency: 5200, gainDb: -18 }),
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

/**
 * Builds the kit's pad voices. Pass `usedPitches` (known at build time
 * from the track's clips) to instantiate only the pads a track plays —
 * a full kit is ~20 synths and eager-building every pad on every kit
 * track blows the WebAudio node budget and starves the render thread.
 */
export function createKitVoices(
  kitId: KitId,
  usedPitches?: ReadonlySet<number>,
): KitVoices {
  const output = new Tone.Gain(1);
  const voicesByPitch = new Map<number, DrumVoice>();
  const lastTriggerByPitch = new Map<number, number>();
  for (const [padName, pad] of Object.entries(KITS[kitId])) {
    if (usedPitches && !usedPitches.has(pad.pitch)) continue;
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
    releaseAll: () => {
      for (const voice of voicesByPitch.values()) voice.release();
    },
    dispose: () => {
      for (const voice of voicesByPitch.values()) voice.dispose();
      output.dispose();
    },
  };
}

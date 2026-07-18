/**
 * Built-in synth presets. The IR stores only a preset id plus numeric
 * param overrides; these definitions are the renderer-agnostic defaults
 * a renderer (e.g. the Tone.js renderer in @dawai/ui) interprets.
 */

export const SYNTH_PRESET_IDS = [
  "sub-sine",
  "reese",
  "fat-saw",
  "supersaw",
  "warm-pad",
  "pluck",
  "keys",
  "bell",
] as const;

export type SynthPresetId = (typeof SYNTH_PRESET_IDS)[number];

export interface SynthPresetDefinition {
  oscillator: {
    type: "sine" | "triangle" | "sawtooth" | "square";
    /** Number of unison voices (1 = single voice). */
    voices: number;
    /** Unison detune spread in cents (0 when voices is 1). */
    spread: number;
  };
  envelope: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
  filter: {
    mode: "lowpass" | "highpass";
    cutoff: number;
    q: number;
  };
}

export const SYNTH_PRESETS: Record<SynthPresetId, SynthPresetDefinition> = {
  "sub-sine": {
    oscillator: { type: "sine", voices: 1, spread: 0 },
    envelope: { attack: 0.005, decay: 0.1, sustain: 1, release: 0.08 },
    filter: { mode: "lowpass", cutoff: 300, q: 0.7 },
  },
  reese: {
    oscillator: { type: "sawtooth", voices: 2, spread: 35 },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.9, release: 0.12 },
    filter: { mode: "lowpass", cutoff: 900, q: 1.2 },
  },
  "fat-saw": {
    oscillator: { type: "sawtooth", voices: 3, spread: 20 },
    envelope: { attack: 0.005, decay: 0.15, sustain: 0.8, release: 0.1 },
    filter: { mode: "lowpass", cutoff: 4000, q: 0.9 },
  },
  supersaw: {
    oscillator: { type: "sawtooth", voices: 7, spread: 50 },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.4 },
    filter: { mode: "lowpass", cutoff: 8000, q: 0.8 },
  },
  "warm-pad": {
    oscillator: { type: "sawtooth", voices: 4, spread: 25 },
    envelope: { attack: 0.8, decay: 0.5, sustain: 0.8, release: 1.5 },
    filter: { mode: "lowpass", cutoff: 1800, q: 0.6 },
  },
  pluck: {
    oscillator: { type: "triangle", voices: 1, spread: 0 },
    envelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.2 },
    filter: { mode: "lowpass", cutoff: 5000, q: 1 },
  },
  keys: {
    oscillator: { type: "triangle", voices: 2, spread: 8 },
    envelope: { attack: 0.005, decay: 0.4, sustain: 0.4, release: 0.5 },
    filter: { mode: "lowpass", cutoff: 6000, q: 0.7 },
  },
  bell: {
    oscillator: { type: "sine", voices: 2, spread: 12 },
    envelope: { attack: 0.002, decay: 1.2, sustain: 0, release: 1.4 },
    filter: { mode: "highpass", cutoff: 400, q: 0.7 },
  },
};

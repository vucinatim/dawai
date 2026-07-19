import { z } from "zod";

/**
 * Voice schema v2: a synth voice is a stack of layers over a shared
 * filter with a real filter envelope — movement is the point. Pure
 * data; the renderer interprets it. Built-in presets (presets.ts) and
 * inline custom voices (instrument kind "voice") share this shape.
 */

const gainDb = z.number().finite().min(-60).max(12);

export const adsrSchema = z.object({
  attack: z.number().finite().min(0.001).max(30),
  decay: z.number().finite().min(0.001).max(30),
  sustain: z.number().finite().min(0).max(1),
  release: z.number().finite().min(0.001).max(30),
});

export const oscillatorLayerSchema = z.object({
  kind: z.literal("osc"),
  type: z.enum(["sine", "triangle", "sawtooth", "square"]),
  /** Unison voices (1 = single). */
  voices: z.number().int().min(1).max(8),
  /** Unison spread in cents (0 when voices is 1). */
  spread: z.number().finite().min(0).max(100),
  /** Static detune from the note, in cents. */
  detune: z.number().finite().min(-1200).max(1200),
  /** Octave shift relative to the note. */
  octave: z.number().int().min(-3).max(3),
  gain: gainDb,
});

export const fmLayerSchema = z.object({
  kind: z.literal("fm"),
  harmonicity: z.number().finite().min(0.1).max(12),
  modulationIndex: z.number().finite().min(0).max(50),
  octave: z.number().int().min(-3).max(3),
  gain: gainDb,
});

export const noiseLayerSchema = z.object({
  kind: z.literal("noise"),
  type: z.enum(["white", "pink", "brown"]),
  gain: gainDb,
});

export const voiceLayerSchema = z.discriminatedUnion("kind", [
  oscillatorLayerSchema,
  fmLayerSchema,
  noiseLayerSchema,
]);

export const voiceDefinitionSchema = z.object({
  layers: z.array(voiceLayerSchema).min(1).max(4),
  amp: adsrSchema,
  filter: z.object({
    mode: z.enum(["lowpass", "highpass", "bandpass"]),
    cutoff: z.number().finite().min(20).max(20000),
    q: z.number().finite().min(0.1).max(20),
  }),
  /**
   * Filter movement per note: the filter opens `octaves` above cutoff
   * along this envelope. octaves 0 = static filter.
   */
  filterEnvelope: adsrSchema.extend({
    octaves: z.number().finite().min(0).max(8),
  }),
  /** Post-voice color: 0 disables the stage. */
  drive: z.number().finite().min(0).max(1),
  chorus: z.number().finite().min(0).max(1),
});

export type Adsr = z.infer<typeof adsrSchema>;
export type OscillatorLayer = z.infer<typeof oscillatorLayerSchema>;
export type FmLayer = z.infer<typeof fmLayerSchema>;
export type NoiseLayer = z.infer<typeof noiseLayerSchema>;
export type VoiceLayer = z.infer<typeof voiceLayerSchema>;
export type VoiceDefinition = z.infer<typeof voiceDefinitionSchema>;

/**
 * Preset `params` are dotted-path overrides into the VoiceDefinition
 * (e.g. { "filter.cutoff": 400, "filterEnvelope.octaves": 3 }).
 * Only these paths are overridable; validation rejects the rest.
 */
export const VOICE_PARAM_PATHS = new Set([
  "filter.cutoff",
  "filter.q",
  "filterEnvelope.attack",
  "filterEnvelope.decay",
  "filterEnvelope.sustain",
  "filterEnvelope.release",
  "filterEnvelope.octaves",
  "amp.attack",
  "amp.decay",
  "amp.sustain",
  "amp.release",
  "drive",
  "chorus",
]);

/** Applies dotted-path param overrides to a voice (pure). */
export function resolveVoice(
  voice: VoiceDefinition,
  params: Record<string, number>,
): VoiceDefinition {
  const resolved: VoiceDefinition = structuredClone(voice);
  for (const [path, value] of Object.entries(params)) {
    if (!VOICE_PARAM_PATHS.has(path)) {
      throw new Error(
        `Unknown voice param "${path}". Overridable: ${[...VOICE_PARAM_PATHS].join(", ")}.`,
      );
    }
    const segments = path.split(".");
    let target = resolved as unknown as Record<string, unknown>;
    for (const segment of segments.slice(0, -1)) {
      target = target[segment] as Record<string, unknown>;
    }
    target[segments.at(-1) as string] = value;
  }
  return voiceDefinitionSchema.parse(resolved);
}

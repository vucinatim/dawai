import { z } from "zod";
import { KIT_IDS } from "./kits.ts";
import { SYNTH_PRESET_IDS } from "./presets.ts";
import { voiceDefinitionSchema } from "./voice.ts";

/**
 * The Document: dawai's IR. A compile artifact of song source — never
 * hand-edited — and the stable contract consumed by the server, the UI
 * renderers, and analysis. Everything here is explicit: constructors in
 * @dawai/composer fill defaults; the IR carries no optional knobs.
 *
 * Time is in beats (see time.ts). Pitch and velocity are MIDI 0–127.
 */

const beats = z.number().finite().min(0);
const midiValue = z.number().int().min(0).max(127);
const decibels = z.number().finite().min(-60).max(12);

/** [start (beats, clip-relative), pitch, length (beats), velocity] */
export const noteTupleSchema = z.tuple([
  beats,
  midiValue,
  z.number().finite().positive(),
  midiValue,
]);

export const clipSchema = z.object({
  id: z.string().min(1),
  start: beats,
  length: z.number().finite().positive(),
  notes: z.array(noteTupleSchema),
});

export const instrumentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("synth"),
    preset: z.enum(SYNTH_PRESET_IDS),
    /** Dotted-path overrides into the preset's voice (see voice.ts). */
    params: z.record(z.string(), z.number().finite()),
  }),
  z.object({
    kind: z.literal("voice"),
    /** A fully inline custom voice — song-level custom synths. */
    voice: voiceDefinitionSchema,
  }),
  z.object({
    kind: z.literal("sampler"),
    kit: z.enum(KIT_IDS),
  }),
  z.object({
    kind: z.literal("sample"),
    /** Sample source: starter-library id or song-relative file path. */
    source: z.string().min(1),
    stretch: z.literal("repitch"),
  }),
]);

export const fxSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("filter"),
    mode: z.enum(["lowpass", "highpass", "bandpass"]),
    cutoff: z.number().finite().min(20).max(20000),
    q: z.number().finite().min(0.1).max(20),
  }),
  z.object({
    type: z.literal("eq"),
    low: z.number().finite().min(-24).max(24),
    mid: z.number().finite().min(-24).max(24),
    high: z.number().finite().min(-24).max(24),
  }),
  z.object({
    type: z.literal("compressor"),
    threshold: z.number().finite().min(-60).max(0),
    ratio: z.number().finite().min(1).max(20),
    attack: z.number().finite().min(0.001).max(1),
    release: z.number().finite().min(0.01).max(2),
    knee: z.number().finite().min(0).max(40),
  }),
  z.object({
    type: z.literal("distortion"),
    amount: z.number().finite().min(0).max(1),
  }),
  z.object({
    type: z.literal("chorus"),
    rate: z.number().finite().min(0.1).max(10),
    depth: z.number().finite().min(0).max(1),
    mix: z.number().finite().min(0).max(1),
  }),
  z.object({
    type: z.literal("reverb"),
    decay: z.number().finite().min(0.1).max(20),
    predelay: z.number().finite().min(0).max(0.5),
    mix: z.number().finite().min(0).max(1),
  }),
  z.object({
    type: z.literal("delay"),
    /** Delay time in beats — musical, tempo-independent. */
    time: z.number().finite().min(0.05).max(8),
    feedback: z.number().finite().min(0).max(0.95),
    mix: z.number().finite().min(0).max(1),
  }),
  z.object({
    type: z.literal("limiter"),
    ceiling: z.number().finite().min(-12).max(0),
  }),
  z.object({
    /** OTT-style multiband squash: the modern electronic glue. */
    type: z.literal("ott"),
    amount: z.number().finite().min(0).max(1),
    /** Makeup gain in dB. */
    gain: z.number().finite().min(-12).max(12),
  }),
]);

export const trackSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  instrument: instrumentSchema,
  gain: decibels,
  pan: z.number().finite().min(-1).max(1),
  mute: z.boolean(),
  /** "master" or a bus id. */
  out: z.string().min(1),
  fx: z.array(fxSchema),
  clips: z.array(clipSchema),
});

export const busSchema = z.object({
  id: z.string().min(1),
  gain: decibels,
  fx: z.array(fxSchema),
});

export const sectionSchema = z.object({
  name: z.string().min(1),
  start: beats,
  length: z.number().finite().positive(),
});

export const automationTargetSchema = z.object({
  owner: z.discriminatedUnion("type", [
    z.object({ type: z.literal("track"), id: z.string().min(1) }),
    z.object({ type: z.literal("bus"), id: z.string().min(1) }),
    z.object({ type: z.literal("master") }),
  ]),
  /**
   * Canonical param path on the owner:
   *   "gain" | "pan" | "duck" | "fx.<index>.<param>" | "instrument.<param>"
   * ("duck" is a gain offset in dB applied after gain; duck compilation
   * writes here so authored gain automation stays composable with it.)
   */
  path: z.string().min(1),
});

/**
 * Interpolation: the segment from the previous point to this one uses
 * THIS point's curve ("step" holds the previous value, then jumps).
 * Two points on the same beat form an instantaneous jump. Before the
 * first point the param holds the first point's value; after the last,
 * the last point's. A lane shadows the param's static value.
 */
export const automationPointSchema = z.object({
  beat: beats,
  value: z.number().finite(),
  curve: z.enum(["linear", "exp", "step"]),
});

export const automationLaneSchema = z.object({
  target: automationTargetSchema,
  points: z.array(automationPointSchema).min(1),
});

export const documentSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1),
  tempo: z.number().finite().min(20).max(999),
  timeSignature: z.tuple([
    z.number().int().min(1).max(16),
    z.union([
      z.literal(1),
      z.literal(2),
      z.literal(4),
      z.literal(8),
      z.literal(16),
    ]),
  ]),
  sections: z.array(sectionSchema),
  tracks: z.array(trackSchema),
  buses: z.array(busSchema),
  master: z.object({ fx: z.array(fxSchema) }),
  automation: z.array(automationLaneSchema),
});

export type NoteTuple = z.infer<typeof noteTupleSchema>;
export type Clip = z.infer<typeof clipSchema>;
export type Instrument = z.infer<typeof instrumentSchema>;
export type Fx = z.infer<typeof fxSchema>;
export type Track = z.infer<typeof trackSchema>;
export type Bus = z.infer<typeof busSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type AutomationTarget = z.infer<typeof automationTargetSchema>;
export type AutomationPoint = z.infer<typeof automationPointSchema>;
export type AutomationLane = z.infer<typeof automationLaneSchema>;
export type Document = z.infer<typeof documentSchema>;

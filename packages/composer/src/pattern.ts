import { resolvePitch } from "@dawai/core/notes";

/**
 * A Pattern is the unit of reusable musical material: a length in beats
 * plus note events relative to its own start. Patterns are immutable
 * values — every builder and combinator returns a new one.
 */

export interface NoteEvent {
  start: number;
  pitch: number;
  length: number;
  velocity: number;
}

export interface Placement {
  pattern: Pattern;
  /** 1-based bar on the song timeline. */
  bar: number;
}

export interface Pattern {
  readonly lengthBeats: number;
  readonly events: readonly NoteEvent[];
  /** Places this pattern at a 1-based bar for track-level absolute clips. */
  at(bar: number): Placement;
}

export function createPattern(
  lengthBeats: number,
  events: NoteEvent[],
): Pattern {
  if (!Number.isFinite(lengthBeats) || lengthBeats <= 0) {
    throw new Error(
      `Pattern length must be a positive number of beats, got ${lengthBeats}.`,
    );
  }
  for (const event of events) {
    if (event.start < 0 || event.start >= lengthBeats) {
      throw new Error(
        `Note at beat ${event.start} is outside its pattern (length ${lengthBeats} beats). Notes must start within [0, length).`,
      );
    }
  }
  const pattern: Pattern = {
    lengthBeats,
    events: Object.freeze(
      events.map((event) => Object.freeze({ ...event })),
    ) as readonly NoteEvent[],
    at(bar: number): Placement {
      if (!Number.isInteger(bar) || bar < 1) {
        throw new Error(`.at(bar) takes a 1-based bar number, got ${bar}.`);
      }
      return { pattern, bar };
    },
  };
  return Object.freeze(pattern);
}

/** Shared velocity defaults across builders. */
export const VELOCITY = {
  hit: 100,
  accent: 118,
  ghost: 55,
  melodic: 96,
  chordal: 90,
} as const;

export function eventFromTuple(
  start: number,
  pitch: number | string,
  length: number,
  velocity: number,
): NoteEvent {
  return { start, pitch: resolvePitch(pitch), length, velocity };
}

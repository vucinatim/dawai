import { resolvePitch } from "@dawai/core/notes";
import { chordToPitches } from "./chordNames.ts";
import {
  createPattern,
  eventFromTuple,
  type NoteEvent,
  type Pattern,
  VELOCITY,
} from "./pattern.ts";

/** Pattern builders — the floor is `notes()`; everything else is sugar. */

export type NoteInput = [
  start: number,
  pitch: number | string,
  length: number,
  velocity: number,
];

/**
 * Literal notes. The always-available escape hatch: raw tuples, pitch as
 * MIDI number or note name. Length defaults to the last note's end,
 * rounded up to a whole beat.
 */
export function notes(tuples: NoteInput[], lengthBeats?: number): Pattern {
  const events = tuples.map(([start, pitch, length, velocity]) =>
    eventFromTuple(start, pitch, length, velocity),
  );
  const inferredLength = Math.max(
    1,
    Math.ceil(Math.max(0, ...events.map((e) => e.start + e.length))),
  );
  return createPattern(lengthBeats ?? inferredLength, events);
}

export interface StepsOptions {
  /** Beats per character; 0.25 = 16th notes at x/4. */
  step?: number;
  /** Note length in beats (defaults to the step size). */
  noteLength?: number;
}

/**
 * Drum-machine step grid: one character per step.
 *   x = hit (vel 100)   X = accent (118)   o = ghost (55)   . = rest
 * Whitespace and "|" are readability separators and are ignored.
 */
export function steps(
  grid: string,
  pitch: number | string,
  options: StepsOptions = {},
): Pattern {
  const step = options.step ?? 0.25;
  const noteLength = options.noteLength ?? step;
  const characters = grid.replace(/[\s|]/g, "").split("");
  if (characters.length === 0) {
    throw new Error(
      "steps() needs at least one step character (x, X, o, or .).",
    );
  }
  const resolvedPitch = resolvePitch(pitch);
  const events: NoteEvent[] = [];
  for (const [index, character] of characters.entries()) {
    const velocity =
      character === "x"
        ? VELOCITY.hit
        : character === "X"
          ? VELOCITY.accent
          : character === "o"
            ? VELOCITY.ghost
            : character === "."
              ? undefined
              : (() => {
                  throw new Error(
                    `Invalid step character "${character}" in "${grid}". Use x (hit), X (accent), o (ghost), . (rest).`,
                  );
                })();
    if (velocity !== undefined) {
      events.push({
        start: index * step,
        pitch: resolvedPitch,
        length: noteLength,
        velocity,
      });
    }
  }
  return createPattern(characters.length * step, events);
}

export interface ChordsOptions {
  /** Beats per chord. */
  beats?: number;
  octave?: number;
  velocity?: number;
}

/** A chord progression: each name held for `beats`, played as a block. */
export function chords(names: string[], options: ChordsOptions = {}): Pattern {
  const beatsPerChord = options.beats ?? 4;
  const octave = options.octave ?? 3;
  const velocity = options.velocity ?? VELOCITY.chordal;
  if (names.length === 0)
    throw new Error("chords() needs at least one chord name.");
  const events: NoteEvent[] = names.flatMap((name, index) =>
    chordToPitches(name, octave).map((pitch) => ({
      start: index * beatsPerChord,
      pitch,
      length: beatsPerChord,
      velocity,
    })),
  );
  return createPattern(names.length * beatsPerChord, events);
}

export interface MelodyOptions {
  /** Beats per token. */
  step?: number;
  velocity?: number;
}

/**
 * A monophonic line from tokens: note names play for one step,
 * "~" extends the previous note by a step, "." rests.
 *   melody("E3 G3 ~ A3 . B3", { step: 0.5 })
 */
export function melody(line: string, options: MelodyOptions = {}): Pattern {
  const step = options.step ?? 0.5;
  const velocity = options.velocity ?? VELOCITY.melodic;
  const tokens = line.trim().split(/\s+/);
  if (tokens.length === 0 || tokens[0] === "") {
    throw new Error("melody() needs at least one token (note name, ~, or .).");
  }
  const events: NoteEvent[] = [];
  let previousWasSounding = false;
  for (const [index, token] of tokens.entries()) {
    if (token === ".") {
      previousWasSounding = false;
      continue;
    }
    if (token === "~") {
      const previous = events.at(-1);
      if (!previous || !previousWasSounding) {
        throw new Error(
          `melody(): "~" at token ${index + 1} must directly follow a note (or another "~") — it cannot extend across a rest.`,
        );
      }
      previous.length += step;
      continue;
    }
    events.push({
      start: index * step,
      pitch: resolvePitch(token),
      length: step,
      velocity,
    });
    previousWasSounding = true;
  }
  return createPattern(tokens.length * step, events);
}

export interface ArpOptions {
  style?: "up" | "down" | "updown";
  /** Beats per arp note. */
  step?: number;
  /** Base octave when `input` is a chord name. */
  octave?: number;
  octaves?: number;
  velocity?: number;
}

/** One cycle of an arpeggio over a chord name or explicit pitches. */
export function arp(
  input: string | (number | string)[],
  options: ArpOptions = {},
): Pattern {
  const style = options.style ?? "up";
  const step = options.step ?? 0.25;
  const octaves = options.octaves ?? 1;
  const velocity = options.velocity ?? VELOCITY.melodic;

  const basePitches =
    typeof input === "string"
      ? chordToPitches(input, options.octave ?? 3)
      : input.map((pitch) => resolvePitch(pitch));
  if (basePitches.length === 0)
    throw new Error("arp() needs at least one pitch.");

  const spread: number[] = [];
  for (let octave = 0; octave < octaves; octave++) {
    spread.push(...basePitches.map((pitch) => pitch + octave * 12));
  }
  const ascending = [...spread].sort((a, b) => a - b);
  const shape =
    style === "up"
      ? ascending
      : style === "down"
        ? [...ascending].reverse()
        : [...ascending, ...[...ascending].reverse().slice(1, -1)];

  const events = shape.map((pitch, index) => ({
    start: index * step,
    pitch: resolvePitch(pitch),
    length: step,
    velocity,
  }));
  return createPattern(shape.length * step, events);
}

export interface EuclidOptions {
  /** Beats per step. */
  step?: number;
  velocity?: number;
}

/** Euclidean rhythm: `hits` distributed as evenly as possible over `stepCount`. */
export function euclid(
  hits: number,
  stepCount: number,
  pitch: number | string,
  options: EuclidOptions = {},
): Pattern {
  if (
    !Number.isInteger(hits) ||
    !Number.isInteger(stepCount) ||
    stepCount < 1 ||
    hits < 0
  ) {
    throw new Error(
      `euclid() needs integer hits ≥ 0 and steps ≥ 1, got euclid(${hits}, ${stepCount}).`,
    );
  }
  if (hits > stepCount) {
    throw new Error(
      `euclid(${hits}, ${stepCount}): cannot place more hits than steps.`,
    );
  }
  const step = options.step ?? 0.25;
  const velocity = options.velocity ?? VELOCITY.hit;
  const resolvedPitch = resolvePitch(pitch);
  const events: NoteEvent[] = [];
  // Bresenham distribution — equivalent to Bjorklund for our purposes.
  for (let index = 0; index < stepCount; index++) {
    const current = Math.floor((index * hits) / stepCount);
    const previous = Math.floor(((index - 1) * hits) / stepCount);
    if (index === 0 ? hits > 0 : current !== previous) {
      events.push({
        start: index * step,
        pitch: resolvedPitch,
        length: step,
        velocity,
      });
    }
  }
  return createPattern(stepCount * step, events);
}

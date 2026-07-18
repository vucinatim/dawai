import { createPattern, type NoteEvent, type Pattern } from "./pattern.ts";
import { createRandom } from "./random.ts";

/** Structural combinators — all pure; every call returns a new Pattern. */

/** Concatenates patterns end to end. */
export function seq(...patterns: Pattern[]): Pattern {
  if (patterns.length === 0)
    throw new Error("seq() needs at least one pattern.");
  const events: NoteEvent[] = [];
  let cursor = 0;
  for (const pattern of patterns) {
    events.push(
      ...pattern.events.map((event) => ({
        ...event,
        start: event.start + cursor,
      })),
    );
    cursor += pattern.lengthBeats;
  }
  return createPattern(cursor, events);
}

/** Layers patterns on top of each other; length is the longest layer. */
export function stack(...patterns: Pattern[]): Pattern {
  if (patterns.length === 0)
    throw new Error("stack() needs at least one pattern.");
  const lengthBeats = Math.max(
    ...patterns.map((pattern) => pattern.lengthBeats),
  );
  const events = patterns.flatMap((pattern) =>
    pattern.events.map((event) => ({ ...event })),
  );
  return createPattern(lengthBeats, events);
}

export function repeat(pattern: Pattern, times: number): Pattern {
  if (!Number.isInteger(times) || times < 1) {
    throw new Error(
      `repeat() takes a whole number of times ≥ 1, got ${times}.`,
    );
  }
  return seq(...Array.from({ length: times }, () => pattern));
}

export function transpose(pattern: Pattern, semitones: number): Pattern {
  if (!Number.isInteger(semitones)) {
    throw new Error(`transpose() takes whole semitones, got ${semitones}.`);
  }
  const events = pattern.events.map((event) => {
    const pitch = event.pitch + semitones;
    if (pitch < 0 || pitch > 127) {
      throw new Error(
        `transpose(${semitones}) moves pitch ${event.pitch} to ${pitch}, outside MIDI range 0–127.`,
      );
    }
    return { ...event, pitch };
  });
  return createPattern(pattern.lengthBeats, events);
}

/** Cuts the window [fromBeat, toBeat) out of a pattern. */
export function slice(
  pattern: Pattern,
  fromBeat: number,
  toBeat: number,
): Pattern {
  if (fromBeat < 0 || toBeat <= fromBeat) {
    throw new Error(
      `slice() needs 0 ≤ from < to, got slice(${fromBeat}, ${toBeat}).`,
    );
  }
  if (toBeat > pattern.lengthBeats) {
    throw new Error(
      `slice(${fromBeat}, ${toBeat}) reaches beyond the pattern (length ${pattern.lengthBeats} beats).`,
    );
  }
  const events = pattern.events
    .filter((event) => event.start >= fromBeat && event.start < toBeat)
    .map((event) => ({ ...event, start: event.start - fromBeat }));
  return createPattern(toBeat - fromBeat, events);
}

/** `cycles` repetitions of `base`, with `variant` replacing every last one. */
export function every(
  cycles: number,
  base: Pattern,
  variant: Pattern,
): Pattern {
  if (!Number.isInteger(cycles) || cycles < 2) {
    throw new Error(`every() takes a cycle count ≥ 2, got ${cycles}.`);
  }
  return seq(...Array.from({ length: cycles - 1 }, () => base), variant);
}

/**
 * Swing: delays off-grid positions toward a triplet feel. `amount` 0–1;
 * 1 places offbeat 16ths exactly on the triplet (delay = grid/3).
 */
export function swing(pattern: Pattern, amount: number, grid = 0.25): Pattern {
  if (amount < 0 || amount > 1)
    throw new Error(`swing() amount must be 0–1, got ${amount}.`);
  const events = pattern.events.map((event) => {
    const positionInPair = event.start % (grid * 2);
    const isOffbeat = Math.abs(positionInPair - grid) < grid / 100;
    return isOffbeat
      ? { ...event, start: event.start + (amount * grid) / 3 }
      : { ...event };
  });
  return createPattern(pattern.lengthBeats, events);
}

/** Scales velocities by a factor or maps them with a function. */
export function velocity(
  pattern: Pattern,
  factorOrMap: number | ((event: NoteEvent, index: number) => number),
): Pattern {
  const events = pattern.events.map((event, index) => {
    const raw =
      typeof factorOrMap === "number"
        ? event.velocity * factorOrMap
        : factorOrMap(event, index);
    return { ...event, velocity: clampVelocity(Math.round(raw)) };
  });
  return createPattern(pattern.lengthBeats, events);
}

export interface HumanizeOptions {
  /** Max timing jitter in beats (±). */
  timing?: number;
  /** Max velocity jitter (±). */
  velocity?: number;
  seed?: number;
}

/** Seeded human feel: slight timing and velocity jitter. Deterministic. */
export function humanize(
  pattern: Pattern,
  options: HumanizeOptions = {},
): Pattern {
  const timingJitter = options.timing ?? 0.02;
  const velocityJitter = options.velocity ?? 8;
  const random = createRandom(options.seed ?? 1);
  const events = pattern.events.map((event) => {
    const start = Math.max(0, event.start + (random() * 2 - 1) * timingJitter);
    const jittered =
      event.velocity + Math.round((random() * 2 - 1) * velocityJitter);
    return {
      ...event,
      start: Math.min(start, pattern.lengthBeats - 1e-6),
      velocity: clampVelocity(jittered),
    };
  });
  return createPattern(pattern.lengthBeats, events);
}

export interface VaryOptions {
  seed?: number;
  /** 0–1: how far the variation strays (velocity, micro-timing, dropped notes). */
  amount?: number;
}

/** A seeded variation of a pattern — same musical material, different take. */
export function vary(pattern: Pattern, options: VaryOptions = {}): Pattern {
  const amount = options.amount ?? 0.3;
  if (amount < 0 || amount > 1)
    throw new Error(`vary() amount must be 0–1, got ${amount}.`);
  const random = createRandom(options.seed ?? 1);
  const events: NoteEvent[] = [];
  for (const event of pattern.events) {
    if (random() < 0.12 * amount) continue;
    const start = Math.max(0, event.start + (random() * 2 - 1) * 0.02 * amount);
    const jittered =
      event.velocity + Math.round((random() * 2 - 1) * 16 * amount);
    events.push({
      ...event,
      start: Math.min(start, pattern.lengthBeats - 1e-6),
      velocity: clampVelocity(jittered),
    });
  }
  return createPattern(pattern.lengthBeats, events);
}

function clampVelocity(value: number): number {
  return Math.max(1, Math.min(127, value));
}

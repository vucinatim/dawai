/**
 * Musical time math. All IR time is in beats (quarter-note units are a
 * misconception — a "beat" is one denominator note of the time
 * signature; at [4, 4] a bar is 4 beats, at [7, 8] a bar is 7 beats).
 */

export type TimeSignatureDenominator = 1 | 2 | 4 | 8 | 16;
export type TimeSignature = [
  beatsPerBar: number,
  denominator: TimeSignatureDenominator,
];

export function beatsPerBar(timeSignature: TimeSignature): number {
  return timeSignature[0];
}

export function barsToBeats(
  bars: number,
  timeSignature: TimeSignature,
): number {
  return bars * beatsPerBar(timeSignature);
}

export function beatsToBars(
  beats: number,
  timeSignature: TimeSignature,
): number {
  return beats / beatsPerBar(timeSignature);
}

/**
 * Formats an absolute beat position as "bar.beat" (both 1-based),
 * e.g. beat 0 at 4/4 → "1.1", beat 6.5 → "2.3.5".
 */
export function formatBarBeat(
  beats: number,
  timeSignature: TimeSignature,
): string {
  const perBar = beatsPerBar(timeSignature);
  const bar = Math.floor(beats / perBar) + 1;
  const beatInBar = beats - (bar - 1) * perBar + 1;
  const rounded = Math.round(beatInBar * 1000) / 1000;
  return `${bar}.${rounded}`;
}

/** Parses a "a..b" 1-based bar range (inclusive) into absolute beats. */
export function barRangeToBeats(
  range: string,
  timeSignature: TimeSignature,
): { startBeat: number; endBeat: number } {
  const match = /^(\d+)\.\.(\d+)$/.exec(range.trim());
  if (!match) {
    throw new Error(
      `Invalid bar range "${range}". Expected "<from>..<to>", e.g. "17..25".`,
    );
  }
  const fromBar = Number.parseInt(match[1] as string, 10);
  const toBar = Number.parseInt(match[2] as string, 10);
  if (fromBar < 1 || toBar < fromBar) {
    throw new Error(
      `Invalid bar range "${range}". Bars are 1-based and from ≤ to.`,
    );
  }
  const perBar = beatsPerBar(timeSignature);
  return { startBeat: (fromBar - 1) * perBar, endBeat: toBar * perBar };
}

import { noteNameToMidi } from "@dawai/core/notes";

/**
 * Chord-name parsing: "Am7", "Cmaj9", "F#sus4" → MIDI pitches in closed
 * root position at a given octave.
 */

const QUALITY_INTERVALS: Record<string, number[]> = {
  "": [0, 4, 7],
  m: [0, 3, 7],
  "7": [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  "9": [0, 4, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  "6": [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  add9: [0, 4, 7, 14],
};

const CHORD_PATTERN = /^([A-G][#b]?)(.*)$/;

export function chordToPitches(name: string, octave: number): number[] {
  const match = CHORD_PATTERN.exec(name.trim());
  if (!match) {
    throw new Error(
      `Invalid chord name "${name}". Expected root + quality, e.g. "Am7", "Cmaj9".`,
    );
  }
  const [, root, quality] = match;
  const intervals = QUALITY_INTERVALS[quality as string];
  if (!intervals) {
    const known = Object.keys(QUALITY_INTERVALS)
      .map((key) => (key === "" ? "(major)" : key))
      .join(", ");
    throw new Error(
      `Unknown chord quality "${quality}" in "${name}". Supported: ${known}.`,
    );
  }
  const rootPitch = noteNameToMidi(`${root}${octave}`);
  return intervals.map((interval) => {
    const pitch = rootPitch + interval;
    if (pitch < 0 || pitch > 127) {
      throw new Error(
        `Chord "${name}" at octave ${octave} reaches MIDI pitch ${pitch}, outside 0–127. Lower the octave.`,
      );
    }
    return pitch;
  });
}

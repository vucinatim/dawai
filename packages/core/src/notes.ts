/**
 * Note-name ↔ MIDI conversions. Note names use scientific pitch
 * notation with middle C = C4 = MIDI 60 (so C-1 = 0, G9 = 127).
 */

const LETTER_SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const SHARP_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

const NOTE_NAME_PATTERN = /^([A-Ga-g])([#b]?)(-?\d{1,2})$/;

export function noteNameToMidi(name: string): number {
  const match = NOTE_NAME_PATTERN.exec(name.trim());
  if (!match) {
    throw new Error(
      `Invalid note name "${name}". Expected letter + optional #/b + octave, e.g. "C4", "F#2", "Bb-1".`,
    );
  }
  const [, letter, accidental, octaveText] = match;
  const base = LETTER_SEMITONES[(letter as string).toUpperCase()];
  if (base === undefined) throw new Error(`Invalid note letter in "${name}".`);
  const accidentalOffset = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  const octave = Number.parseInt(octaveText as string, 10);
  const midi = (octave + 1) * 12 + base + accidentalOffset;
  if (midi < 0 || midi > 127) {
    throw new Error(
      `Note "${name}" is MIDI ${midi}, outside the valid range 0–127 (C-1 to G9).`,
    );
  }
  return midi;
}

export function midiToNoteName(midi: number): string {
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) {
    throw new Error(`MIDI pitch ${midi} is outside the valid range 0–127.`);
  }
  const octave = Math.floor(midi / 12) - 1;
  return `${SHARP_NAMES[midi % 12]}${octave}`;
}

/** Accepts either a MIDI number (validated) or a note name. */
export function resolvePitch(pitch: number | string): number {
  if (typeof pitch === "string") return noteNameToMidi(pitch);
  if (!Number.isInteger(pitch) || pitch < 0 || pitch > 127) {
    throw new Error(`MIDI pitch ${pitch} is outside the valid range 0–127.`);
  }
  return pitch;
}

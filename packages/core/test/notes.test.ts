import { describe, expect, test } from "bun:test";
import {
  midiToNoteName,
  noteNameToMidi,
  resolvePitch,
} from "@dawai/core/notes";

describe("noteNameToMidi", () => {
  test("middle C is 60", () => {
    expect(noteNameToMidi("C4")).toBe(60);
  });

  test("accidentals", () => {
    expect(noteNameToMidi("F#2")).toBe(42);
    expect(noteNameToMidi("Bb3")).toBe(58);
    expect(noteNameToMidi("Gb4")).toBe(noteNameToMidi("F#4"));
  });

  test("range extremes", () => {
    expect(noteNameToMidi("C-1")).toBe(0);
    expect(noteNameToMidi("G9")).toBe(127);
  });

  test("lowercase letters accepted", () => {
    expect(noteNameToMidi("e1")).toBe(28);
  });

  test("rejects malformed names", () => {
    expect(() => noteNameToMidi("H2")).toThrow('Invalid note name "H2"');
    expect(() => noteNameToMidi("C")).toThrow("Invalid note name");
  });

  test("rejects out-of-range notes", () => {
    expect(() => noteNameToMidi("A9")).toThrow("outside the valid range");
  });
});

describe("midiToNoteName", () => {
  test("round-trips every MIDI pitch", () => {
    for (let midi = 0; midi <= 127; midi++) {
      expect(noteNameToMidi(midiToNoteName(midi))).toBe(midi);
    }
  });

  test("rejects invalid pitches", () => {
    expect(() => midiToNoteName(128)).toThrow("outside the valid range");
    expect(() => midiToNoteName(3.5)).toThrow("outside the valid range");
  });
});

describe("resolvePitch", () => {
  test("passes numbers through, resolves names", () => {
    expect(resolvePitch(36)).toBe(36);
    expect(resolvePitch("C2")).toBe(36);
  });

  test("rejects non-integer and out-of-range numbers", () => {
    expect(() => resolvePitch(60.5)).toThrow("outside the valid range");
    expect(() => resolvePitch(200)).toThrow("outside the valid range");
  });
});

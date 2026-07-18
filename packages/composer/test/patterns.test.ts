import { describe, expect, test } from "bun:test";
import {
  arp,
  chords,
  euclid,
  melody,
  notes,
  steps,
} from "@dawai/composer/builders";
import {
  every,
  humanize,
  repeat,
  seq,
  slice,
  stack,
  swing,
  transpose,
  vary,
  velocity,
} from "@dawai/composer/combinators";

describe("notes", () => {
  test("accepts note names and infers length", () => {
    const pattern = notes([
      [0, "C2", 0.5, 100],
      [3.5, 38, 1, 90],
    ]);
    expect(pattern.events).toEqual([
      { start: 0, pitch: 36, length: 0.5, velocity: 100 },
      { start: 3.5, pitch: 38, length: 1, velocity: 90 },
    ]);
    expect(pattern.lengthBeats).toBe(5);
  });

  test("rejects notes starting outside an explicit length", () => {
    expect(() => notes([[4, 60, 1, 100]], 4)).toThrow("outside its pattern");
  });
});

describe("steps", () => {
  test("parses hits, accents, ghosts, rests; ignores separators", () => {
    const pattern = steps("x.o. | X...", 36);
    expect(pattern.lengthBeats).toBe(2);
    expect(pattern.events).toEqual([
      { start: 0, pitch: 36, length: 0.25, velocity: 100 },
      { start: 0.5, pitch: 36, length: 0.25, velocity: 55 },
      { start: 1, pitch: 36, length: 0.25, velocity: 118 },
    ]);
  });

  test("rejects unknown characters with the alphabet in the message", () => {
    expect(() => steps("x.q.", 36)).toThrow('Invalid step character "q"');
  });
});

describe("chords", () => {
  test("builds a progression of block chords", () => {
    const pattern = chords(["Am", "F"], { beats: 4, octave: 3 });
    expect(pattern.lengthBeats).toBe(8);
    expect(
      pattern.events
        .filter((event) => event.start === 0)
        .map((event) => event.pitch),
    ).toEqual([57, 60, 64]);
    expect(
      pattern.events
        .filter((event) => event.start === 4)
        .map((event) => event.pitch),
    ).toEqual([53, 57, 60]);
  });

  test("rejects unknown qualities and lists the supported ones", () => {
    expect(() => chords(["Cwat"])).toThrow("Unknown chord quality");
  });

  test("rejects out-of-range octaves with a musical message", () => {
    expect(() => chords(["Gmaj7"], { octave: 9 })).toThrow("Lower the octave");
  });
});

describe("melody", () => {
  test("ties extend, dots rest", () => {
    const pattern = melody("E3 ~ . G3", { step: 0.5 });
    expect(pattern.lengthBeats).toBe(2);
    expect(pattern.events).toEqual([
      { start: 0, pitch: 52, length: 1, velocity: 96 },
      { start: 1.5, pitch: 55, length: 0.5, velocity: 96 },
    ]);
  });

  test("rejects a leading tie", () => {
    expect(() => melody("~ E3")).toThrow("must directly follow a note");
  });

  test("rejects a tie across a rest", () => {
    expect(() => melody("E3 . ~ G3")).toThrow("cannot extend across a rest");
  });
});

describe("arp", () => {
  test("updown does not repeat the turnaround notes", () => {
    const pattern = arp("Am", { style: "updown", step: 0.25 });
    expect(pattern.events.map((event) => event.pitch)).toEqual([
      57, 60, 64, 60,
    ]);
    expect(pattern.lengthBeats).toBe(1);
  });

  test("spreads octaves", () => {
    const pattern = arp(["A2"], { octaves: 2 });
    expect(pattern.events.map((event) => event.pitch)).toEqual([45, 57]);
  });

  test("voices chord-name arps at a chosen base octave", () => {
    const low = arp("Am", { octave: 2 });
    const default3 = arp("Am");
    expect(low.events.map((event) => event.pitch)).toEqual(
      default3.events.map((event) => event.pitch - 12),
    );
  });
});

describe("euclid", () => {
  test("E(3,8) is the tresillo", () => {
    const pattern = euclid(3, 8, 36);
    expect(pattern.events.map((event) => event.start)).toEqual([0, 0.75, 1.5]);
  });

  test("rejects more hits than steps", () => {
    expect(() => euclid(9, 8, 36)).toThrow("more hits than steps");
  });
});

describe("combinators", () => {
  const kick = steps("x...", 36);
  const snare = steps("..x.", 38);

  test("seq concatenates, stack layers", () => {
    expect(seq(kick, snare).lengthBeats).toBe(2);
    expect(seq(kick, snare).events.map((event) => event.start)).toEqual([
      0, 1.5,
    ]);
    expect(stack(kick, snare).lengthBeats).toBe(1);
    expect(stack(kick, snare).events).toHaveLength(2);
  });

  test("repeat tiles a pattern", () => {
    const pattern = repeat(kick, 4);
    expect(pattern.lengthBeats).toBe(4);
    expect(pattern.events.map((event) => event.start)).toEqual([0, 1, 2, 3]);
  });

  test("transpose shifts pitch and fails fast out of range", () => {
    expect(transpose(kick, 12).events[0]?.pitch).toBe(48);
    expect(() => transpose(kick, 120)).toThrow("outside MIDI range");
  });

  test("slice cuts a window and re-anchors it", () => {
    const pattern = slice(seq(kick, snare), 1, 2);
    expect(pattern.lengthBeats).toBe(1);
    expect(pattern.events.map((event) => event.start)).toEqual([0.5]);
  });

  test("slice rejects windows beyond the pattern", () => {
    expect(() => slice(kick, 0, 8)).toThrow("beyond the pattern");
  });

  test("every replaces the last cycle", () => {
    const pattern = every(4, kick, snare);
    expect(pattern.lengthBeats).toBe(4);
    expect(pattern.events.map((event) => event.pitch)).toEqual([
      36, 36, 36, 38,
    ]);
  });

  test("swing delays only offbeat grid positions", () => {
    const straight = steps("xx", 42);
    const swung = swing(straight, 1);
    expect(swung.events[0]?.start).toBe(0);
    expect(swung.events[1]?.start).toBeCloseTo(0.25 + 0.25 / 3, 6);
  });

  test("velocity scales and clamps", () => {
    expect(velocity(kick, 2).events[0]?.velocity).toBe(127);
    expect(velocity(kick, 0.001).events[0]?.velocity).toBe(1);
  });

  test("humanize is deterministic per seed", () => {
    const pattern = repeat(kick, 8);
    expect(humanize(pattern, { seed: 7 }).events).toEqual(
      humanize(pattern, { seed: 7 }).events,
    );
    expect(humanize(pattern, { seed: 7 }).events).not.toEqual(
      humanize(pattern, { seed: 8 }).events,
    );
  });

  test("vary is deterministic per seed and can drop notes", () => {
    const pattern = repeat(steps("xxxx xxxx xxxx xxxx", 42), 8);
    const varied = vary(pattern, { seed: 3, amount: 1 });
    expect(varied.events).toEqual(vary(pattern, { seed: 3, amount: 1 }).events);
    expect(varied.events.length).toBeLessThan(pattern.events.length);
  });
});

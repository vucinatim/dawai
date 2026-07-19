import { describe, expect, test } from "bun:test";
import { automate, ramp } from "@dawai/composer/automation";
import { notes, steps } from "@dawai/composer/builders";
import { CompileError, compile } from "@dawai/composer/compile";
import { filter, limiter } from "@dawai/composer/fx";
import { kit, sampler, synth } from "@dawai/composer/instruments";
import { section } from "@dawai/composer/section";
import { bus, duck, song, track } from "@dawai/composer/song";

const drumPattern = () => steps("x...x...", 36);

function minimalSong() {
  return song({
    name: "Mini",
    tempo: 174,
    tracks: [track("drums", sampler(kit("dnb-standard")))],
    arrangement: [section("intro", 2, { drums: drumPattern() })],
  });
}

describe("compile", () => {
  test("produces a valid document with section markers", () => {
    const document = compile(minimalSong());
    expect(document.name).toBe("Mini");
    expect(document.sections).toEqual([{ name: "intro", start: 0, length: 8 }]);
    expect(document.tracks[0]?.clips).toHaveLength(1);
  });

  test("is deterministic: same spec compiles to an identical document", () => {
    const first = compile(minimalSong());
    const second = compile(minimalSong());
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  test("tiles short patterns to fill their section", () => {
    const document = compile(minimalSong());
    const clip = document.tracks[0]?.clips[0];
    expect(clip?.length).toBe(8);
    expect(clip?.notes.map((note) => note[0])).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
  });

  test("appends a master limiter when the chain lacks one", () => {
    const document = compile(minimalSong());
    expect(document.master.fx.at(-1)).toEqual({ type: "limiter", ceiling: -1 });
  });

  test("respects an explicit master limiter", () => {
    const spec = song({
      name: "Mini",
      tempo: 174,
      tracks: [track("drums", sampler("dnb-standard"))],
      master: [limiter(-0.5)],
      arrangement: [section("intro", 1, { drums: drumPattern() })],
    });
    expect(compile(spec).master.fx).toEqual([
      { type: "limiter", ceiling: -0.5 },
    ]);
  });

  test("suffixes clip ids when a section name repeats", () => {
    const intro = section("intro", 1, { drums: drumPattern() });
    const spec = song({
      name: "Mini",
      tempo: 174,
      tracks: [track("drums", sampler("dnb-standard"))],
      arrangement: [intro, intro],
    });
    const clipIds = compile(spec).tracks[0]?.clips.map((clip) => clip.id);
    expect(clipIds).toEqual(["intro:drums", "intro#2:drums"]);
  });

  test("places track-level clips at 1-based bars", () => {
    const spec = song({
      name: "Mini",
      tempo: 120,
      tracks: [
        track("bass", synth("sub-sine"), {
          clips: [notes([[0, "A1", 1, 100]]).at(3)],
        }),
      ],
    });
    const clip = compile(spec).tracks[0]?.clips[0];
    expect(clip?.start).toBe(8);
    expect(clip?.id).toBe("bass@3");
  });

  test("rejects sections that write to unknown tracks, naming the known ones", () => {
    const spec = song({
      name: "Mini",
      tempo: 174,
      tracks: [track("drums", sampler("dnb-standard"))],
      arrangement: [section("intro", 1, { bass: drumPattern() })],
    });
    expect(() => compile(spec)).toThrow(CompileError);
    expect(() => compile(spec)).toThrow(
      'unknown track "bass". Known tracks: drums',
    );
  });

  test("resolves fx automation by type name to a canonical index path", () => {
    const spec = song({
      name: "Mini",
      tempo: 174,
      tracks: [
        track("reese", synth("reese"), { fx: [filter("lowpass", 900)] }),
      ],
      arrangement: [
        section(
          "build",
          2,
          { reese: notes([[0, "E1", 8, 100]]) },
          {
            automation: [
              automate("reese.fx.filter.cutoff", ramp(8, 400, 8000, "exp")),
            ],
          },
        ),
      ],
    });
    const lane = compile(spec).automation[0];
    expect(lane?.target).toEqual({
      owner: { type: "track", id: "reese" },
      path: "fx.0.cutoff",
    });
    expect(lane?.points).toEqual([
      { beat: 0, value: 400, curve: "step" },
      { beat: 8, value: 8000, curve: "exp" },
    ]);
  });

  test("offsets section automation by the section start", () => {
    const spec = song({
      name: "Mini",
      tempo: 174,
      tracks: [track("pads", synth("warm-pad"))],
      arrangement: [
        section("intro", 2, { pads: notes([[0, "C3", 8, 90]]) }),
        section(
          "build",
          2,
          { pads: notes([[0, "C3", 8, 90]]) },
          {
            automation: [automate("pads.gain", ramp(8, -12, 0))],
          },
        ),
      ],
    });
    const lane = compile(spec).automation[0];
    expect(lane?.points.map((point) => point.beat)).toEqual([8, 16]);
  });

  test("rejects automation of unknown fx, listing the chain", () => {
    const spec = song({
      name: "Mini",
      tempo: 174,
      tracks: [track("reese", synth("reese"))],
      arrangement: [
        section(
          "build",
          1,
          { reese: notes([[0, "E1", 4, 100]]) },
          {
            automation: [automate("reese.fx.reverb.mix", ramp(4, 0, 1))],
          },
        ),
      ],
    });
    expect(() => compile(spec)).toThrow('no fx "reverb"');
  });

  test("merges lanes that target the same param", () => {
    const spec = song({
      name: "Mini",
      tempo: 174,
      tracks: [track("pads", synth("warm-pad"))],
      arrangement: [
        section(
          "a",
          1,
          { pads: notes([[0, "C3", 4, 90]]) },
          {
            automation: [automate("pads.gain", ramp(4, -12, 0))],
          },
        ),
        section(
          "b",
          1,
          { pads: notes([[0, "C3", 4, 90]]) },
          {
            automation: [automate("pads.gain", ramp(4, 0, -12))],
          },
        ),
      ],
    });
    const document = compile(spec);
    expect(document.automation).toHaveLength(1);
    expect(document.automation[0]?.points.map((point) => point.beat)).toEqual([
      0, 4, 4, 8,
    ]);
  });
});

describe("part-level automation (self targets)", () => {
  test("riser() resolves self targets to its own track", async () => {
    const { riser } = await import("@dawai/composer/idioms");
    const spec = song({
      name: "Rise",
      tempo: 174,
      tracks: [
        track("fx", synth("riser-noise"), {
          fx: [filter("bandpass", 500, 1.5)],
        }),
      ],
      arrangement: [section("build", 2, { fx: riser(8) })],
    });
    const document = compile(spec);
    const cutoffLane = document.automation.find(
      (lane) => lane.target.path === "fx.0.cutoff",
    );
    expect(cutoffLane?.target.owner).toEqual({ type: "track", id: "fx" });
    expect(cutoffLane?.points.map((point) => point.value)).toEqual([
      300, 12000,
    ]);
    const gainLane = document.automation.find(
      (lane) => lane.target.path === "gain",
    );
    expect(gainLane?.target.owner).toEqual({ type: "track", id: "fx" });
  });

  test("impact() hits the kit's impact pad", async () => {
    const { impact } = await import("@dawai/composer/idioms");
    const pattern = impact(kit("dnb-standard"));
    expect(pattern.events[0]?.pitch).toBe(24);
    expect(pattern.events[0]?.velocity).toBe(127);
  });
});

describe("duck compilation", () => {
  test("compiles a known kick pattern to the exact duck curve", () => {
    const spec = song({
      name: "Pump",
      tempo: 174,
      tracks: [
        track("drums", sampler(kit("dnb-standard"))),
        track("sub", synth("sub-sine"), {
          duck: duck({ trigger: "drums:kick", amount: -6, release: 0.5 }),
        }),
      ],
      arrangement: [
        section("drop", 1, {
          drums: steps("x...x...........", 36),
          sub: notes([[0, "A1", 4, 100]]),
        }),
      ],
    });
    const lane = compile(spec).automation.find(
      (candidate) => candidate.target.path === "duck",
    );
    expect(lane?.target.owner).toEqual({ type: "track", id: "sub" });
    expect(lane?.points).toEqual([
      { beat: 0, value: 0, curve: "linear" },
      { beat: 0, value: -6, curve: "step" },
      { beat: 0.5, value: 0, curve: "linear" },
      { beat: 1, value: -6, curve: "step" },
      { beat: 1.5, value: 0, curve: "linear" },
    ]);
  });

  test("truncates the release when triggers overlap", () => {
    const spec = song({
      name: "Pump",
      tempo: 174,
      tracks: [
        track("drums", sampler("dnb-standard")),
        track("sub", synth("sub-sine"), {
          duck: duck({ trigger: "drums:kick", amount: -8, release: 1 }),
        }),
      ],
      arrangement: [
        section("drop", 1, {
          drums: steps("x.x.............", 36),
          sub: notes([[0, "A1", 4, 100]]),
        }),
      ],
    });
    const lane = compile(spec).automation.find(
      (candidate) => candidate.target.path === "duck",
    );
    expect(lane?.points).toEqual([
      { beat: 0, value: 0, curve: "linear" },
      { beat: 0, value: -8, curve: "step" },
      { beat: 0.5, value: -4, curve: "linear" },
      { beat: 0.5, value: -8, curve: "step" },
      { beat: 1.5, value: 0, curve: "linear" },
    ]);
  });

  test("supports bus ducking", () => {
    const spec = song({
      name: "Pump",
      tempo: 174,
      tracks: [
        track("drums", sampler("dnb-standard")),
        track("pads", synth("warm-pad"), { out: "music" }),
      ],
      buses: { music: bus({ duck: duck({ trigger: "drums:kick" }) }) },
      arrangement: [
        section("drop", 1, {
          drums: steps("x...", 36),
          pads: notes([[0, "C3", 4, 90]]),
        }),
      ],
    });
    const lane = compile(spec).automation.find(
      (candidate) => candidate.target.path === "duck",
    );
    expect(lane?.target.owner).toEqual({ type: "bus", id: "music" });
  });

  test("fails fast when the trigger matches nothing", () => {
    const spec = song({
      name: "Pump",
      tempo: 174,
      tracks: [
        track("drums", sampler("dnb-standard")),
        track("sub", synth("sub-sine"), {
          duck: duck({ trigger: "drums:crash" }),
        }),
      ],
      arrangement: [
        section("drop", 1, {
          drums: steps("x...", 36),
          sub: notes([[0, "A1", 4, 100]]),
        }),
      ],
    });
    expect(() => compile(spec)).toThrow("matched no notes");
  });

  test("rejects unknown pads and lists the kit's pads", () => {
    const spec = song({
      name: "Pump",
      tempo: 174,
      tracks: [
        track("drums", sampler("dnb-standard")),
        track("sub", synth("sub-sine"), {
          duck: duck({ trigger: "drums:kik" }),
        }),
      ],
      arrangement: [
        section("drop", 1, {
          drums: steps("x...", 36),
          sub: notes([[0, "A1", 4, 100]]),
        }),
      ],
    });
    expect(() => compile(spec)).toThrow('no pad "kik"');
  });
});

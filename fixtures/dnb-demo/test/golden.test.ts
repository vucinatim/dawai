import { describe, expect, test } from "bun:test";
import { compile } from "@dawai/composer/compile";
import { renderArrangement } from "@dawai/core/views/arrangement";
import { renderMix } from "@dawai/core/views/mix";
import { renderStats } from "@dawai/core/views/statsView";
import { renderTrackDetail } from "@dawai/core/views/trackDetail";
import demoSong from "../song.ts";

/**
 * Golden gates for the primary fixture: the demo song must compile
 * deterministically, and its Document + every inspect view are pinned
 * as snapshots. A diff here means the compiler's output changed —
 * intentional changes update the snapshot, unintentional ones are bugs.
 */

describe("dnb-demo golden", () => {
  test("compiles deterministically: two compiles are byte-identical", () => {
    expect(JSON.stringify(compile(demoSong))).toBe(
      JSON.stringify(compile(demoSong)),
    );
  });

  test("document snapshot", () => {
    expect(compile(demoSong)).toMatchSnapshot();
  });

  test("arrangement view snapshot", () => {
    expect(renderArrangement(compile(demoSong))).toMatchSnapshot();
  });

  test("track detail view snapshot (sub, drop bars)", () => {
    const document = compile(demoSong);
    expect(
      renderTrackDetail(document, "sub", { startBeat: 128, endBeat: 160 }),
    ).toMatchSnapshot();
  });

  test("mix view snapshot", () => {
    expect(renderMix(compile(demoSong))).toMatchSnapshot();
  });

  test("stats view snapshot", () => {
    expect(renderStats(compile(demoSong))).toMatchSnapshot();
  });

  test("song structure sanity", () => {
    const document = compile(demoSong);
    expect(document.sections.map((section) => section.name)).toEqual([
      "intro",
      "buildup",
      "drop",
      "breakdown",
      "buildup",
      "drop",
      "outro",
    ]);
    expect(document.tracks).toHaveLength(6);
    expect(document.buses.map((bus) => bus.id)).toEqual(["drumbus", "music"]);
    expect(document.automation.length).toBeGreaterThanOrEqual(4);
    const lengthBeats = 136 * 4;
    const minutes = lengthBeats / document.tempo;
    expect(minutes).toBeGreaterThan(3);
  });
});

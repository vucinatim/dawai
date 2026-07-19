import { describe, expect, test } from "bun:test";
import { SYNTH_PRESETS } from "@dawai/core/presets";
import { resolveVoice, voiceDefinitionSchema } from "@dawai/core/voice";

describe("voice schema v2", () => {
  test("every built-in preset is a valid voice definition", () => {
    for (const [id, voice] of Object.entries(SYNTH_PRESETS)) {
      const parsed = voiceDefinitionSchema.safeParse(voice);
      expect(
        parsed.success,
        `preset ${id} invalid: ${parsed.error?.message}`,
      ).toBe(true);
    }
  });

  test("filter movement exists where the sprint promises it", () => {
    for (const id of ["reese", "warm-pad", "pluck", "supersaw"] as const) {
      expect(SYNTH_PRESETS[id].filterEnvelope.octaves).toBeGreaterThan(1);
    }
  });

  test("resolveVoice applies dotted-path overrides immutably", () => {
    const base = SYNTH_PRESETS.reese;
    const resolved = resolveVoice(base, {
      "filter.cutoff": 400,
      "filterEnvelope.octaves": 4,
    });
    expect(resolved.filter.cutoff).toBe(400);
    expect(resolved.filterEnvelope.octaves).toBe(4);
    expect(base.filter.cutoff).not.toBe(400);
  });

  test("resolveVoice rejects unknown paths and lists the real ones", () => {
    expect(() =>
      resolveVoice(SYNTH_PRESETS.reese, { "filter.wat": 1 }),
    ).toThrow('Unknown voice param "filter.wat"');
  });

  test("resolveVoice rejects overrides that break the schema", () => {
    expect(() =>
      resolveVoice(SYNTH_PRESETS.reese, { "filter.cutoff": -5 }),
    ).toThrow();
  });
});

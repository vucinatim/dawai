import type { Instrument } from "@dawai/core/document";
import { KITS, type KitId, kitPad } from "@dawai/core/kits";
import type { SynthPresetId } from "@dawai/core/presets";
import { type StepsOptions, steps } from "./builders.ts";
import { stack } from "./combinators.ts";
import type { Pattern } from "./pattern.ts";

/** Instrument constructors — thin, validated fronts over the IR shapes. */

export function synth(
  preset: SynthPresetId,
  params: Record<string, number> = {},
): Instrument {
  return { kind: "synth", preset, params };
}

export interface Kit {
  id: KitId;
}

export function kit(id: KitId): Kit {
  if (!(id in KITS)) {
    throw new Error(
      `Unknown kit "${id}". Available kits: ${Object.keys(KITS).join(", ")}.`,
    );
  }
  return { id };
}

export function sampler(kitReference: Kit | KitId): Instrument {
  const id =
    typeof kitReference === "string" ? kit(kitReference).id : kitReference.id;
  return { kind: "sampler", kit: id };
}

/** An audio file as an instrument; a note at pitch C4 plays it at its original rate. */
export function sample(source: string): Instrument {
  if (source.trim() === "")
    throw new Error("sample() needs a source id or file path.");
  return { kind: "sample", source, stretch: "repitch" };
}

/**
 * Drum programming against a kit's pad names — one step grid per pad:
 *   drums(kit("dnb-standard"), { kick: "x.....x.", snare: "....x..." })
 */
export function drums(
  kitReference: Kit,
  grids: Record<string, string>,
  options: StepsOptions = {},
): Pattern {
  const padNames = Object.keys(grids);
  if (padNames.length === 0)
    throw new Error("drums() needs at least one pad grid.");
  return stack(
    ...padNames.map((padName) =>
      steps(
        grids[padName] as string,
        kitPad(kitReference.id, padName).pitch,
        options,
      ),
    ),
  );
}

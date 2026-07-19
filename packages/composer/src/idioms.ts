import { kitPad } from "@dawai/core/kits";
import { automate, ramp } from "./automation.ts";
import { notes } from "./builders.ts";
import type { Kit } from "./instruments.ts";
import type { Pattern } from "./pattern.ts";
import type { PartWithAutomation } from "./section.ts";

/**
 * Transition idioms — the craft that makes an arrangement feel
 * produced, as self-contained one-liner parts. riser()/sweep() target
 * `self.…`, so their track must have a filter as its first fx:
 *   track("fx", synth("riser-noise"), { fx: [filter("bandpass", 500, 1.5)] })
 */

export interface RiserOptions {
  /** Filter sweep range in Hz. */
  from?: number;
  to?: number;
  /** Gain ride in dB. */
  gainFrom?: number;
  gainTo?: number;
  pitch?: number | string;
  /**
   * Total pattern length in beats (defaults to the effect length).
   * Set to the section length to prevent tiling — one riser per
   * section, not one per repeat.
   */
  holdBeats?: number;
}

/** A rising tension build: place at the end of the section before a drop. */
export function riser(
  lengthBeats: number,
  options: RiserOptions = {},
): PartWithAutomation {
  const pitch = options.pitch ?? "C4";
  return {
    pattern: notes(
      [[0, pitch, lengthBeats, 100]],
      options.holdBeats ?? lengthBeats,
    ),
    automation: [
      automate(
        "self.fx.0.cutoff",
        ramp(lengthBeats, options.from ?? 300, options.to ?? 12000, "exp"),
      ),
      automate(
        "self.gain",
        ramp(lengthBeats, options.gainFrom ?? -22, options.gainTo ?? -8),
      ),
    ],
  };
}

/** A falling release: place right after a drop hits. */
export function sweep(
  lengthBeats: number,
  options: RiserOptions = {},
): PartWithAutomation {
  const pitch = options.pitch ?? "C5";
  return {
    pattern: notes(
      [[0, pitch, lengthBeats, 90]],
      options.holdBeats ?? lengthBeats,
    ),
    automation: [
      automate(
        "self.fx.0.cutoff",
        ramp(lengthBeats, options.from ?? 9000, options.to ?? 250, "exp"),
      ),
      automate(
        "self.gain",
        ramp(lengthBeats, options.gainFrom ?? -10, options.gainTo ?? -26),
      ),
    ],
  };
}

/** A cinematic downbeat boom on a sampler track (the kit's impact pad). */
export function impact(
  kitReference: Kit,
  options: { holdBeats?: number } = {},
): Pattern {
  const pitch = kitPad(kitReference.id, "impact").pitch;
  return notes([[0, pitch, 4, 127]], options.holdBeats ?? 4);
}

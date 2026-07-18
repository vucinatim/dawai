import type { TimeSignature } from "@dawai/core/time";
import { barsToBeats } from "@dawai/core/time";

/**
 * Automation authoring. Targets are written as readable dotted paths
 * ("reese.fx.filter.cutoff", "bus.drumbus.gain", "master.fx.limiter.ceiling")
 * and resolved to canonical IR targets at compile time.
 */

/** A duration in bars, resolved against the song's time signature at compile. */
export interface BarsDuration {
  readonly kind: "bars";
  readonly bars: number;
}

export function bars(count: number): BarsDuration {
  if (!Number.isFinite(count) || count <= 0) {
    throw new Error(`bars() takes a positive number of bars, got ${count}.`);
  }
  return { kind: "bars", bars: count };
}

export type Duration = number | BarsDuration;

export function resolveDuration(
  duration: Duration,
  timeSignature: TimeSignature,
): number {
  return typeof duration === "number"
    ? duration
    : barsToBeats(duration.bars, timeSignature);
}

export type Curve = "linear" | "exp" | "step";

export interface AutomationPointInput {
  /** Beats (or bars()) relative to where the automation is placed. */
  at: Duration;
  value: number;
  curve?: Curve;
}

export interface AutomationSpec {
  readonly targetText: string;
  readonly points: AutomationPointInput[];
}

/**
 * A single ramp from → to over a duration. The first point is a "step"
 * so a placed ramp holds whatever value preceded it until it starts,
 * instead of interpolating backwards across the gap.
 */
export function ramp(
  length: Duration,
  from: number,
  to: number,
  curve: Curve = "linear",
): AutomationPointInput[] {
  return [
    { at: 0, value: from, curve: "step" },
    { at: length, value: to, curve },
  ];
}

export function automate(
  target: string,
  points: AutomationPointInput[],
): AutomationSpec {
  if (points.length === 0) {
    throw new Error(
      `automate("${target}") needs at least one point — use ramp() or [{ at, value }].`,
    );
  }
  return { targetText: target, points };
}

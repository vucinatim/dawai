import type { Fx } from "@dawai/core/document";

/**
 * Fx constructors. The IR carries every param explicitly; these fill
 * musical defaults so authors write only what they mean to change.
 */

export function filter(
  mode: "lowpass" | "highpass" | "bandpass",
  cutoff: number,
  q = 1,
): Fx {
  return { type: "filter", mode, cutoff, q };
}

export function eq(bands: { low?: number; mid?: number; high?: number }): Fx {
  return {
    type: "eq",
    low: bands.low ?? 0,
    mid: bands.mid ?? 0,
    high: bands.high ?? 0,
  };
}

export function compressor(
  options: {
    threshold?: number;
    ratio?: number;
    attack?: number;
    release?: number;
    knee?: number;
  } = {},
): Fx {
  return {
    type: "compressor",
    threshold: options.threshold ?? -24,
    ratio: options.ratio ?? 4,
    attack: options.attack ?? 0.01,
    release: options.release ?? 0.25,
    knee: options.knee ?? 6,
  };
}

export function distortion(amount: number): Fx {
  return { type: "distortion", amount };
}

export function chorus(
  options: { rate?: number; depth?: number; mix?: number } = {},
): Fx {
  return {
    type: "chorus",
    rate: options.rate ?? 1.5,
    depth: options.depth ?? 0.5,
    mix: options.mix ?? 0.3,
  };
}

/** reverb(0.4) sets the mix; pass an object for decay/predelay control. */
export function reverb(
  mixOrOptions: number | { decay?: number; predelay?: number; mix?: number },
): Fx {
  const options =
    typeof mixOrOptions === "number" ? { mix: mixOrOptions } : mixOrOptions;
  return {
    type: "reverb",
    decay: options.decay ?? 4,
    predelay: options.predelay ?? 0.02,
    mix: options.mix ?? 0.3,
  };
}

export function delay(
  options: { time?: number; feedback?: number; mix?: number } = {},
): Fx {
  return {
    type: "delay",
    time: options.time ?? 0.75,
    feedback: options.feedback ?? 0.35,
    mix: options.mix ?? 0.25,
  };
}

export function limiter(ceiling = -1): Fx {
  return { type: "limiter", ceiling };
}

/** OTT-style multiband squash — the modern electronic glue. */
export function ott(options: { amount?: number; gain?: number } = {}): Fx {
  return {
    type: "ott",
    amount: options.amount ?? 0.5,
    gain: options.gain ?? 2,
  };
}

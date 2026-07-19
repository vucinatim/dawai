import type { Fx, Instrument } from "@dawai/core/document";
import type { TimeSignature } from "@dawai/core/time";
import type { AutomationSpec } from "./automation.ts";
import type { Placement } from "./pattern.ts";
import type { Section } from "./section.ts";

/** Song-level authoring types: track(), bus(), duck(), song(). */

const ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

function assertId(id: string, what: string): void {
  if (!ID_PATTERN.test(id)) {
    throw new Error(
      `Invalid ${what} id "${id}". Ids start with a letter and use letters, digits, "-", "_" (they appear in automation paths and duck triggers).`,
    );
  }
}

export interface DuckSpec {
  /** "trackId", "trackId:padName" (sampler pads) or "trackId:C2" (pitch). */
  readonly trigger: string;
  /** Gain offset at the trigger, in dB (negative). */
  readonly amount: number;
  /** Recovery time in beats. */
  readonly release: number;
}

export function duck(options: {
  trigger: string;
  amount?: number;
  release?: number;
}): DuckSpec {
  // Defaults tuned so the pump is plainly audible out of the box.
  const amount = options.amount ?? -9;
  const release = options.release ?? 0.4;
  if (amount >= 0)
    throw new Error(`duck() amount is a negative dB offset, got ${amount}.`);
  if (release <= 0)
    throw new Error(`duck() release must be positive beats, got ${release}.`);
  return { trigger: options.trigger, amount, release };
}

export interface TrackOptions {
  name?: string;
  gain?: number;
  pan?: number;
  mute?: boolean;
  /** "master" (default) or a bus id. */
  out?: string;
  fx?: Fx[];
  duck?: DuckSpec;
  /** Absolute placements — the floor below the section model. */
  clips?: Placement[];
}

export interface TrackSpec {
  readonly id: string;
  readonly name: string;
  readonly instrument: Instrument;
  readonly gain: number;
  readonly pan: number;
  readonly mute: boolean;
  readonly out: string;
  readonly fx: Fx[];
  readonly duck: DuckSpec | undefined;
  readonly placements: Placement[];
}

export function track(
  id: string,
  instrument: Instrument,
  options: TrackOptions = {},
): TrackSpec {
  assertId(id, "track");
  return {
    id,
    name: options.name ?? id,
    instrument,
    gain: options.gain ?? 0,
    pan: options.pan ?? 0,
    mute: options.mute ?? false,
    out: options.out ?? "master",
    fx: options.fx ?? [],
    duck: options.duck,
    placements: options.clips ?? [],
  };
}

export interface BusSpec {
  readonly gain: number;
  readonly fx: Fx[];
  readonly duck: DuckSpec | undefined;
}

export function bus(
  options: { gain?: number; fx?: Fx[]; duck?: DuckSpec } = {},
): BusSpec {
  return { gain: options.gain ?? 0, fx: options.fx ?? [], duck: options.duck };
}

export interface SongInput {
  name: string;
  tempo: number;
  timeSignature?: TimeSignature;
  tracks: TrackSpec[];
  buses?: Record<string, BusSpec>;
  /** Master fx chain; a limiter is appended if the chain doesn't end in one. */
  master?: Fx[];
  arrangement?: Section[];
  /** Song-level automation, absolute from bar `atBar` (default 1). */
  automation?: { spec: AutomationSpec; atBar?: number }[];
}

export interface SongSpec
  extends Required<Omit<SongInput, "buses" | "master" | "automation">> {
  readonly kind: "dawai-song";
  readonly buses: Record<string, BusSpec>;
  readonly master: Fx[];
  readonly automation: { spec: AutomationSpec; atBar?: number }[];
}

export function song(input: SongInput): SongSpec {
  if (input.tracks.length === 0)
    throw new Error("song() needs at least one track.");
  for (const busId of Object.keys(input.buses ?? {})) assertId(busId, "bus");
  return {
    kind: "dawai-song",
    name: input.name,
    tempo: input.tempo,
    timeSignature: input.timeSignature ?? [4, 4],
    tracks: input.tracks,
    buses: input.buses ?? {},
    master: input.master ?? [],
    arrangement: input.arrangement ?? [],
    automation: input.automation ?? [],
  };
}

export function isSongSpec(value: unknown): value is SongSpec {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as SongSpec).kind === "dawai-song"
  );
}

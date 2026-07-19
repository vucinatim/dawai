import type {
  AutomationLane,
  AutomationPoint,
  AutomationTarget,
  Bus,
  Clip,
  Document,
  Fx,
  NoteTuple,
  Track,
} from "@dawai/core/document";
import { KITS } from "@dawai/core/kits";
import { resolvePitch } from "@dawai/core/notes";
import { barsToBeats, type TimeSignature } from "@dawai/core/time";
import { validateDocument } from "@dawai/core/validate";
import { type AutomationSpec, resolveDuration } from "./automation.ts";
import { limiter } from "./fx.ts";
import type { Pattern } from "./pattern.ts";
import { partAutomation, partPattern } from "./section.ts";
import type { DuckSpec, SongSpec, TrackSpec } from "./song.ts";

/**
 * compile(): SongSpec → Document. Pure and deterministic — same spec,
 * same Document, always. Errors are compiler diagnostics: they say what
 * is wrong and what the valid options are.
 */

export class CompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompileError";
  }
}

export function compile(spec: SongSpec): Document {
  const timeSignature = spec.timeSignature;
  const trackSpecById = new Map<string, TrackSpec>();
  for (const trackSpec of spec.tracks) {
    if (trackSpecById.has(trackSpec.id)) {
      throw new CompileError(
        `Duplicate track id "${trackSpec.id}". Track ids must be unique.`,
      );
    }
    trackSpecById.set(trackSpec.id, trackSpec);
  }

  const clipsByTrack = new Map<string, Clip[]>(
    spec.tracks.map((trackSpec) => [trackSpec.id, []]),
  );
  const sections: Document["sections"] = [];
  const automationLanes: AutomationLane[] = [];

  // One canonical target context — the same string must resolve (or fail)
  // identically whether authored in a section or at song level, so the
  // master chain is finalized (limiter appended) before anything resolves.
  const masterFx: Fx[] =
    spec.master.at(-1)?.type === "limiter"
      ? spec.master
      : [...spec.master, limiter()];
  const targetContext: TargetContext = {
    tracks: spec.tracks,
    buses: Object.entries(spec.buses).map(([id, busSpec]) => ({
      id,
      fx: busSpec.fx,
      gain: busSpec.gain,
    })),
    masterFx,
    timeSignature,
  };

  compileArrangement(
    spec,
    timeSignature,
    trackSpecById,
    clipsByTrack,
    sections,
    automationLanes,
    targetContext,
  );
  compilePlacements(spec, timeSignature, clipsByTrack);

  const tracks: Track[] = spec.tracks.map((trackSpec) => ({
    id: trackSpec.id,
    name: trackSpec.name,
    instrument: trackSpec.instrument,
    gain: trackSpec.gain,
    pan: trackSpec.pan,
    mute: trackSpec.mute,
    out: trackSpec.out,
    fx: trackSpec.fx,
    clips: (clipsByTrack.get(trackSpec.id) as Clip[]).sort(
      (a, b) => a.start - b.start,
    ),
  }));

  const buses: Bus[] = Object.entries(spec.buses).map(([id, busSpec]) => ({
    id,
    gain: busSpec.gain,
    fx: busSpec.fx,
  }));

  for (const { spec: automationSpec, atBar } of spec.automation) {
    automationLanes.push(
      resolveAutomation(
        automationSpec,
        barsToBeats((atBar ?? 1) - 1, timeSignature),
        targetContext,
      ),
    );
  }

  compileDucks(spec, tracks, automationLanes);

  const document: Document = {
    version: 1,
    name: spec.name,
    tempo: spec.tempo,
    timeSignature,
    sections,
    tracks,
    buses,
    master: { fx: masterFx },
    automation: mergeLanes(automationLanes),
  };
  return validateDocument(document);
}

function compileArrangement(
  spec: SongSpec,
  timeSignature: TimeSignature,
  trackSpecById: Map<string, TrackSpec>,
  clipsByTrack: Map<string, Clip[]>,
  sections: Document["sections"],
  automationLanes: AutomationLane[],
  targetContext: TargetContext,
): void {
  let cursorBeats = 0;
  const nameOccurrences = new Map<string, number>();

  for (const sectionValue of spec.arrangement) {
    const occurrence = (nameOccurrences.get(sectionValue.name) ?? 0) + 1;
    nameOccurrences.set(sectionValue.name, occurrence);
    const clipPrefix =
      occurrence === 1
        ? sectionValue.name
        : `${sectionValue.name}#${occurrence}`;
    const lengthBeats = barsToBeats(sectionValue.lengthBars, timeSignature);

    sections.push({
      name: sectionValue.name,
      start: cursorBeats,
      length: lengthBeats,
    });

    for (const [trackId, part] of Object.entries(sectionValue.parts)) {
      if (!trackSpecById.has(trackId)) {
        const known = [...trackSpecById.keys()].join(", ");
        throw new CompileError(
          `Section "${sectionValue.name}" writes to unknown track "${trackId}". Known tracks: ${known}.`,
        );
      }
      (clipsByTrack.get(trackId) as Clip[]).push({
        id: `${clipPrefix}:${trackId}`,
        start: cursorBeats,
        length: lengthBeats,
        notes: tileNotes(partPattern(part), lengthBeats),
      });
      for (const automationSpec of partAutomation(part)) {
        automationLanes.push(
          resolveAutomation(
            resolveSelfTarget(automationSpec, trackId),
            cursorBeats,
            targetContext,
          ),
        );
      }
    }

    for (const automationSpec of sectionValue.automation) {
      automationLanes.push(
        resolveAutomation(automationSpec, cursorBeats, targetContext),
      );
    }

    cursorBeats += lengthBeats;
  }
}

/** Rewrites `self.…` automation targets to the part's own track. */
function resolveSelfTarget(
  spec: AutomationSpec,
  trackId: string,
): AutomationSpec {
  if (!spec.targetText.startsWith("self.")) return spec;
  return { ...spec, targetText: `${trackId}.${spec.targetText.slice(5)}` };
}

function compilePlacements(
  spec: SongSpec,
  timeSignature: TimeSignature,
  clipsByTrack: Map<string, Clip[]>,
): void {
  for (const trackSpec of spec.tracks) {
    for (const placement of trackSpec.placements) {
      const start = barsToBeats(placement.bar - 1, timeSignature);
      (clipsByTrack.get(trackSpec.id) as Clip[]).push({
        id: `${trackSpec.id}@${placement.bar}`,
        start,
        length: placement.pattern.lengthBeats,
        notes: tileNotes(placement.pattern, placement.pattern.lengthBeats),
      });
    }
  }
}

/** Patterns shorter than the clip tile (loop) to fill it. */
function tileNotes(pattern: Pattern, clipLengthBeats: number): NoteTuple[] {
  const tuples: NoteTuple[] = [];
  for (
    let offset = 0;
    offset < clipLengthBeats - 1e-9;
    offset += pattern.lengthBeats
  ) {
    for (const event of pattern.events) {
      const start = offset + event.start;
      if (start >= clipLengthBeats - 1e-9) continue;
      tuples.push([
        round6(start),
        event.pitch,
        round6(event.length),
        event.velocity,
      ]);
    }
  }
  tuples.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return tuples;
}

interface TargetContext {
  tracks: { id: string; fx: Fx[]; instrument?: Track["instrument"] }[];
  buses: { id: string; fx: Fx[]; gain: number }[];
  masterFx: Fx[];
  timeSignature: TimeSignature;
}

function resolveAutomation(
  spec: AutomationSpec,
  offsetBeats: number,
  context: TargetContext,
): AutomationLane {
  const target = parseTarget(spec.targetText, context);
  const points: AutomationPoint[] = spec.points.map((point) => ({
    beat: round6(
      offsetBeats + resolveDuration(point.at, context.timeSignature),
    ),
    value: point.value,
    curve: point.curve ?? "linear",
  }));
  points.sort((a, b) => a.beat - b.beat);
  return { target, points };
}

function parseTarget(text: string, context: TargetContext): AutomationTarget {
  const segments = text.split(".");
  const [head, ...rest] = segments;

  if (head === "master") {
    return {
      owner: { type: "master" },
      path: resolveParamPath(text, rest, context.masterFx, "master", false),
    };
  }
  if (head === "bus") {
    const [busId, ...busRest] = rest;
    const busValue = context.buses.find((candidate) => candidate.id === busId);
    if (!busValue) {
      const known =
        context.buses.map((candidate) => candidate.id).join(", ") || "(none)";
      throw new CompileError(
        `Automation "${text}" targets unknown bus "${busId}". Buses: ${known}.`,
      );
    }
    return {
      owner: { type: "bus", id: busValue.id },
      path: resolveParamPath(
        text,
        busRest,
        busValue.fx,
        `bus "${busValue.id}"`,
        false,
      ),
    };
  }

  const trackValue = context.tracks.find((candidate) => candidate.id === head);
  if (!trackValue) {
    const known = context.tracks.map((candidate) => candidate.id).join(", ");
    throw new CompileError(
      `Automation "${text}" targets unknown track "${head}". Tracks: ${known} (or "bus.<id>...", "master...").`,
    );
  }
  return {
    owner: { type: "track", id: trackValue.id },
    path: resolveParamPath(
      text,
      rest,
      trackValue.fx,
      `track "${trackValue.id}"`,
      true,
    ),
  };
}

function resolveParamPath(
  fullText: string,
  segments: string[],
  fxChain: Fx[],
  ownerLabel: string,
  isTrack: boolean,
): string {
  const [first, ...rest] = segments;
  if (first === "gain" && rest.length === 0) return "gain";
  if (isTrack && (first === "pan" || first === "duck") && rest.length === 0)
    return first;

  if (first === "fx") {
    const [selector, param, ...extra] = rest;
    if (!selector || !param || extra.length > 0) {
      throw new CompileError(
        `Automation "${fullText}": fx paths are "fx.<index or type>.<param>", e.g. "fx.filter.cutoff".`,
      );
    }
    const index = /^\d+$/.test(selector)
      ? Number.parseInt(selector, 10)
      : fxChain.findIndex((fx) => fx.type === selector);
    if (index < 0 || index >= fxChain.length) {
      const types =
        fxChain.map((fx, fxIndex) => `${fxIndex}:${fx.type}`).join(", ") ||
        "(empty chain)";
      throw new CompileError(
        `Automation "${fullText}": ${ownerLabel} has no fx "${selector}". Chain: ${types}.`,
      );
    }
    return `fx.${index}.${param}`;
  }

  if (isTrack && first === "instrument" && rest.length === 1) {
    return `instrument.${rest[0]}`;
  }

  const options = isTrack
    ? '"gain", "pan", "duck", "fx.<...>", "instrument.<param>"'
    : '"gain", "fx.<...>"';
  throw new CompileError(
    `Automation "${fullText}": invalid path on ${ownerLabel}. Expected ${options}.`,
  );
}

function compileDucks(
  spec: SongSpec,
  tracks: Track[],
  automationLanes: AutomationLane[],
): void {
  const owners: { owner: AutomationTarget["owner"]; duckSpec: DuckSpec }[] = [];
  for (const trackSpec of spec.tracks) {
    if (trackSpec.duck) {
      owners.push({
        owner: { type: "track", id: trackSpec.id },
        duckSpec: trackSpec.duck,
      });
    }
  }
  for (const [busId, busSpec] of Object.entries(spec.buses)) {
    if (busSpec.duck) {
      owners.push({
        owner: { type: "bus", id: busId },
        duckSpec: busSpec.duck,
      });
    }
  }

  for (const { owner, duckSpec } of owners) {
    const triggers = duckTriggerBeats(duckSpec, tracks);
    const points: AutomationPoint[] = [{ beat: 0, value: 0, curve: "linear" }];
    for (const [index, triggerBeat] of triggers.entries()) {
      points.push({ beat: triggerBeat, value: duckSpec.amount, curve: "step" });
      const releaseEnd = triggerBeat + duckSpec.release;
      const nextTrigger = triggers[index + 1];
      if (nextTrigger !== undefined && nextTrigger < releaseEnd) {
        const recovered =
          duckSpec.amount *
          (1 - (nextTrigger - triggerBeat) / duckSpec.release);
        points.push({
          beat: round6(nextTrigger),
          value: round6(recovered),
          curve: "linear",
        });
      } else {
        points.push({ beat: round6(releaseEnd), value: 0, curve: "linear" });
      }
    }
    automationLanes.push({ target: { owner, path: "duck" }, points });
  }
}

function duckTriggerBeats(duckSpec: DuckSpec, tracks: Track[]): number[] {
  const [triggerTrackId, selector] = duckSpec.trigger.split(":");
  const triggerTrack = tracks.find(
    (candidate) => candidate.id === triggerTrackId,
  );
  if (!triggerTrack) {
    const known = tracks.map((candidate) => candidate.id).join(", ");
    throw new CompileError(
      `duck() trigger "${duckSpec.trigger}" references unknown track "${triggerTrackId}". Tracks: ${known}.`,
    );
  }

  let pitchFilter: number | undefined;
  if (selector !== undefined) {
    const selectorPitch = /^\d+$/.test(selector)
      ? Number.parseInt(selector, 10)
      : selector;
    if (triggerTrack.instrument.kind === "sampler") {
      const kitDefinition = KITS[triggerTrack.instrument.kit];
      const pad = kitDefinition[selector];
      if (pad) {
        pitchFilter = pad.pitch;
      } else {
        try {
          pitchFilter = resolvePitch(selectorPitch);
        } catch {
          const pads = Object.keys(kitDefinition).join(", ");
          throw new CompileError(
            `duck() trigger "${duckSpec.trigger}": kit "${triggerTrack.instrument.kit}" has no pad "${selector}". Pads: ${pads}.`,
          );
        }
      }
    } else {
      try {
        pitchFilter = resolvePitch(selectorPitch);
      } catch {
        throw new CompileError(
          `duck() trigger "${duckSpec.trigger}": "${selector}" is not a note name or MIDI pitch.`,
        );
      }
    }
  }

  const beats = new Set<number>();
  for (const clip of triggerTrack.clips) {
    for (const [start, pitch] of clip.notes) {
      if (pitchFilter === undefined || pitch === pitchFilter) {
        beats.add(round6(clip.start + start));
      }
    }
  }
  if (beats.size === 0) {
    throw new CompileError(
      `duck() trigger "${duckSpec.trigger}" matched no notes — the ducking would be silent. Check the track, pad, or pitch.`,
    );
  }
  return [...beats].sort((a, b) => a - b);
}

/** Concatenates lanes that target the same param and sorts their points. */
function mergeLanes(lanes: AutomationLane[]): AutomationLane[] {
  const byKey = new Map<string, AutomationLane>();
  for (const lane of lanes) {
    const owner = lane.target.owner;
    const key = `${owner.type}:${owner.type === "master" ? "" : owner.id}:${lane.target.path}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.points.push(...lane.points);
      existing.points.sort((a, b) => a.beat - b.beat);
    } else {
      byKey.set(key, { target: lane.target, points: [...lane.points] });
    }
  }
  return [...byKey.values()];
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

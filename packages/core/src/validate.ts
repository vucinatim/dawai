import type { ZodError } from "zod";
import type { Document, Fx, Track } from "./document.ts";
import { documentSchema } from "./document.ts";
import { midiToNoteName } from "./notes.ts";

/**
 * Full Document validation: schema shape (zod) plus the cross-cutting
 * musical invariants zod can't express field-locally. Fail fast with
 * messages that name the fix — these errors are the agent's compiler
 * diagnostics.
 */

export interface ValidationIssue {
  path: string;
  message: string;
}

export class DocumentValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    const summary = issues
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join("\n");
    super(
      `Invalid Document (${issues.length} issue${issues.length === 1 ? "" : "s"}):\n${summary}`,
    );
    this.name = "DocumentValidationError";
    this.issues = issues;
  }
}

export function validateDocument(input: unknown): Document {
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) {
    throw new DocumentValidationError(zodIssues(parsed.error));
  }
  const document = parsed.data;
  const issues: ValidationIssue[] = [
    ...uniqueIdIssues(document),
    ...routingIssues(document),
    ...clipIssues(document),
    ...sectionIssues(document),
    ...automationIssues(document),
    ...masterIssues(document),
  ];
  if (issues.length > 0) throw new DocumentValidationError(issues);
  return document;
}

function zodIssues(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(document)",
    message: issue.message,
  }));
}

function uniqueIdIssues(document: Document): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const trackIds = new Set<string>();
  for (const track of document.tracks) {
    if (trackIds.has(track.id)) {
      issues.push({
        path: `tracks.${track.id}`,
        message: `Duplicate track id "${track.id}".`,
      });
    }
    trackIds.add(track.id);
  }
  const busIds = new Set<string>();
  for (const bus of document.buses) {
    if (bus.id === "master") {
      issues.push({
        path: "buses",
        message: `Bus id "master" is reserved for the master chain.`,
      });
    }
    if (busIds.has(bus.id)) {
      issues.push({
        path: `buses.${bus.id}`,
        message: `Duplicate bus id "${bus.id}".`,
      });
    }
    busIds.add(bus.id);
  }
  return issues;
}

function routingIssues(document: Document): ValidationIssue[] {
  const busIds = new Set(document.buses.map((bus) => bus.id));
  return document.tracks.flatMap((track) => {
    if (track.out === "master" || busIds.has(track.out)) return [];
    const available = ["master", ...busIds].join(", ");
    return [
      {
        path: `tracks.${track.id}.out`,
        message: `Route "${track.out}" does not exist. Available outputs: ${available}.`,
      },
    ];
  });
}

function clipIssues(document: Document): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const track of document.tracks) {
    const clipIds = new Set<string>();
    for (const clip of track.clips) {
      if (clipIds.has(clip.id)) {
        issues.push({
          path: `tracks.${track.id}.clips.${clip.id}`,
          message: `Duplicate clip id "${clip.id}" on track "${track.id}".`,
        });
      }
      clipIds.add(clip.id);
      for (const [index, note] of clip.notes.entries()) {
        const [start, pitch] = note;
        if (start >= clip.length) {
          issues.push({
            path: `tracks.${track.id}.clips.${clip.id}.notes.${index}`,
            message: `Note ${midiToNoteName(pitch)} starts at beat ${start}, beyond the clip length of ${clip.length} beats. Notes must start inside their clip.`,
          });
        }
      }
    }
    const ordered = [...track.clips].sort((a, b) => a.start - b.start);
    for (let index = 1; index < ordered.length; index++) {
      const previous = ordered[index - 1] as (typeof ordered)[number];
      const current = ordered[index] as (typeof ordered)[number];
      if (current.start < previous.start + previous.length) {
        issues.push({
          path: `tracks.${track.id}.clips.${current.id}`,
          message: `Clip "${current.id}" (starts at beat ${current.start}) overlaps clip "${previous.id}" (ends at beat ${previous.start + previous.length}). Clips on a track must not overlap.`,
        });
      }
    }
  }
  return issues;
}

function sectionIssues(document: Document): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ordered = [...document.sections].sort((a, b) => a.start - b.start);
  for (let index = 1; index < ordered.length; index++) {
    const previous = ordered[index - 1] as (typeof ordered)[number];
    const current = ordered[index] as (typeof ordered)[number];
    if (current.start < previous.start + previous.length) {
      issues.push({
        path: `sections.${current.name}`,
        message: `Section "${current.name}" (starts at beat ${current.start}) overlaps section "${previous.name}" (ends at beat ${previous.start + previous.length}).`,
      });
    }
  }
  return issues;
}

const FIXED_PARAM_PATHS = new Set(["gain", "pan", "duck"]);

function automationIssues(document: Document): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const trackById = new Map(document.tracks.map((track) => [track.id, track]));
  const busById = new Map(document.buses.map((bus) => [bus.id, bus]));

  for (const [laneIndex, lane] of document.automation.entries()) {
    const lanePath = `automation.${laneIndex}`;
    const owner = lane.target.owner;

    let fxChain: Fx[];
    let ownerLabel: string;
    let ownerTrack: Track | undefined;
    if (owner.type === "track") {
      ownerTrack = trackById.get(owner.id);
      if (!ownerTrack) {
        issues.push({
          path: lanePath,
          message: `Automation targets unknown track "${owner.id}".`,
        });
        continue;
      }
      fxChain = ownerTrack.fx;
      ownerLabel = `track "${owner.id}"`;
    } else if (owner.type === "bus") {
      const bus = busById.get(owner.id);
      if (!bus) {
        issues.push({
          path: lanePath,
          message: `Automation targets unknown bus "${owner.id}".`,
        });
        continue;
      }
      fxChain = bus.fx;
      ownerLabel = `bus "${owner.id}"`;
    } else {
      fxChain = document.master.fx;
      ownerLabel = "master";
    }

    issues.push(
      ...pathIssues(
        lane.target.path,
        fxChain,
        ownerLabel,
        ownerTrack,
        lanePath,
        owner.type,
      ),
    );

    for (let index = 1; index < lane.points.length; index++) {
      const previous = lane.points[index - 1] as (typeof lane.points)[number];
      const current = lane.points[index] as (typeof lane.points)[number];
      if (current.beat < previous.beat) {
        issues.push({
          path: `${lanePath}.points.${index}`,
          message: `Automation points must be sorted by beat (${current.beat} follows ${previous.beat}).`,
        });
      }
    }
  }
  return issues;
}

function pathIssues(
  path: string,
  fxChain: Fx[],
  ownerLabel: string,
  ownerTrack: Track | undefined,
  lanePath: string,
  ownerType: "track" | "bus" | "master",
): ValidationIssue[] {
  if (FIXED_PARAM_PATHS.has(path)) {
    if (ownerType === "master" && path !== "gain") {
      return [
        {
          path: lanePath,
          message: `Master supports only "gain" and fx params, not "${path}".`,
        },
      ];
    }
    return [];
  }

  const fxMatch = /^fx\.(\d+)\.([a-zA-Z]+)$/.exec(path);
  if (fxMatch) {
    const index = Number.parseInt(fxMatch[1] as string, 10);
    const param = fxMatch[2] as string;
    const fx = fxChain[index];
    if (!fx) {
      return [
        {
          path: lanePath,
          message: `Automation targets fx index ${index} on ${ownerLabel}, but its chain has ${fxChain.length} fx.`,
        },
      ];
    }
    if (
      !(param in fx) ||
      param === "type" ||
      typeof fx[param as keyof Fx] !== "number"
    ) {
      const numericParams = Object.entries(fx)
        .filter(([key, value]) => key !== "type" && typeof value === "number")
        .map(([key]) => key)
        .join(", ");
      return [
        {
          path: lanePath,
          message: `Fx "${fx.type}" has no automatable param "${param}". Available: ${numericParams}.`,
        },
      ];
    }
    return [];
  }

  const instrumentMatch = /^instrument\.([a-zA-Z]+)$/.exec(path);
  if (instrumentMatch) {
    if (!ownerTrack) {
      return [
        {
          path: lanePath,
          message: `Instrument automation is only valid on tracks.`,
        },
      ];
    }
    if (ownerTrack.instrument.kind !== "synth") {
      return [
        {
          path: lanePath,
          message: `Instrument automation targets a "${ownerTrack.instrument.kind}" instrument; only synth params are automatable.`,
        },
      ];
    }
    return [];
  }

  return [
    {
      path: lanePath,
      message: `Invalid automation path "${path}". Expected "gain", "pan", "duck", "fx.<index>.<param>", or "instrument.<param>".`,
    },
  ];
}

function masterIssues(document: Document): ValidationIssue[] {
  const lastFx = document.master.fx.at(-1);
  if (lastFx?.type !== "limiter") {
    return [
      {
        path: "master.fx",
        message: `The master chain must end with a limiter (safety ceiling). Append limiter() last.`,
      },
    ];
  }
  return [];
}

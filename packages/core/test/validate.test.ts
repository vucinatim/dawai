import { describe, expect, test } from "bun:test";
import type { Document } from "@dawai/core/document";
import {
  DocumentValidationError,
  validateDocument,
} from "@dawai/core/validate";

function baseDocument(): Document {
  return {
    version: 1,
    name: "Test Song",
    tempo: 174,
    timeSignature: [4, 4],
    sections: [{ name: "intro", start: 0, length: 16 }],
    tracks: [
      {
        id: "drums",
        name: "Drums",
        instrument: { kind: "sampler", kit: "dnb-standard" },
        gain: -3,
        pan: 0,
        mute: false,
        out: "master",
        fx: [{ type: "filter", mode: "lowpass", cutoff: 8000, q: 1 }],
        clips: [
          {
            id: "intro:drums",
            start: 0,
            length: 16,
            notes: [
              [0, 36, 0.5, 100],
              [2.5, 38, 0.5, 110],
            ],
          },
        ],
      },
    ],
    buses: [],
    master: { fx: [{ type: "limiter", ceiling: -1 }] },
    automation: [],
  };
}

function firstClip(
  document: Document,
): Document["tracks"][number]["clips"][number] {
  const clip = document.tracks[0]?.clips[0];
  if (!clip) throw new Error("test document has no first clip");
  return clip;
}

function issuesOf(document: Document): string[] {
  try {
    validateDocument(document);
    return [];
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return error.issues.map((issue) => issue.message);
    }
    throw error;
  }
}

describe("validateDocument", () => {
  test("accepts a valid document and returns it", () => {
    const document = baseDocument();
    expect(validateDocument(document)).toEqual(document);
  });

  test("rejects out-of-range pitch at the schema layer with the offending path", () => {
    const document = baseDocument();
    firstClip(document).notes.push([1, 143, 0.5, 100]);
    const messages = issuesOf(document);
    expect(messages.length).toBeGreaterThan(0);
    try {
      validateDocument(document);
    } catch (error) {
      const validationError = error as DocumentValidationError;
      const issue = validationError.issues[0];
      expect(issue?.path).toContain("notes.2.1");
      expect(issue?.message).toContain("127");
    }
  });

  test("rejects duplicate clip ids on one track", () => {
    const document = baseDocument();
    (document.tracks[0] as Document["tracks"][number]).clips.push({
      id: "intro:drums",
      start: 32,
      length: 4,
      notes: [],
    });
    expect(issuesOf(document).join("\n")).toContain(
      'Duplicate clip id "intro:drums"',
    );
  });

  test("rejects duplicate track ids", () => {
    const document = baseDocument();
    document.tracks.push({
      ...structuredClone(document.tracks[0] as Document["tracks"][number]),
    });
    expect(issuesOf(document).join("\n")).toContain(
      'Duplicate track id "drums"',
    );
  });

  test("rejects unknown output routes and names the alternatives", () => {
    const document = baseDocument();
    (document.tracks[0] as Document["tracks"][number]).out = "drumbus";
    const messages = issuesOf(document).join("\n");
    expect(messages).toContain('Route "drumbus" does not exist');
    expect(messages).toContain("Available outputs: master");
  });

  test("rejects overlapping clips on one track", () => {
    const document = baseDocument();
    (document.tracks[0] as Document["tracks"][number]).clips.push({
      id: "overlap",
      start: 8,
      length: 16,
      notes: [],
    });
    expect(issuesOf(document).join("\n")).toContain("overlaps clip");
  });

  test("rejects notes starting beyond their clip", () => {
    const document = baseDocument();
    firstClip(document).notes.push([20, 36, 0.5, 100]);
    expect(issuesOf(document).join("\n")).toContain("beyond the clip length");
  });

  test("rejects overlapping sections", () => {
    const document = baseDocument();
    document.sections.push({ name: "verse", start: 8, length: 16 });
    expect(issuesOf(document).join("\n")).toContain('Section "verse"');
  });

  test("rejects automation on unknown tracks", () => {
    const document = baseDocument();
    document.automation.push({
      target: { owner: { type: "track", id: "bass" }, path: "gain" },
      points: [{ beat: 0, value: -6, curve: "linear" }],
    });
    expect(issuesOf(document).join("\n")).toContain('unknown track "bass"');
  });

  test("rejects automation of a missing fx param and lists the real ones", () => {
    const document = baseDocument();
    document.automation.push({
      target: { owner: { type: "track", id: "drums" }, path: "fx.0.wet" },
      points: [{ beat: 0, value: 0.5, curve: "linear" }],
    });
    const messages = issuesOf(document).join("\n");
    expect(messages).toContain('no automatable param "wet"');
    expect(messages).toContain("cutoff");
  });

  test("rejects automation of an out-of-range fx index", () => {
    const document = baseDocument();
    document.automation.push({
      target: { owner: { type: "track", id: "drums" }, path: "fx.3.cutoff" },
      points: [{ beat: 0, value: 400, curve: "linear" }],
    });
    expect(issuesOf(document).join("\n")).toContain("fx index 3");
  });

  test("rejects unsorted automation points", () => {
    const document = baseDocument();
    document.automation.push({
      target: { owner: { type: "track", id: "drums" }, path: "gain" },
      points: [
        { beat: 4, value: -6, curve: "linear" },
        { beat: 2, value: 0, curve: "linear" },
      ],
    });
    expect(issuesOf(document).join("\n")).toContain("sorted by beat");
  });

  test("allows equal-beat automation points (jumps)", () => {
    const document = baseDocument();
    document.automation.push({
      target: { owner: { type: "track", id: "drums" }, path: "duck" },
      points: [
        { beat: 4, value: 0, curve: "linear" },
        { beat: 4, value: -6, curve: "step" },
      ],
    });
    expect(issuesOf(document)).toEqual([]);
  });

  test("requires the master chain to end with a limiter", () => {
    const document = baseDocument();
    document.master.fx = [];
    expect(issuesOf(document).join("\n")).toContain("must end with a limiter");
  });

  test("reserves the master bus id", () => {
    const document = baseDocument();
    document.buses.push({ id: "master", gain: 0, fx: [] });
    expect(issuesOf(document).join("\n")).toContain(
      'Bus id "master" is reserved',
    );
  });
});

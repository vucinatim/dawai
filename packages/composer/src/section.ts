import type { AutomationSpec } from "./automation.ts";
import type { Pattern } from "./pattern.ts";

/**
 * Sections are the primary authoring surface: a named span declaring
 * what each track plays. Patterns shorter than the section tile (loop)
 * to fill it; the arrangement is a plain array of sections.
 *
 * A part is a Pattern, or `{ pattern, automation }` whose automation
 * may target `self.…` — resolved to the part's own track at compile.
 * That makes idioms like riser()/sweep() self-contained one-liners.
 */

export interface PartWithAutomation {
  pattern: Pattern;
  automation: AutomationSpec[];
}

export type SectionPart = Pattern | PartWithAutomation;

export function partPattern(part: SectionPart): Pattern {
  return "pattern" in part ? part.pattern : part;
}

export function partAutomation(part: SectionPart): AutomationSpec[] {
  return "pattern" in part ? part.automation : [];
}

export interface Section {
  readonly name: string;
  readonly lengthBars: number;
  readonly parts: Readonly<Record<string, SectionPart>>;
  readonly automation: readonly AutomationSpec[];
  /** Same section with a different length. */
  bars(lengthBars: number): Section;
  /** Same section with some parts replaced (null silences a track). */
  with(overrides: Record<string, SectionPart | null>): Section;
}

export interface SectionOptions {
  automation?: AutomationSpec[];
}

export function section(
  name: string,
  lengthBars: number,
  parts: Record<string, SectionPart>,
  options: SectionOptions = {},
): Section {
  if (name.trim() === "")
    throw new Error("section() needs a name (it becomes the marker).");
  if (!Number.isFinite(lengthBars) || lengthBars <= 0) {
    throw new Error(
      `section("${name}") needs a positive length in bars, got ${lengthBars}.`,
    );
  }
  const automation = options.automation ?? [];
  const value: Section = {
    name,
    lengthBars,
    parts: Object.freeze({ ...parts }),
    automation: Object.freeze([...automation]) as readonly AutomationSpec[],
    bars(newLengthBars: number): Section {
      return section(
        name,
        newLengthBars,
        { ...parts },
        { automation: [...automation] },
      );
    },
    with(overrides: Record<string, SectionPart | null>): Section {
      const merged: Record<string, SectionPart> = { ...parts };
      for (const [trackId, part] of Object.entries(overrides)) {
        if (part === null) delete merged[trackId];
        else merged[trackId] = part;
      }
      return section(name, lengthBars, merged, { automation: [...automation] });
    },
  };
  return Object.freeze(value);
}

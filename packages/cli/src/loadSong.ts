import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { CompileError, compile } from "@dawai/composer/compile";
import { withDeterminismGuard } from "@dawai/composer/determinism";
import { isSongSpec } from "@dawai/composer/song";
import type { Document } from "@dawai/core/document";
import { DocumentValidationError } from "@dawai/core/validate";

/**
 * Loads and compiles a song project: locate song.ts, execute it (that IS
 * the compile step's front half), compile the exported spec to a
 * Document. Every failure comes back as a structured stage error.
 */

export type CheckStage = "typecheck" | "load" | "compile";

export interface StageError {
  stage: CheckStage;
  message: string;
}

export type LoadResult =
  | { ok: true; document: Document; songDirectory: string }
  | { ok: false; errors: StageError[]; songDirectory: string };

export function resolveSongDirectory(
  directoryArgument: string | undefined,
): string {
  return resolve(directoryArgument ?? process.cwd());
}

export async function loadSong(songDirectory: string): Promise<LoadResult> {
  const entry = resolve(songDirectory, "song.ts");
  if (!existsSync(entry)) {
    return {
      ok: false,
      songDirectory,
      errors: [
        {
          stage: "load",
          message: `No song.ts in ${songDirectory}. A dawai song project has a song.ts default-exporting song({ ... }).`,
        },
      ],
    };
  }

  let exported: unknown;
  try {
    const module = (await withDeterminismGuard(
      () => import(pathToFileURL(entry).href),
    )) as { default?: unknown };
    exported = module.default;
  } catch (error) {
    return {
      ok: false,
      songDirectory,
      errors: [
        {
          stage: "load",
          message: `song.ts threw while executing: ${errorMessage(error)}`,
        },
      ],
    };
  }

  if (!isSongSpec(exported)) {
    return {
      ok: false,
      songDirectory,
      errors: [
        {
          stage: "load",
          message: `song.ts must default-export the result of song({ ... }) from @dawai/composer/song.`,
        },
      ],
    };
  }

  try {
    const document = await withDeterminismGuard(() => compile(exported));
    return { ok: true, document, songDirectory };
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return {
        ok: false,
        songDirectory,
        errors: error.issues.map((issue) => ({
          stage: "compile" as const,
          message: `${issue.path}: ${issue.message}`,
        })),
      };
    }
    if (error instanceof CompileError) {
      return {
        ok: false,
        songDirectory,
        errors: [{ stage: "compile", message: error.message }],
      };
    }
    throw error;
  }
}

export async function runTypecheck(
  songDirectory: string,
): Promise<StageError[]> {
  if (!existsSync(resolve(songDirectory, "tsconfig.json"))) {
    return [
      {
        stage: "typecheck",
        message: `No tsconfig.json in ${songDirectory} — add one so \`dawai check\` can typecheck the song.`,
      },
    ];
  }
  const process_ = Bun.spawn(["bunx", "tsc", "--noEmit", "-p", songDirectory], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    process_.exited,
    new Response(process_.stdout).text(),
    new Response(process_.stderr).text(),
  ]);
  if (exitCode === 0) return [];
  const output = `${stdout}\n${stderr}`.trim();
  return output
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => ({ stage: "typecheck" as const, message: line.trim() }));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

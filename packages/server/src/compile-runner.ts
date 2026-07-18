#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { CompileError, compile } from "@dawai/composer/compile";
import { withDeterminismGuard } from "@dawai/composer/determinism";
import { isSongSpec } from "@dawai/composer/song";
import { DocumentValidationError } from "@dawai/core/validate";

/**
 * One compile, one process: executed by CompileSession per recompile,
 * because a fresh process is the only reliable way to re-execute edited
 * song source (module caches cannot be busted in-process). Prints a
 * structured JSON result to stdout; always exits 0 for song faults.
 */

const songDirectory = resolve(process.argv[2] ?? process.cwd());
const entry = resolve(songDirectory, "song.ts");

function emit(result: unknown): never {
  console.log(JSON.stringify(result));
  process.exit(0);
}

if (!existsSync(entry)) {
  emit({
    ok: false,
    error: { stage: "load", message: `No song.ts in ${songDirectory}.` },
  });
}

try {
  const module = (await withDeterminismGuard(
    () => import(pathToFileURL(entry).href),
  )) as {
    default?: unknown;
  };
  if (!isSongSpec(module.default)) {
    emit({
      ok: false,
      error: {
        stage: "load",
        message: "song.ts must default-export the result of song({ ... }).",
      },
    });
  }
  const spec = module.default;
  const document = await withDeterminismGuard(() => compile(spec));
  emit({ ok: true, document });
} catch (caught) {
  if (caught instanceof DocumentValidationError) {
    emit({ ok: false, error: { stage: "validate", message: caught.message } });
  }
  if (caught instanceof CompileError) {
    emit({ ok: false, error: { stage: "compile", message: caught.message } });
  }
  emit({
    ok: false,
    error: {
      stage: "load",
      message: `song.ts threw while executing: ${caught instanceof Error ? caught.message : String(caught)}`,
    },
  });
}

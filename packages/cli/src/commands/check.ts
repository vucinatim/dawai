import { documentLengthBars } from "@dawai/core/stats";
import {
  loadSong,
  resolveSongDirectory,
  runTypecheck,
  type StageError,
} from "../loadSong.ts";

export interface CheckOptions {
  json: boolean;
  typecheck: boolean;
}

/** `dawai check` — the build gate: typecheck + compile + IR validation. */
export async function runCheck(
  directoryArgument: string | undefined,
  options: CheckOptions,
): Promise<number> {
  const songDirectory = resolveSongDirectory(directoryArgument);
  const errors: StageError[] = [];

  if (options.typecheck) {
    errors.push(...(await runTypecheck(songDirectory)));
  }

  const result = await loadSong(songDirectory);
  if (!result.ok) errors.push(...result.errors);

  if (options.json) {
    const payload = {
      ok: errors.length === 0,
      songDirectory,
      errors,
      ...(result.ok && errors.length === 0
        ? {
            summary: {
              name: result.document.name,
              tempo: result.document.tempo,
              tracks: result.document.tracks.length,
              bars: documentLengthBars(result.document),
            },
          }
        : {}),
    };
    console.log(JSON.stringify(payload, null, 2));
    return errors.length === 0 ? 0 : 1;
  }

  if (errors.length === 0 && result.ok) {
    const stages = options.typecheck
      ? "typecheck, compile, validate"
      : "compile, validate";
    console.log(
      `✓ ${result.document.name} — ${stages} clean (${result.document.tracks.length} tracks, ${documentLengthBars(result.document)} bars at ${result.document.tempo} BPM)`,
    );
    return 0;
  }

  for (const error of errors) {
    console.error(`✗ [${error.stage}] ${error.message}`);
  }
  console.error(
    `\n${errors.length} error${errors.length === 1 ? "" : "s"}. Fix and re-run \`dawai check\`.`,
  );
  return 1;
}

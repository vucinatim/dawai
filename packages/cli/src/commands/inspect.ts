import { barRangeToBeats } from "@dawai/core/time";
import { validateDocument } from "@dawai/core/validate";
import { renderArrangement } from "@dawai/core/views/arrangement";
import { renderMix } from "@dawai/core/views/mix";
import { renderStats } from "@dawai/core/views/statsView";
import { renderTrackDetail } from "@dawai/core/views/trackDetail";
import {
  type LoadResult,
  loadSong,
  resolveSongDirectory,
} from "../loadSong.ts";
import { fetchServerDocument } from "./live.ts";

/**
 * Server-routing: when no explicit directory is given and a live server
 * is up, reuse its current compile instead of a cold one. Standalone
 * fallback always preserved.
 */
async function loadSongPreferServer(
  directoryArgument: string | undefined,
): Promise<LoadResult> {
  const songDirectory = resolveSongDirectory(directoryArgument);
  if (directoryArgument === undefined) {
    const serverDocument = await fetchServerDocument();
    if (serverDocument !== null) {
      try {
        return {
          ok: true,
          document: validateDocument(serverDocument),
          songDirectory,
        };
      } catch {
        // Fall through to a cold compile if the server payload is unusable.
      }
    }
  }
  return loadSong(songDirectory);
}

export interface InspectOptions {
  track?: string;
  bars?: string;
  mix: boolean;
  stats: boolean;
  json: boolean;
}

/**
 * `dawai inspect` — the read-back half of the loop: text renderings of
 * the compiled Document. Default view is the arrangement grid.
 */
export async function runInspect(
  directoryArgument: string | undefined,
  options: InspectOptions,
): Promise<number> {
  const result = await loadSongPreferServer(directoryArgument);
  if (!result.ok) {
    if (options.json) {
      console.log(
        JSON.stringify({ ok: false, errors: result.errors }, null, 2),
      );
      return 1;
    }
    for (const error of result.errors)
      console.error(`✗ [${error.stage}] ${error.message}`);
    console.error(
      "\nThe song does not compile — run `dawai check` for the full gate.",
    );
    return 1;
  }
  const document = result.document;

  if (options.json) {
    console.log(JSON.stringify(document, null, 2));
    return 0;
  }

  try {
    if (options.track !== undefined) {
      const window = options.bars
        ? barRangeToBeats(options.bars, document.timeSignature)
        : undefined;
      console.log(renderTrackDetail(document, options.track, window));
      return 0;
    }
    if (options.bars !== undefined) {
      console.error(
        "--bars needs --track <id> (e.g. `dawai inspect --track sub --bars 17..25`).",
      );
      return 1;
    }
    if (options.mix) {
      console.log(renderMix(document));
      return 0;
    }
    if (options.stats) {
      console.log(renderStats(document));
      return 0;
    }
    console.log(renderArrangement(document));
    return 0;
  } catch (error) {
    console.error(
      `✗ ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }
}

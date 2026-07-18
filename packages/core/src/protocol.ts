import type { Document } from "./document.ts";

/**
 * The live-session wire contract between the dawai server and the
 * preview UI (WebSocket). Pure types — part of the stable contract
 * family alongside the Document.
 */

export interface CompileErrorPayload {
  stage: string;
  message: string;
}

/** server → client */
export type ServerMessage =
  | { type: "document"; revision: number; document: Document }
  | { type: "compileError"; revision: number; error: CompileErrorPayload }
  | {
      type: "transport";
      command: "play" | "stop";
      fromBeat?: number;
      loop?: { startBeat: number; endBeat: number } | null;
    };

/** client → server (throttled runtime snapshots for `dawai status`) */
export type ClientMessage = {
  type: "runtime";
  isPlaying: boolean;
  playheadBeats: number;
  selection: {
    trackId: string | null;
    clipId: string | null;
    busId: string | null;
  };
};

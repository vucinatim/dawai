import { resolve } from "node:path";
import type { Document } from "@dawai/core/document";
import type { CompileErrorPayload } from "@dawai/core/protocol";
import { validateDocument } from "@dawai/core/validate";

/**
 * Owns the song-project → Document pipeline for a live session. Each
 * recompile runs in a fresh subprocess (see compile-runner.ts) — the
 * only reliable way to re-execute edited song source. Keeps
 * **last-good semantics**: a failed compile never replaces the current
 * Document; it surfaces as an error alongside it (boundary 5).
 */

export interface SessionState {
  revision: number;
  document: Document | null;
  error: CompileErrorPayload | null;
}

const RUNNER_PATH = resolve(import.meta.dir, "compile-runner.ts");

export class CompileSession {
  readonly songDirectory: string;
  private revision = 0;
  private document: Document | null = null;
  private error: CompileErrorPayload | null = null;

  constructor(songDirectory: string) {
    this.songDirectory = resolve(songDirectory);
  }

  state(): SessionState {
    return {
      revision: this.revision,
      document: this.document,
      error: this.error,
    };
  }

  /** Recompiles; returns the new state. Never throws for song faults. */
  async recompile(): Promise<SessionState> {
    this.revision += 1;
    const runner = Bun.spawn(["bun", RUNNER_PATH, this.songDirectory], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr] = await Promise.all([
      new Response(runner.stdout).text(),
      new Response(runner.stderr).text(),
      runner.exited,
    ]);
    try {
      const result = JSON.parse(stdout) as
        | { ok: true; document: unknown }
        | { ok: false; error: CompileErrorPayload };
      if (result.ok) {
        this.document = validateDocument(result.document);
        this.error = null;
      } else {
        this.error = result.error;
      }
    } catch {
      this.error = {
        stage: "load",
        message: `compile runner failed: ${stderr.trim() || stdout.trim() || "no output"}`,
      };
    }
    return this.state();
  }
}

import { resolveSongDirectory } from "../loadSong.ts";

/**
 * The CLI's live half: `open` starts the server for a song folder;
 * `play`/`stop`/`status` talk to it over HTTP. Fails with remediation
 * when no server is up.
 */

const DEFAULT_PORT = 4400;

export async function runOpen(
  directoryArgument: string | undefined,
  options: { port?: string },
): Promise<number> {
  const songDirectory = resolveSongDirectory(directoryArgument);
  const port = options.port ? Number.parseInt(options.port, 10) : DEFAULT_PORT;
  const { startServer, defaultUiDistDirectory } = await import(
    "@dawai/server/server"
  );
  const uiDistDirectory = defaultUiDistDirectory();
  const server = await startServer(
    songDirectory,
    uiDistDirectory ? { port, uiDistDirectory } : { port },
  );
  const state = server.session.state();
  if (state.error) {
    console.error(
      `⚠ current compile fails [${state.error.stage}] — the preview will show the error.`,
    );
  }
  // Keep the process alive; Ctrl-C stops the server.
  process.on("SIGINT", () => {
    server.stop();
    process.exit(0);
  });
  await new Promise(() => {});
  return 0;
}

async function serverFetch(
  port: number,
  path: string,
  init?: RequestInit,
): Promise<Response | null> {
  try {
    return await fetch(`http://localhost:${port}${path}`, init);
  } catch {
    return null;
  }
}

function noServerError(port: number): number {
  console.error(
    `✗ No dawai server on port ${port}. Start one with \`dawai open\` in the song folder.`,
  );
  return 1;
}

export async function runTransport(
  command: "play" | "stop",
  options: { port?: string; from?: string },
): Promise<number> {
  const port = options.port ? Number.parseInt(options.port, 10) : DEFAULT_PORT;
  const body: Record<string, unknown> = { command };
  if (options.from) {
    const document = (await fetchServerDocument(port)) as {
      timeSignature?: [number, number];
    } | null;
    const beatsPerBar = document?.timeSignature?.[0] ?? 4;
    body.fromBeat = (Number.parseInt(options.from, 10) - 1) * beatsPerBar;
  }
  const response = await serverFetch(port, "/api/transport", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response) return noServerError(port);
  const payload = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok) {
    console.error(`✗ ${payload.error}`);
    return 1;
  }
  console.log(
    `✓ ${command} sent to ${(payload as { sentTo?: number }).sentTo} preview(s)`,
  );
  return 0;
}

export async function runStatus(options: {
  port?: string;
  json: boolean;
}): Promise<number> {
  const port = options.port ? Number.parseInt(options.port, 10) : DEFAULT_PORT;
  const response = await serverFetch(port, "/api/status");
  if (!response) return noServerError(port);
  const status = (await response.json()) as {
    songDirectory: string;
    revision: number;
    compile: {
      ok: boolean;
      name?: string;
      tempo?: number;
      error?: { stage: string; message: string };
    };
    runtime: {
      isPlaying: boolean;
      playheadBeats: number;
      selection: {
        trackId: string | null;
        clipId: string | null;
        busId: string | null;
      };
    } | null;
    connectedPreviews: number;
  };
  if (options.json) {
    console.log(JSON.stringify(status, null, 2));
    return 0;
  }
  if (status.compile.ok) {
    console.log(`✓ ${status.compile.name} — compile r${status.revision} clean`);
  } else {
    console.log(
      `✗ compile r${status.revision} failed [${status.compile.error?.stage}]`,
    );
  }
  if (status.runtime) {
    const { isPlaying, playheadBeats, selection } = status.runtime;
    const selected =
      selection.clipId ?? selection.trackId ?? selection.busId ?? "nothing";
    console.log(
      `  ${isPlaying ? "playing" : "stopped"} at beat ${Math.round(playheadBeats * 100) / 100} · selected: ${selected}`,
    );
  } else {
    console.log(`  no preview connected (${status.connectedPreviews} sockets)`);
  }
  return 0;
}

/** Fetches the running server's Document, if a server is up (inspect fast path). */
export async function fetchServerDocument(
  port = DEFAULT_PORT,
): Promise<unknown | null> {
  const response = await serverFetch(port, "/api/document");
  if (!response?.ok) return null;
  const payload = (await response.json()) as { document?: unknown };
  return payload.document ?? null;
}

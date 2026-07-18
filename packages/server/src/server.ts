import { existsSync, type FSWatcher, watch } from "node:fs";
import { resolve } from "node:path";
import type { ClientMessage, ServerMessage } from "@dawai/core/protocol";
import { Hono } from "hono";
import { CompileSession } from "./compile-session.ts";

/**
 * The dawai local server: one song project, one live session.
 * File change → debounced recompile → WebSocket push to every preview.
 * Data flow stays unidirectional: source → compile → Document → UI;
 * the only upstream traffic is ephemeral runtime state for `status`.
 */

export interface ServerOptions {
  port?: number;
  /** Directory of a built UI to serve (falls back to a hint page). */
  uiDistDirectory?: string;
}

export interface DawaiServer {
  port: number;
  session: CompileSession;
  stop: () => void;
}

interface RuntimeSnapshot extends Omit<ClientMessage, "type"> {
  reportedAt: number;
}

const WATCH_DEBOUNCE_MS = 80;

export async function startServer(
  songDirectory: string,
  options: ServerOptions = {},
): Promise<DawaiServer> {
  const port = options.port ?? 4400;
  const session = new CompileSession(songDirectory);
  await session.recompile();

  const sockets = new Set<Bun.ServerWebSocket<unknown>>();
  let lastRuntime: RuntimeSnapshot | null = null;

  const broadcast = (message: ServerMessage) => {
    const encoded = JSON.stringify(message);
    for (const socket of sockets) socket.send(encoded);
  };

  const currentStateMessage = (): ServerMessage => {
    const state = session.state();
    if (state.error) {
      return {
        type: "compileError",
        revision: state.revision,
        error: state.error,
      };
    }
    if (state.document) {
      return {
        type: "document",
        revision: state.revision,
        document: state.document,
      };
    }
    return {
      type: "compileError",
      revision: state.revision,
      error: { stage: "load", message: "No document yet." },
    };
  };

  let debounce: ReturnType<typeof setTimeout> | null = null;
  const onSourceChange = () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const state = await session.recompile();
      broadcast(currentStateMessage());
      // After an error, a good compile also needs the document re-sent;
      // after a good compile the error overlay clears via the doc push.
      if (!state.error && state.document) {
        console.log(
          `dawai: recompiled r${state.revision} (${state.document.name})`,
        );
      } else if (state.error) {
        console.error(
          `dawai: compile failed r${state.revision} [${state.error.stage}]`,
        );
      }
    }, WATCH_DEBOUNCE_MS);
  };

  const watcher: FSWatcher = watch(
    session.songDirectory,
    { recursive: true },
    (_event, filename) => {
      if (filename?.endsWith(".ts")) onSourceChange();
    },
  );

  const app = new Hono();

  app.get("/api/health", (context) => context.json({ ok: true }));

  app.get("/api/status", (context) => {
    const state = session.state();
    return context.json({
      songDirectory: session.songDirectory,
      revision: state.revision,
      compile: state.error
        ? { ok: false, error: state.error }
        : {
            ok: true,
            name: state.document?.name,
            tempo: state.document?.tempo,
          },
      runtime: lastRuntime,
      connectedPreviews: sockets.size,
    });
  });

  app.get("/api/document", (context) => {
    const state = session.state();
    if (!state.document) return context.json({ error: state.error }, 409);
    return context.json({ revision: state.revision, document: state.document });
  });

  app.post("/api/transport", async (context) => {
    const body = (await context.req.json()) as {
      command: "play" | "stop";
      fromBeat?: number;
      loop?: { startBeat: number; endBeat: number } | null;
    };
    if (body.command !== "play" && body.command !== "stop") {
      return context.json({ error: 'command must be "play" or "stop"' }, 400);
    }
    if (sockets.size === 0) {
      return context.json(
        { error: "No preview connected — run `dawai open` first." },
        409,
      );
    }
    broadcast({ type: "transport", ...body });
    return context.json({ ok: true, sentTo: sockets.size });
  });

  const uiDist = options.uiDistDirectory;
  app.get("*", async (context) => {
    if (uiDist) {
      const path = context.req.path === "/" ? "/index.html" : context.req.path;
      const file = Bun.file(resolve(uiDist, `.${path}`));
      if (await file.exists()) return new Response(file);
      const index = Bun.file(resolve(uiDist, "index.html"));
      if (await index.exists()) return new Response(index);
    }
    return context.text(
      "dawai server is running. No built UI found — run the preview with `bun run --cwd packages/ui dev` (it connects automatically).",
    );
  });

  const bunServer = Bun.serve({
    port,
    fetch(request, server) {
      if (new URL(request.url).pathname === "/ws" && server.upgrade(request)) {
        return undefined;
      }
      return app.fetch(request);
    },
    websocket: {
      open(socket) {
        sockets.add(socket);
        socket.send(JSON.stringify(currentStateMessage()));
      },
      message(_socket, raw) {
        try {
          const message = JSON.parse(String(raw)) as ClientMessage;
          if (message.type === "runtime") {
            const { type: _type, ...snapshot } = message;
            lastRuntime = { ...snapshot, reportedAt: performance.now() };
          }
        } catch {
          // Ignore malformed client messages.
        }
      },
      close(socket) {
        sockets.delete(socket);
      },
    },
  });

  console.log(
    `dawai server → http://localhost:${bunServer.port} (song: ${session.songDirectory})`,
  );

  return {
    port: bunServer.port ?? port,
    session,
    stop: () => {
      watcher.close();
      if (debounce) clearTimeout(debounce);
      for (const socket of sockets) socket.close();
      bunServer.stop(true);
    },
  };
}

/** Locates the built UI relative to the dawai repo, if present. */
export function defaultUiDistDirectory(): string | undefined {
  const dist = resolve(import.meta.dir, "../../ui/dist");
  return existsSync(dist) ? dist : undefined;
}

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ServerMessage } from "@dawai/core/protocol";
import { type DawaiServer, startServer } from "@dawai/server/server";

/**
 * The loop, end to end: start a server on a real song folder, connect a
 * WebSocket preview, then edit → assert update, break → assert
 * last-good + error, fix → assert recovery, and drive the transport.
 */

const songDirectory = resolve(import.meta.dir, "../../..", ".e2e-tmp-song");

function songSource(tempo: number, out = "master"): string {
  return `import { steps } from "@dawai/composer/builders";
import { sampler } from "@dawai/composer/instruments";
import { section } from "@dawai/composer/section";
import { song, track } from "@dawai/composer/song";

export default song({
  name: "E2E",
  tempo: ${tempo},
  tracks: [track("drums", sampler("dnb-standard"), { out: "${out}" })],
  arrangement: [section("intro", 1, { drums: steps("x...", 36) })],
});
`;
}

let server: DawaiServer;
let socket: WebSocket;
const received: ServerMessage[] = [];

function nextMessage(
  predicate: (message: ServerMessage) => boolean,
  timeoutMs = 4000,
): Promise<ServerMessage> {
  const existing = received.find(predicate);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolvePromise, reject) => {
    const startedAt = Date.now();
    const poll = setInterval(() => {
      const match = received.find(predicate);
      if (match) {
        clearInterval(poll);
        resolvePromise(match);
      } else if (Date.now() - startedAt > timeoutMs) {
        clearInterval(poll);
        reject(
          new Error(
            `Timed out waiting for message. Got: ${JSON.stringify(received.map((m) => m.type))}`,
          ),
        );
      }
    }, 25);
  });
}

beforeAll(async () => {
  rmSync(songDirectory, { recursive: true, force: true });
  mkdirSync(songDirectory, { recursive: true });
  // A real song project, like `dawai init` makes one: file: deps + install.
  const packagesDirectory = resolve(import.meta.dir, "../..");
  writeFileSync(
    resolve(songDirectory, "package.json"),
    JSON.stringify({
      name: "e2e-song",
      private: true,
      type: "module",
      dependencies: {
        "@dawai/composer": `file:${resolve(packagesDirectory, "composer")}`,
        "@dawai/core": `file:${resolve(packagesDirectory, "core")}`,
      },
      // composer declares @dawai/core as workspace:*, which cannot
      // resolve outside the dawai repo — pin it to the same file: path.
      overrides: {
        "@dawai/core": `file:${resolve(packagesDirectory, "core")}`,
      },
    }),
  );
  writeFileSync(resolve(songDirectory, "song.ts"), songSource(120));
  const install = Bun.spawnSync(["bun", "install"], { cwd: songDirectory });
  if (install.exitCode !== 0)
    throw new Error(`bun install failed: ${install.stderr.toString()}`);
  server = await startServer(songDirectory, { port: 0 });
  socket = new WebSocket(`ws://localhost:${server.port}/ws`);
  socket.onmessage = (event) =>
    received.push(JSON.parse(String(event.data)) as ServerMessage);
  await new Promise((resolvePromise) => {
    socket.onopen = resolvePromise;
  });
});

afterAll(() => {
  socket?.close();
  server?.stop();
  rmSync(songDirectory, { recursive: true, force: true });
});

describe("the live loop", () => {
  test("a connecting preview immediately receives the current document", async () => {
    const message = await nextMessage((m) => m.type === "document");
    expect(message.type === "document" && message.document.tempo).toBe(120);
  });

  test("editing song.ts pushes an updated document", async () => {
    writeFileSync(resolve(songDirectory, "song.ts"), songSource(99));
    const message = await nextMessage(
      (m) => m.type === "document" && m.document.tempo === 99,
    );
    expect(message.type).toBe("document");
  });

  test("a broken edit pushes a compile error and keeps the last-good document", async () => {
    writeFileSync(
      resolve(songDirectory, "song.ts"),
      songSource(99, "ghostbus"),
    );
    const message = await nextMessage((m) => m.type === "compileError");
    expect(message.type === "compileError" && message.error.message).toContain(
      'Route "ghostbus" does not exist',
    );

    const response = await fetch(
      `http://localhost:${server.port}/api/document`,
    );
    const payload = (await response.json()) as { document: { tempo: number } };
    expect(payload.document.tempo).toBe(99);

    const status = (await (
      await fetch(`http://localhost:${server.port}/api/status`)
    ).json()) as {
      compile: { ok: boolean };
    };
    expect(status.compile.ok).toBe(false);
  });

  test("fixing the file recovers with a fresh document push", async () => {
    writeFileSync(resolve(songDirectory, "song.ts"), songSource(150));
    const message = await nextMessage(
      (m) => m.type === "document" && m.document.tempo === 150,
    );
    expect(message.type).toBe("document");
  });

  test("transport commands broadcast to connected previews", async () => {
    const response = await fetch(
      `http://localhost:${server.port}/api/transport`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command: "play", fromBeat: 0 }),
      },
    );
    expect(response.ok).toBe(true);
    const message = await nextMessage((m) => m.type === "transport");
    expect(message.type === "transport" && message.command).toBe("play");
  });

  test("status reports runtime snapshots sent by the preview", async () => {
    socket.send(
      JSON.stringify({
        type: "runtime",
        isPlaying: true,
        playheadBeats: 12.5,
        selection: { trackId: "drums", clipId: null, busId: null },
      }),
    );
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    const status = (await (
      await fetch(`http://localhost:${server.port}/api/status`)
    ).json()) as {
      runtime: { playheadBeats: number; selection: { trackId: string } };
    };
    expect(status.runtime.playheadBeats).toBe(12.5);
    expect(status.runtime.selection.trackId).toBe("drums");
  });
});

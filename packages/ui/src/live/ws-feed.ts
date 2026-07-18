import type { ClientMessage, ServerMessage } from "@dawai/core/protocol";
import { transportControls } from "@/audio/engine-bridge";
import { documentActions } from "@/stores/document-store";
import { useRuntimeStore } from "@/stores/runtime-store";

/**
 * The live feed: connects to the dawai server's WebSocket and drives
 * the same `feedDocument` seam the fixture feed used in goal 2.
 * Documents and compile errors flow down; throttled runtime snapshots
 * (playhead, selection) flow up for `dawai status`. Returns false if no
 * server answers, so the caller can fall back to the fixture feed.
 */

const RUNTIME_REPORT_MS = 250;

function serverWebSocketUrl(): string {
  // Vite dev serves the UI on its own port; the dawai server owns 4400.
  // When the server itself serves the built UI, same origin applies.
  const isViteDev = window.location.port === "5173";
  const host = isViteDev ? "localhost:4400" : window.location.host;
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${host}/ws`;
}

export function connectLiveFeed(): Promise<boolean> {
  return new Promise((resolveConnected) => {
    let connected = false;
    const socket = new WebSocket(serverWebSocketUrl());

    socket.onopen = () => {
      connected = true;
      resolveConnected(true);
      startRuntimeReporting(socket);
      console.log("dawai: live feed connected");
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as ServerMessage;
      const runtimeActions = useRuntimeStore.getState().actions;
      switch (message.type) {
        case "document":
          documentActions().feedDocument(message.document);
          runtimeActions.setCompileError(null);
          break;
        case "compileError":
          // Last-good semantics: the current Document keeps rendering
          // and playing; only the overlay appears.
          runtimeActions.setCompileError(message.error);
          break;
        case "transport":
          if (message.command === "play") {
            if (message.loop !== undefined)
              runtimeActions.setLoop(message.loop);
            transportControls.play(message.fromBeat);
          } else {
            transportControls.stop();
          }
          break;
      }
    };

    socket.onerror = () => {
      if (!connected) resolveConnected(false);
    };
    socket.onclose = () => {
      if (!connected) resolveConnected(false);
      else
        console.warn(
          "dawai: live feed disconnected — preview keeps the last document",
        );
    };
  });
}

function startRuntimeReporting(socket: WebSocket): void {
  let last = "";
  const report = () => {
    if (socket.readyState !== WebSocket.OPEN) return;
    const state = useRuntimeStore.getState();
    const message: ClientMessage = {
      type: "runtime",
      isPlaying: state.isPlaying,
      playheadBeats: Math.round(state.playheadBeats * 100) / 100,
      selection: state.selection,
    };
    const encoded = JSON.stringify(message);
    if (encoded !== last) {
      socket.send(encoded);
      last = encoded;
    }
  };
  const interval = setInterval(report, RUNTIME_REPORT_MS);
  socket.addEventListener("close", () => clearInterval(interval));
}

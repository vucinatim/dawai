import { compile } from "@dawai/composer/compile";
import demoSong from "fixture-dnb-demo/song";
import { installNodeBudgetMonitor } from "@/audio/node-budget";
import { documentActions } from "@/stores/document-store";

/**
 * Goal-2 document feed: compiles the demo song in-browser and feeds the
 * store once at startup. Goal 3 replaces this module with the server's
 * WebSocket feed — the store's `feedDocument` seam stays identical.
 */

export function feedDemoDocument(): void {
  documentActions().feedDocument(compile(demoSong));
}

/**
 * Dev-only probes (acceptance: document swap must not stop the
 * transport; audio must actually flow). From the console:
 * `__dawai.feedVariant(140)`, `await __dawai.peak()`.
 */
export function installDevFeed(): void {
  if (!import.meta.env.DEV) return;
  installNodeBudgetMonitor();
  (window as unknown as Record<string, unknown>).__dawai = {
    feedVariant: (tempo = 140) =>
      documentActions().feedDocument(compile({ ...demoSong, tempo })),
    feedOriginal: () => feedDemoDocument(),
    probe: () =>
      import("@/audio/dev-probe").then((module) => module.audioProbe()),
    audition: () =>
      import("@/audio/dev-probe").then((module) => module.audition()),
    stress: (seconds = 8) =>
      import("@/audio/dev-probe").then((module) => module.stressProbe(seconds)),
    tone: () => import("tone"),
    engine: () => import("@/audio/engine").then((module) => module.audioEngine),
  };
}

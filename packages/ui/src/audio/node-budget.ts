/**
 * Dev-only WebAudio node-budget monitor. The audio thread must render
 * every node every ~2.9ms quantum; past a few thousand nodes the
 * render thread misses deadlines and playback collapses (context
 * clock falls behind wall time) with no warning from the platform.
 * Tone.js abstractions are node-hungry (~50 per MonoSynth voice), so
 * graph size is easy to blow without noticing — this makes it visible.
 *
 * Installed from the dev feed only; all exports no-op in production.
 */

// Static-graph budget: Neon Rain v2 builds ~2.3k; playback adds ~50
// nodes per sounding synth voice; collapse observed near ~4k active.
const STATIC_GRAPH_BUDGET = 3000;

let installed = false;
let created = 0;

export function installNodeBudgetMonitor(): void {
  if (installed) return;
  installed = true;
  const proto = BaseAudioContext.prototype as unknown as Record<
    string,
    unknown
  >;
  for (const method of Object.getOwnPropertyNames(BaseAudioContext.prototype)) {
    if (!method.startsWith("create")) continue;
    const original = proto[method];
    if (typeof original !== "function") continue;
    proto[method] = function (this: unknown, ...args: unknown[]) {
      created++;
      return (original as (...a: unknown[]) => unknown).apply(this, args);
    };
  }
}

export function nodeCreationCount(): number {
  return created;
}

export function warnIfGraphOverBudget(nodesBuilt: number): void {
  if (!installed || nodesBuilt <= STATIC_GRAPH_BUDGET) return;
  console.warn(
    `dawai: graph build created ${nodesBuilt} WebAudio nodes ` +
      `(budget ~${STATIC_GRAPH_BUDGET}) — playback may starve the audio ` +
      `thread. Biggest levers: fewer kit/voice layers, fewer tracks with ` +
      `chorus, check that kit tracks only build clip-used pads.`,
  );
}

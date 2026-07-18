import type { Document, Fx } from "../document.ts";

/** Signal-flow view: every chain, gain, route, and automation target. */

export function renderMix(document: Document): string {
  const lines: string[] = [];

  lines.push("tracks");
  for (const track of document.tracks) {
    const parts = [
      instrumentLabel(track.instrument),
      `gain ${formatDb(track.gain)}`,
      `pan ${track.pan}`,
      `→ ${track.out}`,
    ];
    if (track.mute) parts.push("MUTED");
    lines.push(`  ${track.id.padEnd(10)} ${parts.join("  ")}`);
    if (track.fx.length > 0)
      lines.push(`  ${" ".repeat(10)} fx: ${fxChainLabel(track.fx)}`);
  }

  if (document.buses.length > 0) {
    lines.push("buses");
    for (const bus of document.buses) {
      lines.push(`  ${bus.id.padEnd(10)} gain ${formatDb(bus.gain)}  → master`);
      if (bus.fx.length > 0)
        lines.push(`  ${" ".repeat(10)} fx: ${fxChainLabel(bus.fx)}`);
    }
  }

  lines.push("master");
  lines.push(`  ${" ".repeat(10)} fx: ${fxChainLabel(document.master.fx)}`);

  if (document.automation.length > 0) {
    lines.push("automation");
    for (const lane of document.automation) {
      const owner =
        lane.target.owner.type === "master"
          ? "master"
          : `${lane.target.owner.type} ${lane.target.owner.id}`;
      const first = lane.points[0] as (typeof lane.points)[number];
      const last = lane.points.at(-1) as (typeof lane.points)[number];
      lines.push(
        `  ${owner}.${lane.target.path} — ${lane.points.length} points, beats ${first.beat}–${last.beat}`,
      );
    }
  }

  return lines.join("\n");
}

function instrumentLabel(
  instrument: Document["tracks"][number]["instrument"],
): string {
  switch (instrument.kind) {
    case "synth":
      return `synth:${instrument.preset}`;
    case "sampler":
      return `sampler:${instrument.kit}`;
    case "sample":
      return `sample:${instrument.source}`;
  }
}

function fxChainLabel(chain: Fx[]): string {
  if (chain.length === 0) return "(none)";
  return chain
    .map((fx) => {
      const params = Object.entries(fx)
        .filter(([key]) => key !== "type")
        .map(([key, value]) => `${key}=${value}`)
        .join(" ");
      return `${fx.type}(${params})`;
    })
    .join(" → ");
}

function formatDb(value: number): string {
  return `${value > 0 ? "+" : ""}${value}dB`;
}

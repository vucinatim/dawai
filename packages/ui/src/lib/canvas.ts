/** Shared canvas plumbing for the arrangement and piano-roll renderers. */

export interface DawCanvasColors {
  note: string;
  grid: string;
  gridStrong: string;
  accent: string;
  lane: string;
  mutedForeground: string;
}

let cachedColors: DawCanvasColors | null = null;

/** DAW colors resolved from the CSS tokens, so canvases follow the theme. */
export function dawCanvasColors(): DawCanvasColors {
  if (cachedColors) return cachedColors;
  const style = getComputedStyle(document.documentElement);
  const read = (name: string) => style.getPropertyValue(name).trim();
  cachedColors = {
    note: read("--daw-note"),
    grid: read("--daw-grid"),
    gridStrong: read("--daw-grid-strong"),
    accent: read("--daw-accent"),
    lane: read("--daw-lane"),
    mutedForeground: read("--muted-foreground"),
  };
  return cachedColors;
}

/** Sizes a canvas for the device pixel ratio; returns a scaled context. */
export function setupCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): CanvasRenderingContext2D | null {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext("2d");
  context?.scale(ratio, ratio);
  return context;
}

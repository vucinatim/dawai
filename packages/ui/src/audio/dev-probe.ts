import { KITS } from "@dawai/core/kits";
import { SYNTH_PRESET_IDS, SYNTH_PRESETS } from "@dawai/core/presets";
import * as Tone from "tone";
import { createKitVoices } from "./drum-voices";
import { createVoiceInstrument } from "./voice-builder";

/** Dev-only: measures real output at the destination for verification. */
export async function audioProbe(): Promise<{
  contextState: string;
  transportState: string;
  positionSeconds: number;
  peakAmplitude: number;
}> {
  const analyser = new Tone.Analyser("waveform", 2048);
  Tone.getDestination().connect(analyser);
  await new Promise((resolve) => setTimeout(resolve, 400));
  const data = analyser.getValue() as Float32Array;
  let peakAmplitude = 0;
  for (const sample of data)
    peakAmplitude = Math.max(peakAmplitude, Math.abs(sample));
  Tone.getDestination().disconnect(analyser);
  analyser.dispose();
  return {
    contextState: Tone.getContext().state,
    transportState: Tone.getTransport().state,
    positionSeconds: Tone.getTransport().seconds,
    peakAmplitude,
  };
}

interface AuditionEntry {
  id: string;
  peak: number;
  /** Spectral-centroid drift over a held note (filter movement). */
  centroidDrift?: number;
}

function peakOf(data: Float32Array): number {
  let peak = 0;
  for (const sample of data) peak = Math.max(peak, Math.abs(sample));
  return peak;
}

/**
 * The analyser window only holds ~43ms of audio, so a single snapshot
 * misses short percussive sounds — poll across the whole duration.
 * Centroid range is tracked only over frames with real signal, so fast
 * envelopes (pluck) register their sweep and silence doesn't skew it.
 */
async function pollSound(
  wave: Tone.Analyser,
  fft: Tone.Analyser,
  durationMs: number,
): Promise<{ peak: number; centroidDrift: number }> {
  let peak = 0;
  let centroidMin = Number.POSITIVE_INFINITY;
  let centroidMax = 0;
  const start = performance.now();
  while (performance.now() - start < durationMs) {
    await new Promise((resolve) => setTimeout(resolve, 35));
    const framePeak = peakOf(wave.getValue() as Float32Array);
    peak = Math.max(peak, framePeak);
    if (framePeak > 0.02) {
      const centroid = centroidOf(fft.getValue() as Float32Array);
      centroidMin = Math.min(centroidMin, centroid);
      centroidMax = Math.max(centroidMax, centroid);
    }
  }
  const centroidDrift =
    centroidMax > 0
      ? (centroidMax - centroidMin) / Math.max(centroidMin, 1)
      : 0;
  return { peak, centroidDrift };
}

function centroidOf(fft: Float32Array): number {
  let weighted = 0;
  let total = 0;
  for (let bin = 0; bin < fft.length; bin++) {
    const magnitude = 10 ** (fft[bin] / 20);
    weighted += bin * magnitude;
    total += magnitude;
  }
  return total > 0 ? weighted / total : 0;
}

/**
 * Plays every preset and every kit pad in sequence, measuring peak
 * output per sound (audible — it is an audition). Also measures filter
 * movement on sustained presets via spectral-centroid drift.
 */
export async function audition(): Promise<{
  sounds: AuditionEntry[];
  silent: string[];
  movement: Record<string, number>;
}> {
  await Tone.start();
  const wave = new Tone.Analyser("waveform", 2048);
  const fft = new Tone.Analyser("fft", 1024);
  const sounds: AuditionEntry[] = [];
  const movement: Record<string, number> = {};
  const MOVEMENT_PRESETS = new Set(["reese", "warm-pad", "pluck", "supersaw"]);

  for (const presetId of SYNTH_PRESET_IDS) {
    const voice = createVoiceInstrument(SYNTH_PRESETS[presetId]);
    voice.output.connect(wave);
    voice.output.connect(fft);
    voice.output.toDestination();
    const pitch = presetId.includes("sub") || presetId === "reese" ? 40 : 57;
    const now = Tone.now() + 0.05;
    const wantsMovement = MOVEMENT_PRESETS.has(presetId);
    voice.triggerNote(pitch, wantsMovement ? 1.1 : 0.35, now, 0.9);
    const measured = await pollSound(wave, fft, wantsMovement ? 930 : 500);
    if (wantsMovement) movement[presetId] = measured.centroidDrift;
    sounds.push({ id: `preset:${presetId}`, peak: measured.peak });
    voice.dispose();
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  const kit = createKitVoices("dnb-standard");
  kit.output.connect(wave);
  kit.output.connect(fft);
  kit.output.toDestination();
  for (const [padName, pad] of Object.entries(KITS["dnb-standard"])) {
    kit.triggerPitch(pad.pitch, Tone.now() + 0.05, 1);
    const measured = await pollSound(wave, fft, 350);
    sounds.push({ id: `pad:${padName}`, peak: measured.peak });
  }
  kit.dispose();
  wave.dispose();
  fft.dispose();

  return {
    sounds,
    silent: sounds
      .filter((entry) => entry.peak < 0.01)
      .map((entry) => entry.id),
    movement,
  };
}

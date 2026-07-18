import * as Tone from "tone";

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

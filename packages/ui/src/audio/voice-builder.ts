import type {
  FmLayer,
  NoiseLayer,
  OscillatorLayer,
  VoiceDefinition,
  VoiceLayer,
} from "@dawai/core/voice";
import * as Tone from "tone";

/**
 * Voice schema v2 → Tone graph. A voice is a stack of layers (osc /
 * fm / noise) summed through a color chain (drive → chorus). Filter
 * movement lives per-note inside each oscillator layer's MonoSynth
 * filter envelope — the thing that makes sounds breathe.
 */

export interface InstrumentVoice {
  output: Tone.ToneAudioNode;
  triggerNote: (
    pitch: number,
    durationSeconds: number,
    time: number,
    velocity: number,
  ) => void;
  applyParam: (param: string, value: number) => void;
  dispose: () => void;
}

interface BuiltLayer {
  trigger: (
    pitch: number,
    durationSeconds: number,
    time: number,
    velocity: number,
  ) => void;
  set: (values: Record<string, number>) => void;
  dispose: () => void;
}

// Each Tone.MonoSynth voice costs ~50 WebAudio nodes; a realtime graph
// budget is only a few thousand. 6 voices per layer keeps chords intact
// while voice-stealing caps the transient pile-up at section boundaries.
const LAYER_POLYPHONY = 6;

function oscillatorLayer(
  layer: OscillatorLayer,
  voice: VoiceDefinition,
  destination: Tone.ToneAudioNode,
): BuiltLayer {
  const gain = new Tone.Gain(layer.gain, "decibels").connect(destination);
  const synth = new Tone.PolySynth(Tone.MonoSynth, {
    oscillator:
      layer.voices > 1
        ? {
            type: `fat${layer.type}` as "fatsawtooth",
            count: layer.voices,
            spread: layer.spread,
          }
        : { type: layer.type },
    detune: layer.detune,
    envelope: voice.amp,
    filter: { type: voice.filter.mode, Q: voice.filter.q, rolloff: -12 },
    filterEnvelope: {
      ...voice.filterEnvelope,
      baseFrequency: voice.filter.cutoff,
    },
  }).connect(gain);
  synth.maxPolyphony = LAYER_POLYPHONY;
  return {
    trigger: (pitch, durationSeconds, time, velocity) => {
      const shifted = Math.max(0, Math.min(127, pitch + layer.octave * 12));
      synth.triggerAttackRelease(
        Tone.Frequency(shifted, "midi").toFrequency(),
        durationSeconds,
        time,
        velocity,
      );
    },
    set: (values) => synth.set(values as never),
    dispose: () => {
      synth.dispose();
      gain.dispose();
    },
  };
}

function fmLayer(
  layer: FmLayer,
  voice: VoiceDefinition,
  destination: Tone.ToneAudioNode,
): BuiltLayer {
  const gain = new Tone.Gain(layer.gain, "decibels").connect(destination);
  const synth = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: layer.harmonicity,
    modulationIndex: layer.modulationIndex,
    envelope: voice.amp,
    modulationEnvelope: {
      attack: voice.amp.attack,
      decay: voice.amp.decay * 1.5,
      sustain: voice.amp.sustain * 0.6,
      release: voice.amp.release,
    },
  }).connect(gain);
  synth.maxPolyphony = LAYER_POLYPHONY;
  return {
    trigger: (pitch, durationSeconds, time, velocity) => {
      const shifted = Math.max(0, Math.min(127, pitch + layer.octave * 12));
      synth.triggerAttackRelease(
        Tone.Frequency(shifted, "midi").toFrequency(),
        durationSeconds,
        time,
        velocity,
      );
    },
    set: (values) => synth.set(values as never),
    dispose: () => {
      synth.dispose();
      gain.dispose();
    },
  };
}

function noiseLayer(
  layer: NoiseLayer,
  voice: VoiceDefinition,
  destination: Tone.ToneAudioNode,
): BuiltLayer {
  const gain = new Tone.Gain(layer.gain, "decibels").connect(destination);
  const filter = new Tone.Filter({
    type: voice.filter.mode,
    frequency: voice.filter.cutoff,
    Q: voice.filter.q,
  }).connect(gain);
  const noise = new Tone.NoiseSynth({
    noise: { type: layer.type },
    envelope: voice.amp,
  }).connect(filter);
  // Noise is monophonic: chords must not retrigger it at one instant.
  let lastTrigger = Number.NEGATIVE_INFINITY;
  return {
    trigger: (_pitch, durationSeconds, time, velocity) => {
      if (time <= lastTrigger + 1e-4) return;
      lastTrigger = time;
      noise.triggerAttackRelease(durationSeconds, time, velocity);
    },
    set: () => {},
    dispose: () => {
      noise.dispose();
      filter.dispose();
      gain.dispose();
    },
  };
}

function buildLayer(
  layer: VoiceLayer,
  voice: VoiceDefinition,
  destination: Tone.ToneAudioNode,
): BuiltLayer {
  switch (layer.kind) {
    case "osc":
      return oscillatorLayer(layer, voice, destination);
    case "fm":
      return fmLayer(layer, voice, destination);
    case "noise":
      return noiseLayer(layer, voice, destination);
  }
}

/**
 * Dual-delay stereo chorus from raw WebAudio nodes (~9 nodes). The Tone
 * equivalent costs ~70 nodes per instrument, which matters against the
 * few-thousand-node realtime budget.
 */
function leanChorus(
  wet: number,
  destination: Tone.ToneAudioNode,
): { input: Tone.Gain; dispose: () => void } {
  const raw = Tone.getContext().rawContext;
  const input = new Tone.Gain(1);
  const dry = raw.createGain();
  dry.gain.value = 1 - wet * 0.5;
  const wetGain = raw.createGain();
  wetGain.gain.value = wet;
  const merger = raw.createChannelMerger(2);
  const delayLeft = raw.createDelay(0.05);
  delayLeft.delayTime.value = 0.016;
  const delayRight = raw.createDelay(0.05);
  delayRight.delayTime.value = 0.024;
  const lfo = raw.createOscillator();
  lfo.frequency.value = 0.6;
  const depthLeft = raw.createGain();
  depthLeft.gain.value = 0.0035;
  const depthRight = raw.createGain();
  depthRight.gain.value = -0.0042;
  lfo.connect(depthLeft);
  lfo.connect(depthRight);
  depthLeft.connect(delayLeft.delayTime);
  depthRight.connect(delayRight.delayTime);
  lfo.start();
  input.connect(delayLeft);
  input.connect(delayRight);
  input.connect(dry);
  delayLeft.connect(merger, 0, 0);
  delayRight.connect(merger, 0, 1);
  merger.connect(wetGain);
  Tone.connect(dry, destination);
  Tone.connect(wetGain, destination);
  return {
    input,
    dispose: () => {
      lfo.stop();
      for (const node of [
        dry,
        wetGain,
        merger,
        delayLeft,
        delayRight,
        lfo,
        depthLeft,
        depthRight,
      ])
        node.disconnect();
      input.dispose();
    },
  };
}

export function createVoiceInstrument(voice: VoiceDefinition): InstrumentVoice {
  const output = new Tone.Gain(1);
  const colorDisposers: (() => void)[] = [];

  // Sum → drive → chorus → output (stages disabled at 0 are skipped).
  let entry: Tone.ToneAudioNode = output;
  if (voice.chorus > 0) {
    const chorus = leanChorus(voice.chorus, entry);
    colorDisposers.push(chorus.dispose);
    entry = chorus.input;
  }
  if (voice.drive > 0) {
    const drive = new Tone.Distortion({
      distortion: voice.drive,
      wet: 1,
    }).connect(entry);
    colorDisposers.push(() => drive.dispose());
    entry = drive;
  }
  const sum = new Tone.Gain(1).connect(entry);

  const layers = voice.layers.map((layer) => buildLayer(layer, voice, sum));

  return {
    output,
    triggerNote: (pitch, durationSeconds, time, velocity) => {
      for (const layer of layers)
        layer.trigger(pitch, durationSeconds, time, velocity);
    },
    applyParam: (param, value) => {
      for (const layer of layers) layer.set({ [param]: value });
    },
    dispose: () => {
      for (const layer of layers) layer.dispose();
      for (const disposeColor of colorDisposers) disposeColor();
      sum.dispose();
      output.dispose();
    },
  };
}

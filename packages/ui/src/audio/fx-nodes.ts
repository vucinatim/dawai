import type { Fx } from "@dawai/core/document";
import * as Tone from "tone";

/**
 * Fx IR → Tone nodes, registry-driven (adding an fx type = one entry
 * here + its schema in core; a future plugin registry is just external
 * entries). Every fx exposes automatable params as a signal (rampable)
 * or a setter (stepped). Composite fx have distinct input/output.
 */

export type ParamRef =
  | { kind: "signal"; signal: Tone.Param<never> | Tone.Signal<never> }
  | { kind: "setter"; apply: (value: number) => void };

export interface FxNode {
  input: Tone.ToneAudioNode;
  output: Tone.ToneAudioNode;
  params: Record<string, ParamRef>;
  dispose: () => void;
}

type BeatsToSeconds = (beats: number) => number;
type FxFactory<Type extends Fx["type"]> = (
  fx: Extract<Fx, { type: Type }>,
  beatsToSeconds: BeatsToSeconds,
) => FxNode;

function signal(target: unknown): ParamRef {
  return { kind: "signal", signal: target as Tone.Param<never> };
}

function simple(
  node: Tone.ToneAudioNode,
  params: Record<string, ParamRef>,
): FxNode {
  return { input: node, output: node, params, dispose: () => node.dispose() };
}

const FX_FACTORIES: { [Type in Fx["type"]]: FxFactory<Type> } = {
  filter: (fx) => {
    const node = new Tone.Filter({
      type: fx.mode,
      frequency: fx.cutoff,
      Q: fx.q,
    });
    return simple(node, { cutoff: signal(node.frequency), q: signal(node.Q) });
  },
  eq: (fx) => {
    const node = new Tone.EQ3({ low: fx.low, mid: fx.mid, high: fx.high });
    return simple(node, {
      low: signal(node.low),
      mid: signal(node.mid),
      high: signal(node.high),
    });
  },
  compressor: (fx) => {
    const node = new Tone.Compressor({
      threshold: fx.threshold,
      ratio: fx.ratio,
      attack: fx.attack,
      release: fx.release,
      knee: fx.knee,
    });
    return simple(node, {
      threshold: signal(node.threshold),
      ratio: signal(node.ratio),
      attack: signal(node.attack),
      release: signal(node.release),
      knee: signal(node.knee),
    });
  },
  distortion: (fx) => {
    const node = new Tone.Distortion(fx.amount);
    return simple(node, {
      amount: {
        kind: "setter",
        apply: (value) => {
          node.distortion = Math.max(0, Math.min(1, value));
        },
      },
    });
  },
  chorus: (fx) => {
    const node = new Tone.Chorus({
      frequency: fx.rate,
      depth: fx.depth,
      wet: fx.mix,
    }).start();
    return simple(node, {
      rate: signal(node.frequency),
      mix: signal(node.wet),
      depth: {
        kind: "setter",
        apply: (value) => {
          node.depth = Math.max(0, Math.min(1, value));
        },
      },
    });
  },
  reverb: (fx) => {
    const node = new Tone.Reverb({
      decay: fx.decay,
      preDelay: fx.predelay,
      wet: fx.mix,
    });
    return simple(node, {
      mix: signal(node.wet),
      decay: {
        kind: "setter",
        apply: (value) => {
          node.decay = Math.max(0.1, value);
        },
      },
    });
  },
  delay: (fx, beatsToSeconds) => {
    const node = new Tone.FeedbackDelay({
      delayTime: beatsToSeconds(fx.time),
      feedback: fx.feedback,
      wet: fx.mix,
    });
    return simple(node, {
      time: {
        kind: "setter",
        apply: (value) =>
          node.delayTime.setValueAtTime(beatsToSeconds(value), Tone.now()),
      },
      feedback: signal(node.feedback),
      mix: signal(node.wet),
    });
  },
  limiter: (fx) => {
    const node = new Tone.Limiter(fx.ceiling);
    return simple(node, { ceiling: signal(node.threshold) });
  },
  ott: (fx) => {
    // OTT-style glue: heavy multiband squash + makeup gain. `amount`
    // maps to threshold depth and ratio across three bands.
    const threshold = -24 - fx.amount * 24;
    const ratio = 2 + fx.amount * 6;
    const band = { threshold, ratio, attack: 0.004, release: 0.12, knee: 8 };
    const multiband = new Tone.MultibandCompressor({
      lowFrequency: 250,
      highFrequency: 2500,
      low: band,
      mid: band,
      high: { ...band, attack: 0.002, release: 0.08 },
    });
    const makeup = new Tone.Gain(fx.gain, "decibels");
    multiband.connect(makeup);
    return {
      input: multiband,
      output: makeup,
      params: {
        gain: signal(makeup.gain),
        amount: {
          kind: "setter",
          apply: (value) => {
            const depth = Math.max(0, Math.min(1, value));
            const nextThreshold = -24 - depth * 24;
            multiband.low.threshold.value = nextThreshold;
            multiband.mid.threshold.value = nextThreshold;
            multiband.high.threshold.value = nextThreshold;
          },
        },
      },
      dispose: () => {
        multiband.dispose();
        makeup.dispose();
      },
    };
  },
};

export function createFxNode(fx: Fx, beatsToSeconds: BeatsToSeconds): FxNode {
  const factory = FX_FACTORIES[fx.type] as FxFactory<typeof fx.type>;
  return factory(fx, beatsToSeconds);
}

import type { Fx } from "@dawai/core/document";
import * as Tone from "tone";

/**
 * Fx IR → Tone nodes, plus the automation surface: every fx exposes its
 * automatable params either as a signal (rampable) or a setter
 * (stepped). Delay time is authored in beats; conversion to seconds
 * happens here because the renderer knows the tempo.
 */

export type ParamRef =
  | { kind: "signal"; signal: Tone.Param<never> | Tone.Signal<never> }
  | { kind: "setter"; apply: (value: number) => void };

export interface FxNode {
  node: Tone.ToneAudioNode;
  params: Record<string, ParamRef>;
  dispose: () => void;
}

function signal(target: unknown): ParamRef {
  return { kind: "signal", signal: target as Tone.Param<never> };
}

export function createFxNode(
  fx: Fx,
  beatsToSeconds: (beats: number) => number,
): FxNode {
  switch (fx.type) {
    case "filter": {
      const node = new Tone.Filter({
        type: fx.mode,
        frequency: fx.cutoff,
        Q: fx.q,
      });
      return {
        node,
        params: { cutoff: signal(node.frequency), q: signal(node.Q) },
        dispose: () => node.dispose(),
      };
    }
    case "eq": {
      const node = new Tone.EQ3({ low: fx.low, mid: fx.mid, high: fx.high });
      return {
        node,
        params: {
          low: signal(node.low),
          mid: signal(node.mid),
          high: signal(node.high),
        },
        dispose: () => node.dispose(),
      };
    }
    case "compressor": {
      const node = new Tone.Compressor({
        threshold: fx.threshold,
        ratio: fx.ratio,
        attack: fx.attack,
        release: fx.release,
        knee: fx.knee,
      });
      return {
        node,
        params: {
          threshold: signal(node.threshold),
          ratio: signal(node.ratio),
          attack: signal(node.attack),
          release: signal(node.release),
          knee: signal(node.knee),
        },
        dispose: () => node.dispose(),
      };
    }
    case "distortion": {
      const node = new Tone.Distortion(fx.amount);
      return {
        node,
        params: {
          amount: {
            kind: "setter",
            apply: (value) => {
              node.distortion = Math.max(0, Math.min(1, value));
            },
          },
        },
        dispose: () => node.dispose(),
      };
    }
    case "chorus": {
      const node = new Tone.Chorus({
        frequency: fx.rate,
        depth: fx.depth,
        wet: fx.mix,
      }).start();
      return {
        node,
        params: {
          rate: signal(node.frequency),
          mix: signal(node.wet),
          depth: {
            kind: "setter",
            apply: (value) => {
              node.depth = Math.max(0, Math.min(1, value));
            },
          },
        },
        dispose: () => node.dispose(),
      };
    }
    case "reverb": {
      const node = new Tone.Reverb({
        decay: fx.decay,
        preDelay: fx.predelay,
        wet: fx.mix,
      });
      return {
        node,
        params: {
          mix: signal(node.wet),
          decay: {
            kind: "setter",
            apply: (value) => {
              node.decay = Math.max(0.1, value);
            },
          },
        },
        dispose: () => node.dispose(),
      };
    }
    case "delay": {
      const node = new Tone.FeedbackDelay({
        delayTime: beatsToSeconds(fx.time),
        feedback: fx.feedback,
        wet: fx.mix,
      });
      return {
        node,
        params: {
          time: {
            kind: "setter",
            apply: (value) =>
              node.delayTime.setValueAtTime(beatsToSeconds(value), Tone.now()),
          },
          feedback: signal(node.feedback),
          mix: signal(node.wet),
        },
        dispose: () => node.dispose(),
      };
    }
    case "limiter": {
      const node = new Tone.Limiter(fx.ceiling);
      return {
        node,
        params: { ceiling: signal(node.threshold) },
        dispose: () => node.dispose(),
      };
    }
  }
}

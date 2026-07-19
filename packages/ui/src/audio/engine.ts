import type { AutomationLane, Document, Track } from "@dawai/core/document";
import { SYNTH_PRESETS } from "@dawai/core/presets";
import { beatsPerBar } from "@dawai/core/time";
import { resolveVoice } from "@dawai/core/voice";
import * as Tone from "tone";
import { createKitVoices, type KitVoices } from "./drum-voices";
import { createFxNode, type FxNode, type ParamRef } from "./fx-nodes";
import { nodeCreationCount, warnIfGraphOverBudget } from "./node-budget";
import { createVoiceInstrument, type InstrumentVoice } from "./voice-builder";

/**
 * The audio renderer: builds a Tone graph from a Document and plays it
 * under the lookahead transport. Disposable/rebuildable — a new
 * Document hot-swaps at the next bar boundary without stopping the
 * transport (architecture boundary 6). This module owns all Tone usage
 * for playback; nothing outside packages/ui may know Tone exists.
 *
 * Signal chain per track:
 *   voice → fx… → staticGain(dB) → duckGain(dB) → authoredMute → monitorGain → panner → bus|master
 */

interface TrackGraph {
  track: Track;
  voice: InstrumentVoice | KitVoices | null;
  fxNodes: FxNode[];
  staticGain: Tone.Gain<"decibels">;
  duckGain: Tone.Gain<"decibels">;
  authoredMute: Tone.Gain;
  panner: Tone.Panner;
  monitorGain: Tone.Gain;
}

interface BusGraph {
  input: Tone.Gain;
  fxNodes: FxNode[];
  gain: Tone.Gain<"decibels">;
}

export interface EngineCallbacks {
  onPlayingChanged: (isPlaying: boolean) => void;
  onPlayhead: (beats: number) => void;
}

export class AudioEngine {
  private document: Document | null = null;
  private trackGraphs = new Map<string, TrackGraph>();
  private busGraphs = new Map<string, BusGraph>();
  private masterFxNodes: FxNode[] = [];
  private masterInput: Tone.Gain | null = null;
  private parts: Tone.Part[] = [];
  private scheduledIds: number[] = [];
  private contextStarted = false;
  private playheadFrame = 0;
  private callbacks: EngineCallbacks = {
    onPlayingChanged: () => {},
    onPlayhead: () => {},
  };
  private monitoring: { soloed: string[]; listenMuted: string[] } = {
    soloed: [],
    listenMuted: [],
  };

  setCallbacks(callbacks: EngineCallbacks): void {
    this.callbacks = callbacks;
  }

  private beatsToSeconds(beats: number): number {
    const tempo = this.document?.tempo ?? 120;
    return (beats * 60) / tempo;
  }

  private currentBeats(): number {
    const tempo = this.document?.tempo ?? 120;
    return (Tone.getTransport().seconds * tempo) / 60;
  }

  /** Initial load, or hot swap at the next bar when the transport runs. */
  loadDocument(document: Document): void {
    const transport = Tone.getTransport();
    if (this.document && transport.state === "started") {
      const perBar = beatsPerBar(this.document.timeSignature);
      const nextBarBeat =
        (Math.floor(this.currentBeats() / perBar) + 1) * perBar;
      const id = transport.scheduleOnce(
        () => this.rebuild(document),
        this.beatsToSeconds(nextBarBeat),
      );
      this.scheduledIds.push(id);
    } else {
      this.rebuild(document);
    }
  }

  private rebuild(document: Document): void {
    this.teardown();
    this.document = document;
    const nodesBefore = nodeCreationCount();

    const transport = Tone.getTransport();
    transport.bpm.value = document.tempo;
    transport.timeSignature = document.timeSignature[0];

    this.masterInput = new Tone.Gain(1);
    let masterTail: Tone.ToneAudioNode = this.masterInput;
    for (const fx of document.master.fx) {
      const fxNode = createFxNode(fx, (beats) => this.beatsToSeconds(beats));
      masterTail.connect(fxNode.input);
      masterTail = fxNode.output;
      this.masterFxNodes.push(fxNode);
    }
    masterTail.toDestination();

    for (const bus of document.buses) {
      const input = new Tone.Gain(1);
      const gain = new Tone.Gain(bus.gain, "decibels");
      const fxNodes: FxNode[] = [];
      let tail: Tone.ToneAudioNode = input;
      for (const fx of bus.fx) {
        const fxNode = createFxNode(fx, (beats) => this.beatsToSeconds(beats));
        tail.connect(fxNode.input);
        tail = fxNode.output;
        fxNodes.push(fxNode);
      }
      tail.connect(gain);
      gain.connect(this.masterInput);
      this.busGraphs.set(bus.id, { input, fxNodes, gain });
    }

    for (const track of document.tracks) {
      this.buildTrack(track);
    }

    for (const lane of document.automation) {
      this.scheduleAutomation(lane);
    }

    this.applyMonitoring(this.monitoring.soloed, this.monitoring.listenMuted);
    warnIfGraphOverBudget(nodeCreationCount() - nodesBefore);
  }

  private buildTrack(track: Track): void {
    const voice = this.createVoice(track);
    const fxNodes: FxNode[] = [];
    const staticGain = new Tone.Gain(track.gain, "decibels");
    const duckGain = new Tone.Gain(0, "decibels");
    const authoredMute = new Tone.Gain(track.mute ? 0 : 1);
    const monitorGain = new Tone.Gain(1);
    const panner = new Tone.Panner(track.pan);

    let tail: Tone.ToneAudioNode | null = voice ? voice.output : null;
    for (const fx of track.fx) {
      const fxNode = createFxNode(fx, (beats) => this.beatsToSeconds(beats));
      tail?.connect(fxNode.input);
      tail = fxNode.output;
      fxNodes.push(fxNode);
    }
    tail?.connect(staticGain);
    staticGain.connect(duckGain);
    duckGain.connect(authoredMute);
    authoredMute.connect(monitorGain);
    monitorGain.connect(panner);

    const destination =
      track.out === "master"
        ? this.masterInput
        : (this.busGraphs.get(track.out)?.input ?? null);
    if (destination) panner.connect(destination);

    this.trackGraphs.set(track.id, {
      track,
      voice,
      fxNodes,
      staticGain,
      duckGain,
      authoredMute,
      panner,
      monitorGain,
    });

    if (!voice) return;
    for (const clip of track.clips) {
      const events = clip.notes.map(([start, pitch, length, velocity]) => ({
        time: this.beatsToSeconds(clip.start + start),
        pitch,
        durationSeconds: this.beatsToSeconds(length),
        velocity: velocity / 127,
      }));
      const part = new Tone.Part((time, event) => {
        if ("triggerPitch" in voice) {
          voice.triggerPitch(event.pitch, time, event.velocity);
        } else {
          voice.triggerNote(
            event.pitch,
            event.durationSeconds,
            time,
            event.velocity,
          );
        }
      }, events).start(0);
      this.parts.push(part);
    }
  }

  private createVoice(track: Track): InstrumentVoice | KitVoices | null {
    switch (track.instrument.kind) {
      case "synth":
        return createVoiceInstrument(
          resolveVoice(
            SYNTH_PRESETS[track.instrument.preset],
            track.instrument.params,
          ),
        );
      case "voice":
        return createVoiceInstrument(track.instrument.voice);
      case "sampler":
        return createKitVoices(
          track.instrument.kit,
          new Set(
            track.clips.flatMap((clip) => clip.notes.map(([, pitch]) => pitch)),
          ),
        );
      case "sample":
        // Tier 2: sample-file playback. Render silence rather than
        // failing the whole song for one unrenderable track.
        console.warn(
          `dawai: track "${track.id}" uses a sample instrument — not rendered in v0 (Tier 2).`,
        );
        return null;
    }
  }

  private resolveParam(lane: AutomationLane): ParamRef | null {
    const { owner, path } = lane.target;
    if (owner.type === "track") {
      const graph = this.trackGraphs.get(owner.id);
      if (!graph) return null;
      if (path === "gain")
        return { kind: "signal", signal: graph.staticGain.gain as never };
      if (path === "duck")
        return { kind: "signal", signal: graph.duckGain.gain as never };
      if (path === "pan")
        return { kind: "signal", signal: graph.panner.pan as never };
      const fxMatch = /^fx\.(\d+)\.([a-zA-Z]+)$/.exec(path);
      if (fxMatch) {
        return (
          graph.fxNodes[Number(fxMatch[1])]?.params[fxMatch[2] as string] ??
          null
        );
      }
      const instrumentMatch = /^instrument\.([a-zA-Z]+)$/.exec(path);
      if (instrumentMatch && graph.voice && "applyParam" in graph.voice) {
        const voice = graph.voice;
        const param = instrumentMatch[1] as string;
        return {
          kind: "setter",
          apply: (value) => voice.applyParam(param, value),
        };
      }
      return null;
    }
    if (owner.type === "bus") {
      const graph = this.busGraphs.get(owner.id);
      if (!graph) return null;
      if (path === "gain")
        return { kind: "signal", signal: graph.gain.gain as never };
      if (path === "duck")
        return { kind: "signal", signal: graph.gain.gain as never };
      const fxMatch = /^fx\.(\d+)\.([a-zA-Z]+)$/.exec(path);
      if (fxMatch)
        return (
          graph.fxNodes[Number(fxMatch[1])]?.params[fxMatch[2] as string] ??
          null
        );
      return null;
    }
    const fxMatch = /^fx\.(\d+)\.([a-zA-Z]+)$/.exec(path);
    if (fxMatch)
      return (
        this.masterFxNodes[Number(fxMatch[1])]?.params[fxMatch[2] as string] ??
        null
      );
    return null;
  }

  private scheduleAutomation(lane: AutomationLane): void {
    const paramRef = this.resolveParam(lane);
    if (!paramRef) return;

    // Same-beat pairs are jumps: keep the later point as the value.
    const points = lane.points.filter(
      (point, index) => lane.points[index + 1]?.beat !== point.beat,
    );
    const first = points[0];
    if (!first) return;

    // Before the first point the param holds the first point's value.
    if (paramRef.kind === "signal")
      paramRef.signal.value = first.value as never;
    else paramRef.apply(first.value);

    const part = new Tone.Part(
      (time, event: { index: number }) => {
        const point = points[event.index] as (typeof points)[number];
        const next = points[event.index + 1];
        if (paramRef.kind === "setter") {
          paramRef.apply(point.value);
          return;
        }
        const signal = paramRef.signal as unknown as Tone.Signal;
        signal.cancelScheduledValues(time);
        signal.setValueAtTime(point.value, time);
        if (next && next.curve !== "step") {
          const rampEnd = time + this.beatsToSeconds(next.beat - point.beat);
          if (next.curve === "exp" && point.value > 0 && next.value > 0) {
            signal.exponentialRampToValueAtTime(next.value, rampEnd);
          } else {
            signal.linearRampToValueAtTime(next.value, rampEnd);
          }
        }
      },
      points.map((point, index) => ({
        time: this.beatsToSeconds(point.beat),
        index,
      })),
    ).start(0);
    this.parts.push(part);
  }

  private async ensureContext(): Promise<void> {
    if (!this.contextStarted) {
      await Tone.start();
      this.contextStarted = true;
    }
  }

  async play(fromBeat?: number): Promise<void> {
    if (!this.document) return;
    await this.ensureContext();
    const transport = Tone.getTransport();
    if (fromBeat !== undefined)
      transport.seconds = this.beatsToSeconds(fromBeat);
    transport.start();
    this.callbacks.onPlayingChanged(true);
    this.startPlayheadLoop();
  }

  stop(): void {
    const transport = Tone.getTransport();
    transport.stop();
    transport.seconds = 0;
    cancelAnimationFrame(this.playheadFrame);
    this.callbacks.onPlayingChanged(false);
    this.callbacks.onPlayhead(0);
  }

  /**
   * Move the playhead; works both while playing and while stopped.
   * While playing, an in-place position jump leaves scheduled parts in
   * an inconsistent state — pause, reposition, resume instead.
   */
  seek(beats: number): void {
    const transport = Tone.getTransport();
    const wasStarted = transport.state === "started";
    if (wasStarted) transport.pause();
    transport.seconds = this.beatsToSeconds(beats);
    if (wasStarted) transport.start();
    this.callbacks.onPlayhead(beats);
  }

  setLoopRegion(region: { startBeat: number; endBeat: number } | null): void {
    const transport = Tone.getTransport();
    if (region) {
      transport.setLoopPoints(
        this.beatsToSeconds(region.startBeat),
        this.beatsToSeconds(region.endBeat),
      );
      transport.loop = true;
    } else {
      transport.loop = false;
    }
  }

  /** Solo / listen-mute monitoring — renderer gains only, never the Document. */
  applyMonitoring(
    soloedTrackIds: string[],
    listenMutedTrackIds: string[],
  ): void {
    this.monitoring = {
      soloed: soloedTrackIds,
      listenMuted: listenMutedTrackIds,
    };
    for (const [trackId, graph] of this.trackGraphs) {
      const audible =
        (soloedTrackIds.length === 0 || soloedTrackIds.includes(trackId)) &&
        !listenMutedTrackIds.includes(trackId);
      graph.monitorGain.gain.rampTo(audible ? 1 : 0, 0.02);
    }
  }

  private startPlayheadLoop(): void {
    cancelAnimationFrame(this.playheadFrame);
    const tick = () => {
      if (Tone.getTransport().state !== "started") return;
      this.callbacks.onPlayhead(this.currentBeats());
      this.playheadFrame = requestAnimationFrame(tick);
    };
    this.playheadFrame = requestAnimationFrame(tick);
  }

  private teardown(): void {
    for (const id of this.scheduledIds) Tone.getTransport().clear(id);
    this.scheduledIds = [];
    for (const part of this.parts) part.dispose();
    this.parts = [];
    for (const graph of this.trackGraphs.values()) {
      graph.voice?.dispose();
      for (const fxNode of graph.fxNodes) fxNode.dispose();
      graph.staticGain.dispose();
      graph.duckGain.dispose();
      graph.authoredMute.dispose();
      graph.panner.dispose();
      graph.monitorGain.dispose();
    }
    this.trackGraphs.clear();
    for (const graph of this.busGraphs.values()) {
      graph.input.dispose();
      for (const fxNode of graph.fxNodes) fxNode.dispose();
      graph.gain.dispose();
    }
    this.busGraphs.clear();
    for (const fxNode of this.masterFxNodes) fxNode.dispose();
    this.masterFxNodes = [];
    this.masterInput?.dispose();
    this.masterInput = null;
  }
}

export const audioEngine = new AudioEngine();

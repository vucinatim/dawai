import { useDocumentStore } from "@/stores/document-store";
import { useRuntimeStore } from "@/stores/runtime-store";
import { audioEngine } from "./engine";

/**
 * The one place stores and the audio engine meet. Data flows one way
 * per concern: document/monitoring state → engine; transport reality
 * (playing, playhead) → runtime store. Components never talk to the
 * engine directly except through the exported transport intents.
 */

export function initializeAudioEngine(): void {
  audioEngine.setCallbacks({
    onPlayingChanged: (isPlaying) =>
      useRuntimeStore.getState().actions.setPlaying(isPlaying),
    onPlayhead: (beats) =>
      useRuntimeStore.getState().actions.setPlayhead(beats),
  });

  useDocumentStore.subscribe((state, previous) => {
    if (state.document && state.revision !== previous.revision) {
      audioEngine.loadDocument(state.document);
    }
  });

  useRuntimeStore.subscribe((state, previous) => {
    if (
      state.soloedTrackIds !== previous.soloedTrackIds ||
      state.listenMutedTrackIds !== previous.listenMutedTrackIds
    ) {
      audioEngine.applyMonitoring(
        state.soloedTrackIds,
        state.listenMutedTrackIds,
      );
    }
    if (state.loop !== previous.loop) {
      audioEngine.setLoopRegion(state.loop);
    }
  });
}

/** Transport intents for components (the play button doesn't know Tone exists). */
export const transportControls = {
  play: (fromBeat?: number) => void audioEngine.play(fromBeat),
  stop: () => audioEngine.stop(),
  seek: (beats: number) => audioEngine.seek(beats),
  togglePlay: () => {
    if (useRuntimeStore.getState().isPlaying) audioEngine.stop();
    else void audioEngine.play();
  },
};

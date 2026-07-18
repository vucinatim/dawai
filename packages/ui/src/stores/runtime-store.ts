import { create } from "zustand";

/**
 * Runtime state: everything ephemeral — transport, playhead, selection,
 * monitoring, viewport, panel mode, compile errors. Never persisted,
 * never part of the Document (architecture boundary 2). Components
 * subscribe via the narrow selector hooks below; all writes go through
 * named actions.
 */

export type DetailMode = "device" | "clip";

export interface Selection {
  trackId: string | null;
  clipId: string | null;
  /** "bus:<id>" or "master" when a mixer node is selected instead. */
  busId: string | null;
}

export interface LoopRegion {
  startBeat: number;
  endBeat: number;
}

export interface CompileErrorState {
  message: string;
  stage: string;
}

interface RuntimeState {
  isPlaying: boolean;
  playheadBeats: number;
  loop: LoopRegion | null;
  selection: Selection;
  detailMode: DetailMode;
  /** Track ids soloed / listen-muted for monitoring (renderer gains only). */
  soloedTrackIds: string[];
  listenMutedTrackIds: string[];
  /** Horizontal zoom of the arrangement. */
  pixelsPerBeat: number;
  /** True once the user zoomed manually — fit-to-width stops overriding. */
  hasUserZoomed: boolean;
  followPlayhead: boolean;
  compileError: CompileErrorState | null;
  actions: {
    setPlaying: (isPlaying: boolean) => void;
    setPlayhead: (beats: number) => void;
    setLoop: (loop: LoopRegion | null) => void;
    selectTrack: (trackId: string) => void;
    selectClip: (trackId: string, clipId: string) => void;
    selectBus: (busId: string) => void;
    clearSelection: () => void;
    setDetailMode: (mode: DetailMode) => void;
    toggleSolo: (trackId: string) => void;
    toggleListenMute: (trackId: string) => void;
    zoomBy: (factor: number) => void;
    fitZoom: (pixelsPerBeat: number) => void;
    toggleFollowPlayhead: () => void;
    setFollowPlayhead: (followPlayhead: boolean) => void;
    setCompileError: (error: CompileErrorState | null) => void;
  };
}

const EMPTY_SELECTION: Selection = { trackId: null, clipId: null, busId: null };

function toggled(list: string[], id: string): string[] {
  return list.includes(id)
    ? list.filter((entry) => entry !== id)
    : [...list, id];
}

export const useRuntimeStore = create<RuntimeState>()((set) => ({
  isPlaying: false,
  playheadBeats: 0,
  loop: null,
  selection: EMPTY_SELECTION,
  detailMode: "device",
  soloedTrackIds: [],
  listenMutedTrackIds: [],
  pixelsPerBeat: 6,
  hasUserZoomed: false,
  followPlayhead: true,
  compileError: null,
  actions: {
    setPlaying: (isPlaying) => set({ isPlaying }),
    setPlayhead: (playheadBeats) => set({ playheadBeats }),
    setLoop: (loop) => set({ loop }),
    selectTrack: (trackId) =>
      set({
        selection: { trackId, clipId: null, busId: null },
        detailMode: "device",
      }),
    selectClip: (trackId, clipId) =>
      set({ selection: { trackId, clipId, busId: null }, detailMode: "clip" }),
    selectBus: (busId) =>
      set({
        selection: { trackId: null, clipId: null, busId },
        detailMode: "device",
      }),
    clearSelection: () => set({ selection: EMPTY_SELECTION }),
    setDetailMode: (detailMode) => set({ detailMode }),
    toggleSolo: (trackId) =>
      set((state) => ({
        soloedTrackIds: toggled(state.soloedTrackIds, trackId),
      })),
    toggleListenMute: (trackId) =>
      set((state) => ({
        listenMutedTrackIds: toggled(state.listenMutedTrackIds, trackId),
      })),
    zoomBy: (factor) =>
      set((state) => ({
        hasUserZoomed: true,
        pixelsPerBeat: Math.min(
          48,
          Math.max(0.5, state.pixelsPerBeat * factor),
        ),
      })),
    /** Fit-to-width zoom applied on load — doesn't count as user zoom. */
    fitZoom: (pixelsPerBeat) =>
      set({ pixelsPerBeat: Math.min(48, Math.max(0.5, pixelsPerBeat)) }),
    toggleFollowPlayhead: () =>
      set((state) => ({ followPlayhead: !state.followPlayhead })),
    setFollowPlayhead: (followPlayhead) => set({ followPlayhead }),
    setCompileError: (compileError) => set({ compileError }),
  },
}));

export const useIsPlaying = () => useRuntimeStore((state) => state.isPlaying);
export const usePlayheadBeats = () =>
  useRuntimeStore((state) => state.playheadBeats);
export const useLoop = () => useRuntimeStore((state) => state.loop);
export const useSelection = () => useRuntimeStore((state) => state.selection);
export const useDetailMode = () => useRuntimeStore((state) => state.detailMode);
export const useSoloedTrackIds = () =>
  useRuntimeStore((state) => state.soloedTrackIds);
export const useListenMutedTrackIds = () =>
  useRuntimeStore((state) => state.listenMutedTrackIds);
export const usePixelsPerBeat = () =>
  useRuntimeStore((state) => state.pixelsPerBeat);
export const useCompileError = () =>
  useRuntimeStore((state) => state.compileError);
export const runtimeActions = () => useRuntimeStore.getState().actions;

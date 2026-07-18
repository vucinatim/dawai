import type { Bus, Clip, Track } from "@dawai/core/document";
import { documentLengthBeats } from "@dawai/core/stats";
import { useDocumentStore } from "./document-store";
import { useRuntimeStore } from "./runtime-store";

/**
 * Derived read hooks over the Document. Object identities inside a
 * Document are stable per revision (documents are replaced wholesale),
 * so find()-based selectors stay referentially stable between feeds.
 */

export function useTracks(): Track[] {
  return useDocumentStore((state) => state.document?.tracks ?? EMPTY_TRACKS);
}

const EMPTY_TRACKS: Track[] = [];

export function useTrack(trackId: string | null): Track | null {
  return useDocumentStore(
    (state) =>
      state.document?.tracks.find((track) => track.id === trackId) ?? null,
  );
}

export function useSelectedTrack(): Track | null {
  const trackId = useRuntimeStore((state) => state.selection.trackId);
  return useTrack(trackId);
}

export function useSelectedClip(): { track: Track; clip: Clip } | null {
  const selection = useRuntimeStore((state) => state.selection);
  const track = useTrack(selection.trackId);
  const clip =
    track?.clips.find((candidate) => candidate.id === selection.clipId) ?? null;
  return track && clip ? { track, clip } : null;
}

export function useSelectedBus(): Bus | "master" | null {
  const busId = useRuntimeStore((state) => state.selection.busId);
  return useDocumentStore((state) => {
    if (!state.document || !busId) return null;
    if (busId === "master") return "master";
    return state.document.buses.find((bus) => bus.id === busId) ?? null;
  });
}

export function useSongLengthBeats(): number {
  return useDocumentStore((state) =>
    state.document ? documentLengthBeats(state.document) : 0,
  );
}

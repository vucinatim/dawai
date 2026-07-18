import type { Document } from "@dawai/core/document";
import { create } from "zustand";

/**
 * The Document store: the UI's read-only mirror of the compiled song.
 * `feedDocument` is the single write path and the goal-3 seam — today a
 * fixture feeds it once at startup; later the server's WebSocket feeds
 * it on every recompile. Nothing else in the UI may mutate a Document.
 */

interface DocumentState {
  document: Document | null;
  /** Increments per feed — the audio engine's hot-swap trigger. */
  revision: number;
  actions: {
    feedDocument: (document: Document) => void;
  };
}

export const useDocumentStore = create<DocumentState>()((set) => ({
  document: null,
  revision: 0,
  actions: {
    feedDocument: (document) =>
      set((state) => ({ document, revision: state.revision + 1 })),
  },
}));

export const useDocument = () => useDocumentStore((state) => state.document);
export const documentActions = () => useDocumentStore.getState().actions;

import { useEffect, useRef } from "react";
import { useRuntimeStore } from "@/stores/runtime-store";

/**
 * The playhead line. Positioned via a direct store subscription and a
 * transform — no React re-render per animation frame.
 */
export function Playhead() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const apply = () => {
      const state = useRuntimeStore.getState();
      if (ref.current) {
        ref.current.style.transform = `translateX(${state.playheadBeats * state.pixelsPerBeat}px)`;
      }
    };
    apply();
    return useRuntimeStore.subscribe(apply);
  }, []);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-y-0 left-0 z-10 w-px bg-daw-accent"
    />
  );
}

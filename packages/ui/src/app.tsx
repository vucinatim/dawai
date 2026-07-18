import { useEffect } from "react";
import { transportControls } from "@/audio/engine-bridge";
import { ArrangementView } from "@/components/arrangement/arrangement-view";
import { ControlBar } from "@/components/control-bar";
import { DetailPanel } from "@/components/detail/detail-panel";
import { ErrorOverlay } from "@/components/error-overlay";
import { useDocument } from "@/stores/document-store";

export function App() {
  useSpacebarTransport();
  const document = useDocument();

  if (!document) {
    return (
      <div className="flex h-svh items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading song…</p>
      </div>
    );
  }

  return (
    <div className="flex h-svh select-none flex-col">
      <ControlBar />
      <ArrangementView />
      <DetailPanel />
      <ErrorOverlay />
    </div>
  );
}

function useSpacebarTransport() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      event.preventDefault();
      transportControls.togglePlay();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

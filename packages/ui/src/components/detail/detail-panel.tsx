import { ClipView } from "@/components/detail/clip-view";
import { DeviceView } from "@/components/detail/device-view";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  useSelectedBus,
  useSelectedClip,
  useSelectedTrack,
} from "@/stores/document-selectors";
import { useDetailMode, useRuntimeStore } from "@/stores/runtime-store";

/**
 * Ableton's bottom panel: Device view (selected track/bus chain) or
 * Clip view (selected clip's piano roll), driven by selection.
 */
export function DetailPanel() {
  const mode = useDetailMode();
  return (
    <section className="flex h-60 shrink-0 flex-col border-t">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b px-2">
        <ToggleGroup
          size="sm"
          variant="outline"
          value={[mode]}
          onValueChange={(value) => {
            const next = value[0];
            if (next === "device" || next === "clip") {
              useRuntimeStore.getState().actions.setDetailMode(next);
            }
          }}
        >
          <ToggleGroupItem value="device">Device</ToggleGroupItem>
          <ToggleGroupItem value="clip">Clip</ToggleGroupItem>
        </ToggleGroup>
        <Separator orientation="vertical" className="h-4" />
        <ContextLabel />
      </div>
      <div className="min-h-0 flex-1">
        {mode === "device" ? <DeviceView /> : <ClipView />}
      </div>
    </section>
  );
}

function ContextLabel() {
  const track = useSelectedTrack();
  const selectedClip = useSelectedClip();
  const bus = useSelectedBus();
  const label =
    selectedClip !== null
      ? `${selectedClip.track.name} · ${selectedClip.clip.id}`
      : track
        ? track.name
        : bus === "master"
          ? "master"
          : bus
            ? `bus · ${bus.id}`
            : "nothing selected";
  return (
    <span className="truncate text-xs text-muted-foreground">{label}</span>
  );
}

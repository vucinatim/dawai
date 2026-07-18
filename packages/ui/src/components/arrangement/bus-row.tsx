import { cn } from "@/lib/utils";
import type { ArrangementRow } from "@/stores/document-selectors";
import { useDocumentStore } from "@/stores/document-store";
import { useRuntimeStore } from "@/stores/runtime-store";

/**
 * Ableton-style bus/master rows in the arrangement: clipless strips
 * closing their track cluster. Selecting one opens its chain in the
 * device panel. Lane shows the chain summary; header shows name + gain.
 */

type BusRowModel = Extract<ArrangementRow, { kind: "bus" | "master" }>;

function rowIdentity(row: BusRowModel): string {
  return row.kind === "bus" ? row.bus.id : "master";
}

function useIsRowSelected(row: BusRowModel): boolean {
  const busId = rowIdentity(row);
  return useRuntimeStore((state) => state.selection.busId === busId);
}

export function BusLane({ row }: { row: BusRowModel }) {
  const isSelected = useIsRowSelected(row);
  const masterFx = useDocumentStore((state) => state.document?.master.fx ?? []);
  const chain = row.kind === "bus" ? row.bus.fx : masterFx;
  const summary = chain.map((fx) => fx.type).join(" → ") || "(no fx)";

  return (
    <button
      type="button"
      className={cn(
        "block h-9 w-full border-b border-daw-grid bg-background/60 px-2 text-left",
        isSelected && "bg-daw-lane-alt",
      )}
      onClick={() =>
        useRuntimeStore.getState().actions.selectBus(rowIdentity(row))
      }
    >
      <span className="font-mono text-[9px] text-muted-foreground">
        {summary}
      </span>
    </button>
  );
}

export function BusHeader({ row }: { row: BusRowModel }) {
  const isSelected = useIsRowSelected(row);
  const name = rowIdentity(row);

  return (
    <button
      type="button"
      className={cn(
        "flex h-9 w-full items-center justify-between border-b px-2 text-left",
        isSelected ? "bg-accent" : "hover:bg-accent/50",
      )}
      onClick={() => useRuntimeStore.getState().actions.selectBus(name)}
    >
      <span className="truncate text-xs font-medium text-muted-foreground">
        {name}
      </span>
      <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        {row.kind === "bus"
          ? `bus ${row.bus.gain > 0 ? "+" : ""}${row.bus.gain}dB`
          : "master"}
      </span>
    </button>
  );
}

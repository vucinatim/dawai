import { Badge } from "@/components/ui/badge";
import { useCompileError } from "@/stores/runtime-store";

/**
 * Vite-style compile-error overlay: the preview keeps rendering (and
 * playing) the last-good Document underneath; this floats the
 * diagnostic on top. Fed by the goal-3 server; nothing dismisses it
 * except a successful recompile.
 */
export function ErrorOverlay() {
  const error = useCompileError();
  if (!error) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-md border border-destructive/50 bg-popover p-3 shadow-lg">
        <div className="mb-1.5 flex items-center gap-2">
          <Badge variant="destructive">compile failed</Badge>
          <span className="font-mono text-[10px] text-muted-foreground">
            {error.stage}
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            playing last-good document
          </span>
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-destructive">
          {error.message}
        </pre>
      </div>
    </div>
  );
}

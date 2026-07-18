/**
 * One read-only device in the chain: a titled module with a dense
 * label/value param grid — Ableton's device view, preview-only.
 */
export function DeviceModule({
  title,
  subtitle,
  params,
}: {
  title: string;
  subtitle?: string;
  params: [label: string, value: string][];
}) {
  return (
    <div className="flex w-44 shrink-0 flex-col border-r">
      <div className="flex items-baseline justify-between border-b bg-daw-lane px-2 py-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          {title}
        </span>
        {subtitle && (
          <span className="truncate font-mono text-[9px] text-muted-foreground">
            {subtitle}
          </span>
        )}
      </div>
      <div className="grid flex-1 auto-rows-min grid-cols-2 gap-x-2 gap-y-0.5 overflow-y-auto px-2 py-1.5">
        {params.map(([label, value]) => (
          <ParamRow key={label} label={label} value={value} />
        ))}
      </div>
    </div>
  );
}

function ParamRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="truncate text-[10px] text-muted-foreground">
        {label}
      </span>
      <span className="text-right font-mono text-[10px] tabular-nums">
        {value}
      </span>
    </>
  );
}

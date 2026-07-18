import type { Fx, Instrument, Track } from "@dawai/core/document";
import { KITS } from "@dawai/core/kits";
import { SYNTH_PRESETS } from "@dawai/core/presets";
import { ArrowRightIcon } from "lucide-react";
import { DeviceModule } from "@/components/detail/device-module";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { useSelectedBus, useSelectedTrack } from "@/stores/document-selectors";
import { useDocumentStore } from "@/stores/document-store";
import { useRuntimeStore } from "@/stores/runtime-store";

/**
 * The selected track's signal chain as horizontal device modules:
 * instrument → fx… → mix, ending in a routing chip that jumps to the
 * destination bus (whose own chain then shows here).
 */
export function DeviceView() {
  const track = useSelectedTrack();
  const bus = useSelectedBus();
  const masterFx = useDocumentStore((state) => state.document?.master.fx ?? []);

  if (track) return <TrackChain track={track} />;
  if (bus === "master") return <FxChain title="master" fx={masterFx} />;
  if (bus) return <BusChain busId={bus.id} fx={bus.fx} gain={bus.gain} />;

  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyTitle>Nothing selected</EmptyTitle>
        <EmptyDescription>
          Select a track header or a clip in the arrangement to see its devices.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function TrackChain({ track }: { track: Track }) {
  return (
    <div className="flex h-full items-stretch overflow-x-auto">
      <InstrumentModule instrument={track.instrument} />
      {keyedChain(track.fx).map((entry) => (
        <DeviceModule
          key={entry.key}
          title={entry.fx.type}
          params={fxParams(entry.fx)}
        />
      ))}
      <DeviceModule
        title="mix"
        params={[
          ["gain", `${track.gain > 0 ? "+" : ""}${track.gain} dB`],
          [
            "pan",
            track.pan === 0
              ? "C"
              : track.pan > 0
                ? `R${track.pan}`
                : `L${-track.pan}`,
          ],
          ["mute", track.mute ? "on (authored)" : "off"],
        ]}
      />
      <RouteChip out={track.out} />
    </div>
  );
}

function BusChain({
  busId,
  fx,
  gain,
}: {
  busId: string;
  fx: Fx[];
  gain: number;
}) {
  return (
    <div className="flex h-full items-stretch overflow-x-auto">
      <DeviceModule
        title="bus"
        subtitle={busId}
        params={[["gain", `${gain} dB`]]}
      />
      {keyedChain(fx).map((entry) => (
        <DeviceModule
          key={entry.key}
          title={entry.fx.type}
          params={fxParams(entry.fx)}
        />
      ))}
      <RouteChip out="master" />
    </div>
  );
}

function FxChain({ title, fx }: { title: string; fx: Fx[] }) {
  return (
    <div className="flex h-full items-stretch overflow-x-auto">
      <DeviceModule title={title} params={[]} />
      {keyedChain(fx).map((entry) => (
        <DeviceModule
          key={entry.key}
          title={entry.fx.type}
          params={fxParams(entry.fx)}
        />
      ))}
    </div>
  );
}

function InstrumentModule({ instrument }: { instrument: Instrument }) {
  if (instrument.kind === "synth") {
    const preset = SYNTH_PRESETS[instrument.preset];
    return (
      <DeviceModule
        title="synth"
        subtitle={instrument.preset}
        params={[
          ["osc", preset.oscillator.type],
          ["voices", String(preset.oscillator.voices)],
          ["attack", `${preset.envelope.attack}s`],
          ["release", `${preset.envelope.release}s`],
          ["filter", `${preset.filter.mode} ${preset.filter.cutoff}Hz`],
          ...Object.entries(instrument.params).map(
            ([key, value]) => [key, String(value)] as [string, string],
          ),
        ]}
      />
    );
  }
  if (instrument.kind === "sampler") {
    const padCount = Object.keys(KITS[instrument.kit]).length;
    return (
      <DeviceModule
        title="sampler"
        subtitle={instrument.kit}
        params={[
          ["pads", String(padCount)],
          ["voices", "synthesized"],
        ]}
      />
    );
  }
  return (
    <DeviceModule
      title="sample"
      subtitle={instrument.source}
      params={[["playback", "not rendered (v0)"]]}
    />
  );
}

function RouteChip({ out }: { out: string }) {
  const selectRoute = () => {
    const actions = useRuntimeStore.getState().actions;
    actions.selectBus(out === "master" ? "master" : out);
  };
  return (
    <div className="flex items-center px-3">
      <Button variant="outline" size="xs" onClick={selectRoute}>
        <ArrowRightIcon data-icon="inline-start" />
        {out}
      </Button>
    </div>
  );
}

/** Chain position is a device's identity: chains are read-only here and never reorder. */
function keyedChain(chain: Fx[]): { key: string; fx: Fx }[] {
  return chain.map((fx, position) => ({ key: `${position}:${fx.type}`, fx }));
}

function fxParams(fx: Fx): [string, string][] {
  return Object.entries(fx)
    .filter(([key]) => key !== "type")
    .map(([key, value]) => [key, String(value)]);
}

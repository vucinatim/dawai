/**
 * Built-in sampler kits: pad name → MIDI pitch + sample id from the
 * starter library. Pad names are the authoring vocabulary (step-string
 * drums, duck triggers like "drums:kick"); pitches are what the IR
 * stores; sample ids are resolved by the audio renderer.
 */

export const KIT_IDS = ["dnb-standard", "tr-909"] as const;

export type KitId = (typeof KIT_IDS)[number];

export interface KitPad {
  pitch: number;
  sample: string;
}

export type KitDefinition = Record<string, KitPad>;

export const KITS: Record<KitId, KitDefinition> = {
  "dnb-standard": {
    kick: { pitch: 36, sample: "dnb/kick" },
    rim: { pitch: 37, sample: "dnb/rim" },
    snare: { pitch: 38, sample: "dnb/snare" },
    clap: { pitch: 39, sample: "dnb/clap" },
    chh: { pitch: 42, sample: "dnb/hat-closed" },
    phh: { pitch: 44, sample: "dnb/hat-pedal" },
    ohh: { pitch: 46, sample: "dnb/hat-open" },
    crash: { pitch: 49, sample: "dnb/crash" },
    ride: { pitch: 51, sample: "dnb/ride" },
    perc1: { pitch: 63, sample: "dnb/perc-1" },
    perc2: { pitch: 64, sample: "dnb/perc-2" },
    shaker: { pitch: 70, sample: "dnb/shaker" },
  },
  "tr-909": {
    kick: { pitch: 36, sample: "909/kick" },
    rim: { pitch: 37, sample: "909/rim" },
    snare: { pitch: 38, sample: "909/snare" },
    clap: { pitch: 39, sample: "909/clap" },
    chh: { pitch: 42, sample: "909/hat-closed" },
    ohh: { pitch: 46, sample: "909/hat-open" },
    crash: { pitch: 49, sample: "909/crash" },
    ride: { pitch: 51, sample: "909/ride" },
  },
};

export function kitPad(kitId: KitId, padName: string): KitPad {
  const pad = KITS[kitId][padName];
  if (!pad) {
    const available = Object.keys(KITS[kitId]).join(", ");
    throw new Error(
      `Kit "${kitId}" has no pad "${padName}". Available pads: ${available}.`,
    );
  }
  return pad;
}

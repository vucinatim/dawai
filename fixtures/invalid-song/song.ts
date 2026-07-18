import { steps } from "@dawai/composer/builders";
import { sampler } from "@dawai/composer/instruments";
import { section } from "@dawai/composer/section";
import { song, track } from "@dawai/composer/song";

// Intentionally invalid at the validation stage (it typechecks fine):
// the track routes to a bus that doesn't exist. Used by CLI error-path
// tests to prove `check` fails precisely, not vaguely.

export default song({
  name: "Broken",
  tempo: 174,
  tracks: [track("drums", sampler("dnb-standard"), { out: "drumbus" })],
  arrangement: [section("intro", 1, { drums: steps("x...", 36) })],
});

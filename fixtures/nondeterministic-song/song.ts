import { notes } from "@dawai/composer/builders";
import { synth } from "@dawai/composer/instruments";
import { section } from "@dawai/composer/section";
import { song, track } from "@dawai/composer/song";

// Intentionally nondeterministic: velocity derived from Math.random().
// The determinism guard must fail this at `dawai check` (architecture
// boundary 4) — this fixture exists to prove the guard works.

const velocity = Math.round(40 + Math.random() * 80);

export default song({
  name: "Unseeded",
  tempo: 120,
  tracks: [track("keys", synth("keys"))],
  arrangement: [section("intro", 1, { keys: notes([[0, "C4", 1, velocity]]) })],
});

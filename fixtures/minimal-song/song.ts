import { synth } from "@dawai/composer/instruments";
import { song, track } from "@dawai/composer/song";

// The smallest valid song: one track, no arrangement, no clips — an
// empty timeline. Edge fixture for check/inspect on empty documents.

export default song({
  name: "Blank Slate",
  tempo: 120,
  tracks: [track("keys", synth("keys"))],
});

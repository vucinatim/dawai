import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { App } from "./app";
import { initializeAudioEngine } from "./audio/engine-bridge";
import { connectLiveFeed } from "./live/ws-feed";

initializeAudioEngine();
// Live server first; the goal-2 fixture feed is the standalone fallback.
connectLiveFeed().then(async (connected) => {
  if (connected) return;
  const { feedDemoDocument, installDevFeed } = await import(
    "./fixture/demo-feed"
  );
  feedDemoDocument();
  installDevFeed();
  console.log("dawai: no live server — previewing the built-in demo song");
});

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

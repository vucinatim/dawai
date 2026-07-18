import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { App } from "./app";
import { initializeAudioEngine } from "./audio/engine-bridge";
import { feedDemoDocument, installDevFeed } from "./fixture/demo-feed";

initializeAudioEngine();
feedDemoDocument();
installDevFeed();

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installFailureReporting } from "./lib/reportFailure";
import { warmDeviceProfile } from "./lib/deviceCapability";

installFailureReporting();

createRoot(document.getElementById("root")!).render(<App />);

/*
 * Drop the crawler-only copy of the page once React has taken over.
 *
 * `scripts/postbuild.mjs` writes a visually-hidden #prerender-content block so
 * that a fetch with no JavaScript still sees the article text. It sits beside
 * #root rather than inside it, which means React never touches it: on a fully
 * rendered page the hidden duplicate stayed in the DOM next to the real thing,
 * so anything that executes JS saw the whole page twice. Removing it here keeps
 * the crawler benefit and leaves the rendered page with exactly one copy.
 */
document.getElementById("prerender-content")?.remove();

// Run the device-capability probe during idle time. Without this the 3M-iteration
// CPU benchmark runs synchronously inside a render the moment a user picks a
// file — a ~120ms main-thread block on weak Android, at the worst possible
// moment for INP. See _internal/MISTAKES-AND-LEARNINGS.md L-005.
warmDeviceProfile();

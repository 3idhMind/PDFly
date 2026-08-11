import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installFailureReporting } from "./lib/reportFailure";
import { warmDeviceProfile } from "./lib/deviceCapability";

installFailureReporting();

createRoot(document.getElementById("root")!).render(<App />);

// Run the device-capability probe during idle time. Without this the 3M-iteration
// CPU benchmark runs synchronously inside a render the moment a user picks a
// file — a ~120ms main-thread block on weak Android, at the worst possible
// moment for INP. See _internal/MISTAKES-AND-LEARNINGS.md L-005.
warmDeviceProfile();

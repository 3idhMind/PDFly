import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/*
 * A `lovable-tagger` plugin used to sit here, loaded with `require()` inside a
 * try/catch. The package is ESM-only, so the require always threw, the catch
 * always swallowed it, and the plugin never ran once — it only served Lovable's
 * visual editor, which this project no longer uses. Removed along with the
 * devDependency rather than repaired.
 */
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

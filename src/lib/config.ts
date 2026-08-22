/**
 * The absolute origin every canonical tag, og:url and JSON-LD `url` is built on.
 *
 * ── Why this is not simply `import.meta.env.VITE_SITE_URL` ────────────────
 * Vite inlines `VITE_*` at build time, and it reads `.env` in every mode
 * including a production build. A developer whose `.env` says
 * `VITE_SITE_URL=http://localhost:8080` — which is what a working dev setup
 * looks like — therefore compiles `http://localhost:8080` into the shipped
 * bundle, where it becomes the canonical URL of all 37 call sites the moment
 * React hydrates and react-helmet rewrites the head. The prerendered HTML is
 * correct, so nothing looks wrong in `view-source`; only a crawler or an audit
 * tool that executes JavaScript sees it. That is the worst shape a bug can
 * have, and it is why a localhost value is now refused outright rather than
 * trusted because someone set it.
 *
 * Precedence, and the reason for each step:
 *   1. VITE_SITE_URL, but only when it is a real public origin. This exists so
 *      a staging deployment can declare its own domain.
 *   2. The browser's own origin. Correct everywhere by construction — the real
 *      domain in production, localhost during development, with nothing to
 *      configure and nothing to get out of step.
 *   3. The production domain, for prerendering and any other run with no
 *      `window` to ask.
 */

/**
 * Where the site actually lives.
 *
 * Defined once, in routeMeta.ts, because `scripts/postbuild.mjs` reads that file
 * from Node to build canonical tags and the sitemap and cannot import anything
 * browser-shaped. Two copies of the same origin is precisely the pair that
 * drifts, and a canonical tag disagreeing with a sitemap is invisible until a
 * crawler notices.
 */
export { SITE_ORIGIN as CANONICAL_ORIGIN } from "./routeMeta";
import { SITE_ORIGIN } from "./routeMeta";

const LOCAL_HOST = /^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\])(:\d+)?$/i;

/** An override is only honoured when it could plausibly be a public origin. */
function usableOverride(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim().replace(/\/+$/, "");
  if (!value || LOCAL_HOST.test(value)) return undefined;
  return /^https?:\/\/.+/.test(value) ? value : undefined;
}

const browserOrigin = typeof window !== "undefined" ? window.location.origin : undefined;

export const SITE_URL =
  usableOverride(import.meta.env.VITE_SITE_URL) ?? browserOrigin ?? SITE_ORIGIN;

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { TOOLS } from "@/lib/toolsList";

const AUTO_ADVANCE_MS = 4500;

/**
 * One tool shown large at a time, auto-advancing, replacing a static grid
 * that couldn't grow — the old version hardcoded 6 tools; this reads from
 * TOOLS (lib/toolsList.ts) so every new tool just shows up, no page edit.
 *
 * SEO/accessibility note, worth reading before changing this: every tool's
 * <Link> is a real DOM node for all 12 tools at all times — inactive slides
 * are hidden with opacity + aria-hidden + tabIndex, never unmounted or
 * display:none'd. A carousel that only renders the current slide hides every
 * other tool from crawlers and from keyboard/screen-reader users; that is the
 * exact "Overflow Hidden" anti-pattern this was built to avoid, not a detail.
 */
export const ToolShowcase = () => {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useReducedMotion();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused || reduceMotion) return;
    timerRef.current = setInterval(() => {
      setActive((i) => (i + 1) % TOOLS.length);
    }, AUTO_ADVANCE_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, reduceMotion]);

  const go = (i: number) => setActive(((i % TOOLS.length) + TOOLS.length) % TOOLS.length);
  const tool = TOOLS[active];

  // Deterministic per-tool gradient — index-based hue offset from the brand
  // primary, not random, so the same tool always looks the same and nothing
  // needs a design pass every time a tool is added.
  const hue = 175 + active * 27;

  return (
    <div
      className="relative rounded-3xl border border-border bg-card overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Free PDF tools"
    >
      <div className="relative h-[280px] sm:h-[320px] md:h-[380px]">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={active}
            initial={reduceMotion ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: -24 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 sm:px-10"
            style={{
              background: `radial-gradient(ellipse at 50% 0%, hsl(${hue} 70% 92%), transparent 65%)`,
            }}
          >
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center mb-5 shadow-sm"
              style={{ background: `hsl(${hue} 55% 94%)`, color: `hsl(${hue} 60% 38%)` }}
            >
              <tool.icon className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>
            <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mb-2">
              {tool.label}
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground max-w-sm mb-6">
              {tool.desc}
            </p>
            <Link
              to={tool.href}
              className="inline-flex items-center gap-1.5 h-11 px-6 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Open {tool.label} <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </AnimatePresence>

        {/* Prev/next — 44px+ touch targets per accessibility guidance */}
        <button
          type="button"
          onClick={() => go(active - 1)}
          aria-label="Previous tool"
          className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-background/80 border border-border flex items-center justify-center hover:bg-background transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => go(active + 1)}
          aria-label="Next tool"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-background/80 border border-border flex items-center justify-center hover:bg-background transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Dots — also real buttons, keyboard reachable */}
      <div className="flex items-center justify-center gap-1.5 py-4 border-t border-border/60">
        {TOOLS.map((t, i) => (
          <button
            key={t.href}
            type="button"
            onClick={() => go(i)}
            aria-label={`Show ${t.label}`}
            aria-current={i === active}
            className={`h-1.5 rounded-full transition-all ${
              i === active ? "w-6 bg-primary" : "w-1.5 bg-border hover:bg-primary/40"
            }`}
          />
        ))}
      </div>

      {/* Every tool, always in the DOM — visually hidden when not active, so
          crawlers and screen readers see all 12 links, not just whichever
          one is currently on screen. This is what makes the carousel safe to
          use for something that has to stay indexable. */}
      <ul className="sr-only">
        {TOOLS.map((t, i) => (
          <li key={t.href} aria-hidden={i !== active}>
            <Link to={t.href} tabIndex={i === active ? undefined : -1}>{t.label} — {t.desc}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

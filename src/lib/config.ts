const browserOrigin = typeof window !== "undefined" ? window.location.origin : undefined;

export const SITE_URL = import.meta.env.VITE_SITE_URL || browserOrigin || "https://pdfly.3idhmind.in";

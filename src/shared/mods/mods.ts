import type { ApiMod, NormalizedMod } from "../types/osu";

/** Known clock-rate mods. Lazer mods may override via settings.speed_change. */
const CLOCK_RATE_MODS: Record<string, number> = {
  DT: 1.5,
  NC: 1.5,
  HT: 0.75,
  DC: 0.75,
};

/**
 * Returns the playback clock rate implied by a mod list.
 * Prefers structured lazer settings (speed_change) when present.
 * Falls back to the traditional constants, otherwise 1.
 */
export function getClockRate(mods: NormalizedMod[]): number {
  let rate = 1;

  for (const mod of mods) {
    const settings = mod.settings as { speed_change?: unknown } | undefined;
    if (settings && typeof settings.speed_change === "number" && settings.speed_change > 0) {
      rate = settings.speed_change;
      continue;
    }
    const fallback = CLOCK_RATE_MODS[mod.acronym.toUpperCase()];
    if (fallback !== undefined) {
      rate = fallback;
    }
  }

  return rate;
}

/** Converts raw API mods (objects or legacy acronym strings) into NormalizedMod[]. */
export function normalizeMods(raw: ApiMod[] | string[] | undefined): NormalizedMod[] {
  if (!raw) return [];
  return raw.map((mod) => {
    if (typeof mod === "string") {
      return { acronym: mod.toUpperCase() };
    }
    return {
      acronym: mod.acronym.toUpperCase(),
      name: mod.name,
      settings: mod.settings,
    };
  });
}

/** Kebab-case name used by osu-web mod SVG assets (mod-<kebab>.svg). */
const MOD_ASSET_NAMES: Record<string, string> = {
  EZ: "easy",
  NF: "no-fail",
  HT: "half-time",
  HR: "hard-rock",
  SD: "sudden-death",
  PF: "perfect",
  DT: "double-time",
  NC: "nightcore",
  HD: "hidden",
  FL: "flashlight",
  RX: "relax",
  AP: "autopilot",
  SO: "spun-out",
  MR: "mirror",
  FI: "fade-in",
  TD: "touch-device",
  CL: "classic",
  V2: "score-v2",
  NM: "no-mod",
  DA: "difficulty-adjust",
  AS: "adaptive-speed",
  CS: "constant-speed",
  AC: "accuracy-challenge",
};

/** Maps a mod acronym to its bundled SVG asset path, or null when unknown. */
export function modAssetPath(acronym: string): string | null {
  const name = MOD_ASSET_NAMES[acronym.toUpperCase()];
  return name ? `/assets/osu/mods/mod-${name}.svg` : null;
}

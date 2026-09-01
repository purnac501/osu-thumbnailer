import type { ApiScore } from "../types/osu";
import type { PlayStatus } from "../types/thumbnail";

/**
 * Derives the play status (FC or miss count) from score data.
 * Keeps FC logic isolated; templates only ever see PlayStatus.
 */
export function detectStatus(score: ApiScore): PlayStatus {
  const stats = score.statistics ?? {};
  const miss = stats.miss ?? 0;

  if (miss > 0) {
    return { kind: "miss", count: miss };
  }

  // Large tick misses, slider breaks, or combo breaks indicate an actual broken combo.
  // Dropping slider ends does not break combo and is counted as a Full Combo (FC).
  if (
    (stats.large_tick_miss ?? 0) > 0 ||
    (stats.slider_break ?? 0) > 0 ||
    (stats.combo_break ?? 0) > 0
  ) {
    return { kind: "unknown" };
  }

  return { kind: "fc" };
}

export function isFullCombo(score: ApiScore): boolean {
  return detectStatus(score).kind === "fc";
}

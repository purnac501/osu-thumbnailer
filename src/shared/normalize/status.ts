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

  // No misses: only trust an explicit false for perfect combo.
  if (score.is_perfect_combo === false) {
    return { kind: "unknown" };
  }

  return { kind: "fc" };
}

export function isFullCombo(score: ApiScore): boolean {
  return detectStatus(score).kind === "fc";
}

import type { ApiScore } from "../types/osu";
import type { PlayStatus } from "../types/thumbnail";
export function detectStatus(score: ApiScore, beatmapMaxCombo?: number): PlayStatus {
    const stats = score.statistics ?? {};
    const miss = stats.miss ?? stats.count_miss ?? 0;
    if (miss > 0) {
        return { kind: "miss", count: miss };
    }
    if ((stats.large_tick_miss ?? 0) > 0 ||
        (stats.slider_break ?? 0) > 0 ||
        (stats.combo_break ?? 0) > 0) {
        return { kind: "unknown" };
    }
    if (score.is_perfect_combo === true) {
        return { kind: "fc" };
    }
    const mapMaxCombo = beatmapMaxCombo ?? score.beatmap?.max_combo;
    const scoreMaxCombo = score.max_combo;
    if (mapMaxCombo && scoreMaxCombo !== undefined) {
        const maxDroppedEnds = Math.min(Math.max(15, score.beatmap?.count_sliders ?? 20), Math.max(2, Math.floor(mapMaxCombo * 0.08)));
        const minFcCombo = Math.max(1, mapMaxCombo - maxDroppedEnds);
        if (scoreMaxCombo < minFcCombo) {
            return { kind: "unknown" };
        }
    }
    return { kind: "fc" };
}
export function isFullCombo(score: ApiScore, beatmapMaxCombo?: number): boolean {
    return detectStatus(score, beatmapMaxCombo).kind === "fc";
}

import type { ApiScore } from "../types/osu";
import type { ThumbnailData } from "../types/thumbnail";
import { getClockRate, normalizeMods } from "../mods/mods";
import { detectStatus } from "./status";
export function backgroundCandidates(beatmapsetId: number, covers?: Record<string, string | undefined>): string[] {
    const base = `https://assets.ppy.sh/beatmaps/${beatmapsetId}/covers`;
    const provided: string[] = [];
    if (covers) {
        for (const key of ["raw", "cover@2x", "cover", "slimcover@2x", "slimcover"] as const) {
            const url = covers[key];
            if (url)
                provided.push(url);
        }
    }
    if (provided.length > 0)
        return provided;
    return [`${base}/raw.jpg`, `${base}/cover@2x.jpg`, `${base}/cover.jpg`];
}
export function normalizeScore(score: ApiScore, extras: {
    moddedStarRating?: number;
    leaderboardPosition?: number;
    baseBpm?: number;
    maxCombo?: number;
} = {}): ThumbnailData {
    const user = score.user;
    const beatmap = score.beatmap;
    const beatmapset = score.beatmapset;
    const mods = normalizeMods(score.mods);
    const clockRate = getClockRate(mods);
    const baseBpm = extras.baseBpm ?? beatmap?.bpm ?? 0;
    const beatmapsetId = beatmap?.beatmapset_id ?? 0;
    const beatmapMaxCombo = extras.maxCombo ?? beatmap?.max_combo;
    const rawLeaderboardPosition = extras.leaderboardPosition ?? score.rank_global;
    const leaderboardPosition = typeof rawLeaderboardPosition === "number" && rawLeaderboardPosition > 0
        ? rawLeaderboardPosition
        : undefined;
    const status = detectStatus(score, beatmapMaxCombo);
    const stats: Record<string, number> = {};
    for (const [key, value] of Object.entries(score.statistics ?? {})) {
        if (typeof value === "number")
            stats[key] = value;
    }
    const missCount = stats.miss ?? 0;
    const sbCount = stats.slider_break ?? stats.combo_break ?? (stats.large_tick_miss ?? 0);
    const bgCandidates = beatmapsetId > 0 ? backgroundCandidates(beatmapsetId, beatmapset?.covers) : [];
    return {
        scoreId: String(score.id),
        ruleset: (score.mode as ThumbnailData["ruleset"]) ?? "osu",
        username: user?.username ?? "unknown",
        userId: user?.id ?? score.user_id ?? 0,
        avatarUrl: user?.avatar_url,
        countryCode: user?.country_code,
        pp: score.pp ?? undefined,
        accuracy: score.accuracy ?? 0,
        grade: score.rank ?? "",
        maxCombo: score.max_combo ?? 0,
        leaderboardPosition,
        status,
        missCount,
        sbCount,
        isFullCombo: status.kind === "fc",
        mods,
        statistics: stats,
        beatmapId: beatmap?.id ?? score.beatmap_id ?? 0,
        beatmapsetId,
        beatmapStatus: beatmap?.status,
        artist: beatmapset?.artist ?? "",
        title: beatmapset?.title ?? "",
        difficultyName: beatmap?.version ?? "",
        mapper: beatmapset?.creator,
        baseBpm,
        effectiveBpm: baseBpm * clockRate,
        clockRate,
        baseStarRating: beatmap?.difficulty_rating,
        moddedStarRating: extras.moddedStarRating ?? beatmap?.difficulty_rating,
        backgroundUrl: bgCandidates[0],
        backgroundFallbacks: bgCandidates.slice(1),
        playedAt: score.created_at,
    };
}

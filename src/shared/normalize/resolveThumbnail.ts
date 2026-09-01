import type { OsuClient } from "../osu/client";
import { parseScoreUrl } from "../score-url/parseScoreUrl";
import type { ThumbnailResult } from "../types/thumbnail";
import { normalizeScore } from "./normalizeScore";

/** Fetches and normalizes all public data needed by the thumbnail. */
export async function resolveThumbnail(url: string, client: OsuClient): Promise<ThumbnailResult> {
  const parsed = parseScoreUrl(url);
  if (!parsed) throw new Error(`Not a valid osu! score URL: ${url}`);

  const score = await client.fetchScore(parsed.scoreId, parsed.ruleset);
  const warnings: string[] = [];
  const beatmapId = score.beatmap?.id ?? score.beatmap_id ?? 0;
  const mods = score.mods ?? [];
  const [attributes, leaderboardPosition] = await Promise.all([
    beatmapId > 0 ? client.getModdedBeatmapAttributes(beatmapId, mods) : Promise.resolve(null),
    beatmapId > 0 && score.rank_global === undefined
      ? client.fetchLeaderboardPosition(beatmapId, parsed.scoreId, mods)
      : Promise.resolve(undefined),
  ]);

  if (!attributes) warnings.push("Modded star rating unavailable. Using the base rating.");
  if (leaderboardPosition === undefined && score.rank_global === undefined) {
    warnings.push("Leaderboard position unavailable.");
  }

  const data = normalizeScore(score, {
    moddedStarRating: attributes?.star_rating,
    leaderboardPosition,
    baseBpm: score.beatmap?.bpm ?? 0,
  });
  if (data.mods.some((mod) => mod.acronym === "CL") && data.sbCount === 0) {
    warnings.push("Slider breaks are unavailable for Classic scores. Enter them below.");
  }
  if (!data.baseBpm) warnings.push("Beatmap BPM unavailable.");

  return { data, warnings, mode: "live" };
}

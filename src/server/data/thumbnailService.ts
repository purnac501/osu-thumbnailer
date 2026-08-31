import { parseScoreUrl } from "../../shared/score-url/parseScoreUrl";
import type { ThumbnailResult } from "../../shared/types/thumbnail";
import { fetchScore, getModdedBeatmapAttributes, fetchLeaderboardPosition, hasOsuCredentials } from "../osu/client";
import { normalizeScore } from "../../shared/normalize/normalizeScore";
import { referenceFixtureThumbnail } from "../data/fixtures";

/**
 * Resolves a score URL into normalized thumbnail data.
 * Without osu! credentials this runs in mock mode and returns the fixture
 * for any valid score URL, so the whole pipeline works offline.
 */
export async function getThumbnailData(
  url: string,
  options: { mock?: boolean } = {},
): Promise<ThumbnailResult> {
  const parsed = parseScoreUrl(url);
  if (!parsed) {
    throw new Error(`Not a valid osu! score URL: ${url}`);
  }

  const mock = options.mock ?? !hasOsuCredentials();
  if (mock) {
    return {
      data: { ...referenceFixtureThumbnail, scoreId: parsed.scoreId },
      warnings: ["mock mode: no osu! API credentials configured; returning fixture data"],
      mode: "mock",
    };
  }

  const score = await fetchScore(parsed.scoreId, parsed.ruleset);
  const warnings: string[] = [];

  if (parsed.ruleset === null) {
    warnings.push("score URL had no ruleset; resolved as a lazer score id");
  }

  const beatmapId = score.beatmap?.id ?? score.beatmap_id ?? 0;
  const mods = score.mods ?? [];

  const [attributes, leaderboardPosition] = await Promise.all([
    beatmapId > 0 ? getModdedBeatmapAttributes(beatmapId, mods) : Promise.resolve(null),
    beatmapId > 0 && score.rank_global === undefined
      ? fetchLeaderboardPosition(beatmapId, parsed.scoreId, mods)
      : Promise.resolve(undefined),
  ]);

  if (!attributes) warnings.push("modded star rating unavailable; using base difficulty_rating");
  if (leaderboardPosition === undefined && score.rank_global === undefined) {
    warnings.push("leaderboard position unavailable");
  }

  const baseBpmFallback = score.beatmap?.bpm ?? 0;
  const data = normalizeScore(score, {
    moddedStarRating: attributes?.star_rating,
    leaderboardPosition,
    baseBpm: baseBpmFallback,
  });

  if (data.mods.some((mod) => mod.acronym === "CL") && data.sbCount === 0) {
    warnings.push("Classic scoring does not expose slider breaks; enter the count manually");
  }

  if (!data.baseBpm) warnings.push("beatmap BPM unavailable");
  return { data, warnings, mode: "live" };
}

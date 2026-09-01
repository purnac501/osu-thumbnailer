import type { OsuClient } from "../osu/client";
import { parseScoreUrl } from "../score-url/parseScoreUrl";
import type { ThumbnailResult } from "../types/thumbnail";
import { normalizeScore } from "./normalizeScore";
import { calculateScorePp } from "../pp/calculatePp";

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

  if (!attributes && !score.beatmap?.difficulty_rating) warnings.push("Modded star rating unavailable. Using the base rating.");
  if (leaderboardPosition === undefined && score.rank_global === undefined) {
    warnings.push("Leaderboard position unavailable.");
  }

  let calculatedPp: number | undefined;
  let calculatedStars: number | undefined;
  if (score.pp === null || score.pp === undefined || !attributes?.star_rating) {
    const calc = await calculateScorePp(score);
    if (calc) {
      if (score.pp === null || score.pp === undefined) calculatedPp = calc.pp;
      if (!attributes?.star_rating) calculatedStars = calc.stars;
    }
  }

  const data = normalizeScore(calculatedPp !== undefined ? { ...score, pp: calculatedPp } : score, {
    moddedStarRating: attributes?.star_rating ?? calculatedStars,
    leaderboardPosition,
    baseBpm: score.beatmap?.bpm ?? 0,
  });
  if (data.mods.some((mod) => mod.acronym === "CL") && data.sbCount === 0) {
    warnings.push("Classic scores do not include slider-break data. Enter a count below if you know it, or leave it at 0.");
  }
  if (!data.baseBpm) warnings.push("Beatmap BPM unavailable.");

  return { data, warnings, mode: "live" };
}

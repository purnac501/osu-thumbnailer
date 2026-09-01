import ojsamaModule from "ojsama";
import type { ApiScore } from "../types/osu";

const ojsama = (ojsamaModule as unknown as { default?: typeof ojsamaModule }).default ?? ojsamaModule;

export interface PpCalculationResult {
  pp: number;
  stars: number;
  maxCombo: number;
  ppIfFc: number;
}

/**
 * Calculates accurate PP and difficulty attributes for any osu! score.
 * Pure JS calculation using ojsama - works in Cloudflare Workers, Node, and browser.
 */
export async function calculateScorePp(
  score: ApiScore,
  beatmapContent?: string,
): Promise<PpCalculationResult | null> {
  const beatmapId = score.beatmap?.id ?? score.beatmap_id;
  if (!beatmapId && !beatmapContent) return null;

  try {
    let text = beatmapContent;
    if (!text) {
      const res = await fetch(`https://osu.ppy.sh/osu/${beatmapId}`);
      if (!res.ok) return null;
      text = await res.text();
    }

    const parser = new ojsama.parser();
    parser.feed(text);
    const map = parser.map;

    const rawMods = score.mods ?? [];
    const modStrings = rawMods.map((m) => (typeof m === "string" ? m : m.acronym)).join("");
    const mods = ojsama.modbits.from_string(modStrings);

    const stats: Record<string, number | undefined> = score.statistics ?? {};
    const n300 = stats.great ?? stats.count_300 ?? stats["300"] ?? 0;
    const n100 = stats.ok ?? stats.count_100 ?? stats["100"] ?? 0;
    const n50 = stats.meh ?? stats.count_50 ?? stats["50"] ?? 0;
    const nmiss = stats.miss ?? stats.count_miss ?? 0;
    const combo = score.max_combo;

    const stars = new ojsama.diff().calc({ map, mods });

    const ppResult = ojsama.ppv2({
      map,
      stars,
      mods,
      combo,
      n300,
      n100,
      n50,
      nmiss,
    });

    const fcPpResult = ojsama.ppv2({
      map,
      stars,
      mods,
      combo: map.max_combo(),
      n300: n300 + nmiss,
      n100,
      n50,
      nmiss: 0,
    });

    return {
      pp: Math.round(ppResult.total * 100) / 100,
      stars: Math.round(stars.total * 100) / 100,
      maxCombo: map.max_combo(),
      ppIfFc: Math.round(fcPpResult.total * 100) / 100,
    };
  } catch (err) {
    console.warn("PP calculation failed:", err);
    return null;
  }
}

import type { ThumbnailData } from "../shared/types/thumbnail";
import {
  formatAccuracy,
  formatBpm,
  formatCombo,
  formatLeaderboardPosition,
  formatMapName,
  formatPp,
  formatStarRating,
} from "../shared/formatting/format";
import type { ThumbnailTemplate } from "./types";

/**
 * The computed display text for every editable text layer, keyed by layer id.
 * Used by the renderer, the editor UI (as input placeholders), and text
 * overrides.
 */
export function computeTexts(
  data: ThumbnailData,
  template: ThumbnailTemplate,
): Record<string, string> {
  const status =
    data.status.kind === "fc"
      ? template.dataOptions.fcText
      : data.status.kind === "miss"
        ? template.dataOptions.missText.replace("{count}", String(data.status.count))
        : "";

  const maxLb = template.dataOptions.maxLeaderboardPosition ?? 50;
  const lb =
    data.leaderboardPosition !== undefined && data.leaderboardPosition > 0 && data.leaderboardPosition <= maxLb
      ? data.leaderboardPosition
      : undefined;

  const ppFormatted = formatPp(data.pp);
  const isBubbly = template.id === "adaptable" || template.id === "cute";
  const ppText = isBubbly && data.pp
    ? `${Math.round(data.pp)} PP`
    : ppFormatted;
  const starRatingValue = data.moddedStarRating ?? data.baseStarRating;
  const starText = isBubbly && starRatingValue !== undefined
    ? `★ ${starRatingValue.toFixed(2)}★`
    : formatStarRating(starRatingValue);
  const mapTitleText = template.id === "showcase" || template.id === "adaptable"
    ? (data.title || "MAP TITLE").toUpperCase()
    : formatMapName(data, template.dataOptions.mapNameFormat);

  const bottomText = template.id === "showcase"
    ? `[ ${(data.artist || "CHERRY").toUpperCase()} ]`
    : (template.dataOptions.bottomPrefix || `${data.username} - ${formatPp(data.pp)}`);

  return {
    status,
    "status-sb":
      data.sbCount > 0
        ? template.dataOptions.sbText.replace("{count}", String(data.sbCount))
        : "",
    "star-rating": starText,
    pp: ppText,
    combo: formatCombo(data.maxCombo),
    difficulty: data.difficultyName,
    bpm: formatBpm(data.effectiveBpm),
    "map-title": mapTitleText,
    grade: data.grade,
    accuracy: formatAccuracy(data.accuracy),
    leaderboard: formatLeaderboardPosition(lb),
    username: data.username,
    "bottom-text": bottomText,
  };
}

/** Text with any manual override applied. */
export function withTextOverride(
  key: string,
  texts: Record<string, string>,
  template: ThumbnailTemplate,
): string {
  const override = template.textOverrides?.[key];
  if (key === "pp" && override !== undefined) {
    const value = override.match(/\d+(?:\.\d+)?/)?.[0];
    return value ? `${value}PP` : texts[key] ?? "";
  }
  return override ?? texts[key] ?? "";
}

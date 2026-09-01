import { parseScoreUrl } from "../../shared/score-url/parseScoreUrl";
import type { ThumbnailResult } from "../../shared/types/thumbnail";
import { createOsuClient } from "../../shared/osu/client";
import { resolveThumbnail } from "../../shared/normalize/resolveThumbnail";
import { referenceFixtureThumbnail } from "./fixtures";
import { hasOsuCredentials } from "../osu/client";

/** Resolves live data, with an offline fixture fallback for local render tests. */
export async function getThumbnailData(
  url: string,
  options: { mock?: boolean } = {},
): Promise<ThumbnailResult> {
  const parsed = parseScoreUrl(url);
  if (!parsed) throw new Error(`Not a valid osu! score URL: ${url}`);

  if (options.mock ?? !hasOsuCredentials()) {
    return {
      data: { ...referenceFixtureThumbnail, scoreId: parsed.scoreId },
      warnings: ["Mock mode: no osu! API credentials configured."],
      mode: "mock",
    };
  }

  return resolveThumbnail(url, createOsuClient({
    clientId: process.env.OSU_CLIENT_ID!,
    clientSecret: process.env.OSU_CLIENT_SECRET!,
  }));
}

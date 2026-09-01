import type { ApiScore } from "../types/osu";
import type { Ruleset } from "../types/thumbnail";

export interface OsuCredentials {
  clientId: string;
  clientSecret: string;
}

/** Creates an osu! API client that works in Node and edge runtimes. */
export function createOsuClient(credentials: OsuCredentials) {
  let cached: { token: string; expiresAt: number } | null = null;

  const getAccessToken = async () => {
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

    const res = await fetch("https://osu.ppy.sh/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: Number(credentials.clientId),
        client_secret: credentials.clientSecret,
        scope: "public",
      }),
    });
    if (!res.ok) throw new Error(`osu! OAuth failed: ${res.status} ${await res.text()}`);

    const body = await res.json() as { access_token: string; expires_in: number };
    cached = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return cached.token;
  };

  const apiGet = async (path: string) => {
    const token = await getAccessToken();
    const res = await fetch(`https://osu.ppy.sh/api/v2${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-API-Version": "20220705",
      },
    });
    if (!res.ok) throw new Error(`osu! API ${path} failed: ${res.status} ${await res.text()}`);
    return res.json();
  };

  const fetchScore = async (scoreId: string, ruleset: Ruleset | null): Promise<ApiScore> => {
    const attempts = ruleset
      ? [`/scores/${ruleset}/${scoreId}`, `/scores/${scoreId}`]
      : [`/scores/${scoreId}`, ...(["osu", "taiko", "fruits", "mania"] as Ruleset[]).map((mode) => `/scores/${mode}/${scoreId}`)];

    for (const path of attempts) {
      try {
        const value = await apiGet(path);
        if (typeof value === "object" && value !== null && "id" in value) return value as ApiScore;
      } catch (error) {
        if (!(error instanceof Error) || !/\b404\b/.test(error.message)) throw error;
      }
    }
    throw new Error(`Score ${scoreId} could not be found via the osu! API`);
  };

  const getModdedBeatmapAttributes = async (beatmapId: number, mods: unknown[]) => {
    const token = await getAccessToken();
    const res = await fetch(`https://osu.ppy.sh/api/v2/beatmaps/${beatmapId}/attributes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ mods }),
    });
    if (!res.ok) return null;
    const body = await res.json() as { attributes?: { star_rating?: number; clock_rate?: number } };
    if (!body.attributes?.star_rating) return null;
    return { star_rating: body.attributes.star_rating, clock_rate: body.attributes.clock_rate };
  };

  const fetchLeaderboardPosition = async (beatmapId: number, scoreId: string, mods: unknown[]) => {
    const query = new URLSearchParams({ limit: "50" });
    if (mods.length > 0) query.set("mods[]", mods.map((mod) => JSON.stringify(mod)).join(""));
    try {
      const value = await apiGet(`/beatmaps/${beatmapId}/scores?${query.toString()}`);
      const scores = (value as { scores?: { id: number | string }[] }).scores ?? [];
      const index = scores.findIndex((score) => String(score.id) === scoreId);
      return index >= 0 ? index + 1 : undefined;
    } catch {
      return undefined;
    }
  };

  return { fetchScore, getModdedBeatmapAttributes, fetchLeaderboardPosition };
}

export type OsuClient = ReturnType<typeof createOsuClient>;

import type { ApiScore } from "../../shared/types/osu";
import type { Ruleset } from "../../shared/types/thumbnail";

/** Token cache: reuse the client-credentials token until shortly before expiry. */
interface CachedToken {
  token: string;
  expiresAt: number;
}

let cached: CachedToken | null = null;

export function hasOsuCredentials(): boolean {
  return Boolean(process.env.OSU_CLIENT_ID && process.env.OSU_CLIENT_SECRET);
}

export async function getAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const clientId = process.env.OSU_CLIENT_ID;
  const clientSecret = process.env.OSU_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("OSU_CLIENT_ID / OSU_CLIENT_SECRET are not configured");
  }

  const res = await fetch("https://osu.ppy.sh/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: Number(clientId),
      client_secret: clientSecret,
      scope: "public",
    }),
  });

  if (!res.ok) {
    throw new Error(`osu! OAuth failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as { access_token: string; expires_in: number };
  cached = {
    token: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  };
  return cached.token;
}

async function apiGet(path: string): Promise<unknown> {
  const token = await getAccessToken();
  const res = await fetch(`https://osu.ppy.sh/api/v2${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-API-Version": "20220705",
    },
  });
  if (!res.ok) {
    throw new Error(`osu! API ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Fetches a score by id, resolving both URL forms:
 * - /scores/{id}: lazer Solo score -> GET /scores/{id}
 * - /scores/{mode}/{id}: legacy score id -> GET /scores/{mode}/{id}
 * Falls back to the other form when the first lookup 404s.
 */
export async function fetchScore(scoreId: string, ruleset: Ruleset | null): Promise<ApiScore> {
  const attempts: string[] = ruleset
    ? [`/scores/${ruleset}/${scoreId}`, `/scores/${scoreId}`]
    : [`/scores/${scoreId}`, ...(["osu", "taiko", "fruits", "mania"] as Ruleset[]).map((r) => `/scores/${r}/${scoreId}`)];

  for (const path of attempts) {
    try {
      const value = await apiGet(path);
      if (isScore(value)) return value;
    } catch (err) {
      if (!isNotFound(err)) throw err;
    }
  }

  throw new Error(
    `Score ${scoreId} could not be found via the osu! API (tried: ${attempts.join(", ")})`,
  );
}

function isNotFound(err: unknown): boolean {
  return err instanceof Error && /\b404\b/.test(err.message);
}

function isScore(value: unknown): value is ApiScore {
  return typeof value === "object" && value !== null && "id" in value;
}

/** POST /beatmaps/{id}/attributes with the score's mods, for modded star rating. */
export async function getModdedBeatmapAttributes(
  beatmapId: number,
  mods: unknown[],
): Promise<{ star_rating: number; clock_rate?: number } | null> {
  const token = await getAccessToken();
  const res = await fetch(`https://osu.ppy.sh/api/v2/beatmaps/${beatmapId}/attributes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mods }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { attributes?: { star_rating?: number; clock_rate?: number } };
  if (!body.attributes?.star_rating) return null;
  return { star_rating: body.attributes.star_rating, clock_rate: body.attributes.clock_rate };
}

/** Fetches the beatmap leaderboard to locate a score's position on that map. */
export async function fetchLeaderboardPosition(
  beatmapId: number,
  scoreId: string,
  mods: unknown[],
): Promise<number | undefined> {
  const query = new URLSearchParams({ limit: "50" });
  if (mods.length > 0) query.set("mods[]", mods.map((m) => JSON.stringify(m)).join(""));
  try {
    const value = await apiGet(`/beatmaps/${beatmapId}/scores?${query.toString()}`);
    const scores = (value as { scores?: { id: number | string }[] }).scores ?? [];
    const index = scores.findIndex((s) => String(s.id) === scoreId);
    return index >= 0 ? index + 1 : undefined;
  } catch {
    return undefined;
  }
}

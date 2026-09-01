import { createOsuClient, type OsuClient } from "../src/shared/osu/client";
import { resolveThumbnail } from "../src/shared/normalize/resolveThumbnail";
import { globalOsuQueue } from "../src/shared/osu/queue";
import type { ThumbnailData } from "../src/shared/types/thumbnail";

interface Env {
  OSU_CLIENT_ID: string;
  OSU_CLIENT_SECRET: string;
  ALLOWED_ORIGIN?: string;
  SCORE_RATE_LIMITER: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
}

const IMAGE_HOSTS = new Set(["assets.ppy.sh", "a.ppy.sh", "osu.ppy.sh"]);
let osuClient: OsuClient | null = null;

function cors(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = env.ALLOWED_ORIGIN || origin || "*";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function json(value: unknown, request: Request, env: Env, status = 200): Response {
  return Response.json(value, { status, headers: { ...cors(request, env), "Cache-Control": "no-store" } });
}

function proxiedAsset(value: string | undefined, request: Request): string | undefined {
  if (!value || !value.startsWith("http")) return value;
  const endpoint = new URL("/api/image", request.url);
  endpoint.searchParams.set("url", value);
  return endpoint.toString();
}

function proxyThumbnailAssets(data: ThumbnailData, request: Request): ThumbnailData {
  return {
    ...data,
    avatarUrl: proxiedAsset(data.avatarUrl, request),
    backgroundUrl: proxiedAsset(data.backgroundUrl, request),
    backgroundFallbacks: data.backgroundFallbacks?.map((url) => proxiedAsset(url, request)!),
  };
}

async function imageResponse(request: Request, env: Env): Promise<Response> {
  const source = new URL(request.url).searchParams.get("url");
  if (!source) return json({ error: "Missing image URL" }, request, env, 400);

  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return json({ error: "Invalid image URL" }, request, env, 400);
  }
  if (url.protocol !== "https:" || !IMAGE_HOSTS.has(url.hostname)) {
    return json({ error: "Image host is not allowed" }, request, env, 400);
  }

  const upstream = await fetch(url, { headers: { "User-Agent": "osu-thumbnailer/0.1" } });
  if (!upstream.ok || !upstream.body) return json({ error: "Image unavailable" }, request, env, 502);
  const headers = new Headers(cors(request, env));
  headers.set("Content-Type", upstream.headers.get("Content-Type") ?? "application/octet-stream");
  headers.set("Cache-Control", "public, max-age=86400");
  return new Response(upstream.body, { headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    if (env.ALLOWED_ORIGIN && origin && origin !== env.ALLOWED_ORIGIN && !origin.startsWith("http://localhost:")) {
      return json({ error: "Origin is not allowed" }, request, env, 403);
    }
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request, env) });
    if (request.method !== "GET") return json({ error: "Method not allowed" }, request, env, 405);

    const url = new URL(request.url);
    if (url.pathname === "/api/health") return json({ ok: true }, request, env);
    if (url.pathname === "/api/queue-status") return json(globalOsuQueue.getStatus(), request, env);
    if (url.pathname === "/api/image") return imageResponse(request, env);
    if (url.pathname !== "/api/thumbnail") return json({ error: "Not found" }, request, env, 404);

    const scoreUrl = url.searchParams.get("url");
    if (!scoreUrl) return json({ error: "Missing url parameter" }, request, env, 400);

    const clientIp = request.headers.get("CF-Connecting-IP") ?? "local";
    const { success } = await env.SCORE_RATE_LIMITER.limit({ key: clientIp });
    if (!success) {
      const response = json({ error: "Too many score requests. Try again in one minute." }, request, env, 429);
      response.headers.set("Retry-After", "60");
      return response;
    }

    try {
      osuClient ??= createOsuClient({ clientId: env.OSU_CLIENT_ID, clientSecret: env.OSU_CLIENT_SECRET });
      const { result, queueStats } = await globalOsuQueue.run(() => resolveThumbnail(scoreUrl, osuClient!));
      return json({
        ...result,
        queue: queueStats,
        data: proxyThumbnailAssets(result.data, request),
      }, request, env);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, request, env, 400);
    }
  },
};

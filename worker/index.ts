import { createOsuClient, type OsuClient } from "../src/shared/osu/client";
import { resolveThumbnail } from "../src/shared/normalize/resolveThumbnail";
import { resolveOverlayData } from "../src/server/overlayResolver";
import { globalOsuQueue } from "../src/shared/osu/queue";
import { parseScoreUrl } from "../src/shared/score-url/parseScoreUrl";
import type { ThumbnailData } from "../src/shared/types/thumbnail";
import { fixtureRegistry } from "../src/server/data/fixtures";
interface Env {
    OSU_CLIENT_ID: string;
    OSU_CLIENT_SECRET: string;
    ALLOWED_ORIGIN?: string;
    SCORE_RATE_LIMITER: {
        limit(options: {
            key: string;
        }): Promise<{
            success: boolean;
        }>;
    };
    IMAGE_RATE_LIMITER: Env["SCORE_RATE_LIMITER"];
    OSU_RATE_LIMITER: Env["SCORE_RATE_LIMITER"];
    REQUEST_ANALYTICS: {
        writeDataPoint(event: {
            indexes: string[];
            blobs: string[];
            doubles: number[];
        }): void;
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
        "Access-Control-Allow-Headers": "Content-Type, X-Client-Id",
        Vary: "Origin",
    };
}
function json(value: unknown, request: Request, env: Env, status = 200): Response {
    return Response.json(value, { status, headers: { ...cors(request, env), "Cache-Control": "no-store" } });
}
function getOsuClient(env: Env): OsuClient {
    osuClient ??= createOsuClient({
        clientId: env.OSU_CLIENT_ID,
        clientSecret: env.OSU_CLIENT_SECRET,
        beforeRequest: async () => {
            const { success: upstreamAllowed } = await env.OSU_RATE_LIMITER.limit({ key: "osu-api" });
            if (!upstreamAllowed)
                throw new Error("Upstream request limit reached");
        },
    });
    return osuClient;
}
function proxiedAsset(value: string | undefined, request: Request): string | undefined {
    if (!value || !value.startsWith("http"))
        return value;
    const endpoint = new URL("/api/image", request.url);
    endpoint.searchParams.set("url", value);
    return endpoint.pathname + endpoint.search;
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
    if (!source)
        return json({ error: "Missing image URL" }, request, env, 400);
    const clientIp = request.headers.get("CF-Connecting-IP") ?? "local";
    if (clientIp !== "local" && clientIp !== "127.0.0.1") {
        const { success } = await env.IMAGE_RATE_LIMITER.limit({ key: clientIp });
        if (!success)
            return json({ error: "Too many image requests" }, request, env, 429);
    }
    let url: URL;
    try {
        url = new URL(source);
    }
    catch {
        return json({ error: "Invalid image URL" }, request, env, 400);
    }
    if (url.protocol !== "https:" || !IMAGE_HOSTS.has(url.hostname)) {
        return json({ error: "Image host is not allowed" }, request, env, 400);
    }
    const upstream = await fetch(url, {
        headers: { "User-Agent": "osu-thumbnailer/0.1" },
        signal: AbortSignal.timeout(15000),
    });
    if (!upstream.ok || !upstream.body)
        return json({ error: "Image unavailable" }, request, env, 502);
    const contentType = upstream.headers.get("Content-Type") ?? "";
    const contentLength = Number(upstream.headers.get("Content-Length") ?? 0);
    if (!contentType.startsWith("image/") || contentLength > 10000000) {
        return json({ error: "Invalid image response" }, request, env, 502);
    }
    const headers = new Headers(cors(request, env));
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "public, max-age=86400");
    return new Response(upstream.body, { headers });
}
export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const origin = request.headers.get("Origin");
        const localWorker = ["localhost", "127.0.0.1"].includes(new URL(request.url).hostname);
        if (env.ALLOWED_ORIGIN &&
            origin &&
            origin !== env.ALLOWED_ORIGIN &&
            !(localWorker &&
                (origin.startsWith("http://localhost:") ||
                    origin.startsWith("http://192.168.") ||
                    origin.startsWith("http://10.") ||
                    origin.startsWith("http://172.") ||
                    origin.startsWith("http://100.")))) {
            return json({ error: "Origin is not allowed" }, request, env, 403);
        }
        if (request.method === "OPTIONS")
            return new Response(null, { status: 204, headers: cors(request, env) });
        if (request.method !== "GET" && request.method !== "HEAD")
            return json({ error: "Method not allowed" }, request, env, 405);
        const url = new URL(request.url);
        if (url.pathname === "/api/health")
            return json({ ok: true }, request, env);
        if (url.pathname === "/api/queue-status")
            return json(globalOsuQueue.getStatus(), request, env);
        if (url.pathname.startsWith("/api/fixture")) {
            const parts = url.pathname.split("/");
            const name = parts[3] || "reference";
            const data = fixtureRegistry[name] ?? fixtureRegistry.reference;
            return json({ data, mode: "fixture", warnings: [] }, request, env);
        }
        if (url.pathname === "/api/image") {
            try {
                return await imageResponse(request, env);
            }
            catch (error) {
                console.error(error);
                return json({ error: "Image unavailable" }, request, env, 502);
            }
        }
        if (url.pathname === "/api/overlay-data") {
            const targetUrl = url.searchParams.get("url") || "";
            try {
                const data = await resolveOverlayData(targetUrl, getOsuClient(env), (u) => proxiedAsset(u, request));
                return json({ data }, request, env);
            }
            catch (err) {
                console.error("Overlay data fetch error:", err);
                return json({ error: "Failed to load overlay data" }, request, env, 500);
            }
        }
        if (url.pathname !== "/api/thumbnail")
            return json({ error: "Not found" }, request, env, 404);
        const scoreUrl = url.searchParams.get("url");
        if (!scoreUrl)
            return json({ error: "Missing url parameter" }, request, env, 400);
        const startedAt = Date.now();
        const scoreId = parseScoreUrl(scoreUrl)?.scoreId ?? "unknown";
        const rawClientId = request.headers.get("X-Client-Id") ?? "unknown";
        const clientId = /^[a-zA-Z0-9-]{1,64}$/.test(rawClientId) ? rawClientId : "unknown";
        const recordRequest = (outcome: string, beatmapId = 0, beatmapsetId = 0) => {
            try {
                env.REQUEST_ANALYTICS.writeDataPoint({
                    indexes: [clientId],
                    blobs: [scoreId, String(beatmapId), String(beatmapsetId), outcome],
                    doubles: [Date.now() - startedAt],
                });
            }
            catch (error) {
                console.error("Analytics write failed", error);
            }
        };
        const clientIp = request.headers.get("CF-Connecting-IP") ?? "local";
        const { success } = await env.SCORE_RATE_LIMITER.limit({ key: clientIp });
        if (!success) {
            const response = json({ error: "Too many score requests. Try again in one minute." }, request, env, 429);
            response.headers.set("Retry-After", "60");
            return response;
        }
        try {
            const client = getOsuClient(env);
            const { result, queueStats } = await globalOsuQueue.run(() => resolveThumbnail(scoreUrl, client));
            recordRequest("success", result.data.beatmapId, result.data.beatmapsetId);
            return json({
                ...result,
                queue: queueStats,
                data: proxyThumbnailAssets(result.data, request),
            }, request, env);
        }
        catch (error) {
            recordRequest("error");
            console.error(error);
            const overloaded = error instanceof Error && /queue is full|request limit reached/.test(error.message);
            return json({ error: overloaded ? "Service is busy. Try again shortly." : "Score could not be loaded." }, request, env, overloaded ? 503 : 400);
        }
    },
};

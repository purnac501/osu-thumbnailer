export type AnimationExportFormat = "gif" | "mov";
export type AnimationExportPreset = "compact" | "hq" | "1080p" | "1440p" | "4k";
export const ANIMATION_EXPORT_FPS = 60;
export const ANIMATION_EXPORT_DURATION = 5.4;
export const ANIMATION_EXPORT_FRAMES = ANIMATION_EXPORT_FPS * ANIMATION_EXPORT_DURATION;
export const ANIMATION_EXPORT_MIME: Record<AnimationExportFormat, string> = {
    gif: "image/gif",
    mov: "video/quicktime",
};
export type AnimationStyle = "card" | "showcase";
export function animationExportFileName(format: AnimationExportFormat, preset?: AnimationExportPreset, style?: AnimationStyle): string {
    const prefix = style === "showcase" ? "osu-showcase-intro" : "osu-score-card";
    const suffix = preset === "compact" || preset === "1080p" || preset === "1440p" || preset === "4k"
        ? `-${preset}`
        : "";
    return `${prefix}${suffix}.${format}`;
}
export function animationExportBackground(_format: AnimationExportFormat): string {
    return "transparent";
}
export interface AnimationExportParams {
    format: AnimationExportFormat;
    preset?: AnimationExportPreset;
    style?: AnimationStyle;
    score: string;
    theme: string;
    accent: string;
}
export function exportQuery(params: AnimationExportParams): URLSearchParams {
    const query = new URLSearchParams({
        format: params.format,
        bg: animationExportBackground(params.format),
    });
    if (params.preset && params.preset !== "hq")
        query.set("preset", params.preset);
    if (params.style && params.style !== "card")
        query.set("style", params.style);
    if (params.score)
        query.set("score", params.score);
    if (params.theme)
        query.set("theme", params.theme);
    if (params.accent)
        query.set("accent", params.accent);
    return query;
}
export function buildAnimationExportStartPath(params: AnimationExportParams): string {
    return `/api/export-animation/start?${exportQuery(params).toString()}`;
}
export function buildAnimationExportPageUrl(baseUrl: string, params: AnimationExportParams): string {
    const query = new URLSearchParams({
        tab: "animation",
        exportMode: "1",
        bg: animationExportBackground(params.format),
        format: params.format,
    });
    if (params.preset && params.preset !== "hq")
        query.set("preset", params.preset);
    if (params.style && params.style !== "card")
        query.set("style", params.style);
    if (params.score)
        query.set("url", params.score);
    if (params.theme)
        query.set("theme", params.theme);
    if (params.accent)
        query.set("accent", params.accent);
    return `${baseUrl}/index.html?${query.toString()}`;
}
export function parseAnimationExportFormat(value: string | null): AnimationExportFormat {
    return value === "mov" ? "mov" : "gif";
}
export function parseAnimationExportPreset(value: string | null): AnimationExportPreset {
    if (value === "compact" || value === "small") return "compact";
    if (value === "1080p") return "1080p";
    if (value === "1440p") return "1440p";
    if (value === "4k") return "4k";
    return "hq";
}
export function parseAnimationStyle(value: string | null | undefined): AnimationStyle {
    return value === "showcase" ? "showcase" : "card";
}

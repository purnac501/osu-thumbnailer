import { describe, expect, it } from "vitest";
import { ANIMATION_EXPORT_DURATION, ANIMATION_EXPORT_FPS, ANIMATION_EXPORT_FRAMES, ANIMATION_EXPORT_MIME, animationExportBackground, animationExportFileName, buildAnimationExportPageUrl, buildAnimationExportStartPath, parseAnimationExportFormat, } from "../src/shared/animation-export";
describe("animation export constants", () => {
    it("renders the full 5.4s loop at 60fps", () => {
        expect(ANIMATION_EXPORT_FPS).toBe(60);
        expect(ANIMATION_EXPORT_DURATION).toBe(5.4);
        expect(ANIMATION_EXPORT_FRAMES).toBe(324);
    });
    it("names files and mime types per format", () => {
        expect(animationExportFileName("gif")).toBe("osu-stream-overlay.gif");
        expect(animationExportFileName("mov")).toBe("osu-stream-overlay.mov");
        expect(ANIMATION_EXPORT_MIME.gif).toBe("image/gif");
        expect(ANIMATION_EXPORT_MIME.mov).toBe("video/quicktime");
    });
    it("keeps both exports transparent", () => {
        expect(animationExportBackground("gif")).toBe("transparent");
        expect(animationExportBackground("mov")).toBe("transparent");
    });
});
describe("animation export URLs", () => {
    it("builds the job start path with matching bg", () => {
        const gif = new URLSearchParams(buildAnimationExportStartPath({
            format: "gif",
            score: "https://osu.ppy.sh/scores/1",
            theme: "cyan",
            accent: "#00D2FF",
        }).split("?")[1]!);
        expect(gif.get("format")).toBe("gif");
        expect(gif.get("bg")).toBe("transparent");
        expect(gif.get("score")).toBe("https://osu.ppy.sh/scores/1");
        const mov = new URLSearchParams(buildAnimationExportStartPath({
            format: "mov",
            score: "https://osu.ppy.sh/scores/1",
            theme: "cyan",
            accent: "#00D2FF",
        }).split("?")[1]!);
        expect(mov.get("format")).toBe("mov");
        expect(mov.get("bg")).toBe("transparent");
    });
    it("omits empty optionals from the job start path", () => {
        const params = new URLSearchParams(buildAnimationExportStartPath({
            format: "gif",
            score: "",
            theme: "",
            accent: "",
        }).split("?")[1]!);
        expect(params.get("score")).toBeNull();
        expect(params.get("theme")).toBeNull();
        expect(params.get("accent")).toBeNull();
    });
    it("builds the capture page URL in export mode", () => {
        const url = new URL(buildAnimationExportPageUrl("http://localhost:5173", {
            format: "mov",
            score: "https://osu.ppy.sh/scores/1",
            theme: "gold",
            accent: "",
        }));
        expect(url.pathname).toBe("/index.html");
        expect(url.searchParams.get("tab")).toBe("animation");
        expect(url.searchParams.get("exportMode")).toBe("1");
        expect(url.searchParams.get("format")).toBe("mov");
        expect(url.searchParams.get("bg")).toBe("transparent");
        expect(url.searchParams.get("url")).toBe("https://osu.ppy.sh/scores/1");
        expect(url.searchParams.get("theme")).toBe("gold");
    });
    it("parses the format defensively", () => {
        expect(parseAnimationExportFormat("mov")).toBe("mov");
        expect(parseAnimationExportFormat("gif")).toBe("gif");
        expect(parseAnimationExportFormat("webm")).toBe("gif");
        expect(parseAnimationExportFormat(null)).toBe("gif");
        expect(parseAnimationExportFormat("")).toBe("gif");
    });
});

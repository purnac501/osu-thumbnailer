import { describe, expect, it } from "vitest";
import { exportCacheKey, exportCachePath, frameFileName, framePattern, gifsicleArgs, gifsicleBin, gifFfmpegArgs, movFfmpegArgs, readFreshCache, } from "../src/server/export-animation";
import { ANIMATION_EXPORT_FPS, ANIMATION_EXPORT_FRAMES } from "../src/shared/animation-export";
describe("export frame naming", () => {
    it("zero-pads every frame of the loop", () => {
        expect(frameFileName("/tmp/x", 0)).toBe("/tmp/x/frame_0000.png");
        expect(frameFileName("/tmp/x", ANIMATION_EXPORT_FRAMES - 1)).toBe(`/tmp/x/frame_${String(ANIMATION_EXPORT_FRAMES - 1).padStart(4, "0")}.png`);
    });
    it("matches the ffmpeg sequence pattern", () => {
        expect(framePattern("/tmp/x")).toBe("/tmp/x/frame_%04d.png");
    });
});
describe("gif ffmpeg args", () => {
    it("encodes at export fps with a transparency-aware palette", () => {
        const args = gifFfmpegArgs("/tmp/x/frame_%04d.png", "/tmp/x/output.gif");
        expect(args).toContain(String(ANIMATION_EXPORT_FPS));
        expect(args).toContain("/tmp/x/frame_%04d.png");
        const vf = args[args.indexOf("-vf") + 1]!;
        expect(vf).toContain("palettegen");
        expect(vf).toContain("fps=30");
        expect(vf).toContain("reserve_transparent=1");
        expect(vf).toContain("paletteuse");
        expect(vf).toContain("dither=sierra2_4a");
        expect(vf).toContain("diff_mode=rectangle");
        expect(vf).not.toContain("scale=");
        expect(args[args.length - 1]).toBe("/tmp/x/output.gif");
    });
});
describe("mov ffmpeg args", () => {
    it("encodes transparent ProRes 4444", () => {
        const args = movFfmpegArgs("/tmp/x/frame_%04d.png", "/tmp/x/output.mov");
        expect(args).toContain(String(ANIMATION_EXPORT_FPS));
        expect(args).toContain("prores_ks");
        expect(args).toContain("4444");
        expect(args[args.indexOf("-qscale:v") + 1]).toBe("25");
        expect(args[args.indexOf("-vf") + 1]).toContain("format=yuva444p10le");
        expect(args).toContain("+faststart");
        expect(args[args.length - 1]).toBe("/tmp/x/output.mov");
    });
    it("pads odd capture dimensions for chroma subsampling", () => {
        const args = movFfmpegArgs("/tmp/x/frame_%04d.png", "/tmp/x/output.mov");
        const vf = args[args.indexOf("-vf") + 1]!;
        expect(vf).toContain("ceil(iw/2)*2");
        expect(vf).toContain("ceil(ih/2)*2");
    });
});
describe("export cache", () => {
    const params = {
        format: "gif" as const,
        score: "https://osu.ppy.sh/scores/1",
        theme: "cyan",
        accent: "#00D2FF",
    };
    it("keys renders deterministically by params", () => {
        expect(exportCacheKey(params)).toBe(exportCacheKey({ ...params }));
        expect(exportCacheKey(params)).not.toBe(exportCacheKey({ ...params, theme: "gold" }));
        expect(exportCacheKey(params)).not.toBe(exportCacheKey({ ...params, format: "mov" }));
    });
    it("stores one file per format", () => {
        expect(exportCachePath("abc", "gif").endsWith("abc.gif")).toBe(true);
        expect(exportCachePath("abc", "mov").endsWith("abc.mov")).toBe(true);
    });
    it("misses on absent files", () => {
        expect(readFreshCache("/tmp/osu-overlay-cache-missing/abc.gif")).toBeNull();
    });
});
describe("gif post compression", () => {
    it("resolves the bundled gifsicle binary", () => {
        expect(gifsicleBin().endsWith("vendor/gifsicle")).toBe(true);
    });
    it("compresses lossy without touching dimensions or timing", () => {
        const args = gifsicleArgs("/tmp/x/output.gif", "/tmp/x/small.gif", "compact");
        expect(args).toContain("--optimize=3");
        expect(args).toContain("--lossy=10");
        expect(args).toContain("256");
        expect(args[args.length - 2]).toBe("/tmp/x/small.gif");
        expect(args[args.length - 1]).toBe("/tmp/x/output.gif");
    });
});

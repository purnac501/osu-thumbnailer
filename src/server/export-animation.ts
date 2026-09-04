import { execFileSync } from "child_process";
import { createHash } from "crypto";
import fs from "fs";
import { createRequire } from "module";
import os from "os";
import path from "path";
import { chromium, type Page } from "playwright";
import {
    ANIMATION_EXPORT_DURATION,
    ANIMATION_EXPORT_FRAMES,
    ANIMATION_EXPORT_FPS,
    ANIMATION_EXPORT_MIME,
    animationExportFileName,
    buildAnimationExportPageUrl,
    type AnimationExportFormat,
    type AnimationExportPreset,
    type AnimationStyle,
} from "../shared/animation-export";
export interface RenderAnimationOptions {
    format: AnimationExportFormat;
    preset?: AnimationExportPreset;
    style?: AnimationStyle;
    score: string;
    theme: string;
    accent: string;
    baseUrl: string;
}
export interface RenderedAnimation {
    bytes: Buffer;
    contentType: string;
    fileName: string;
}
export const EXPORT_VIEWPORT = { width: 520, height: 410 };
export const EXPORT_DEVICE_SCALE = 1.5;
export const EXPORT_CLIP_PADDING = 56;
export const EXPORT_SHARD_COUNT = 4;
export const EXPORT_CACHE_TTL_MS = 30 * 60 * 1000;
export function gifFfmpegArgs(framePattern: string, outFile: string, preset?: "compact" | "hq"): string[] {
    if (preset === "compact") {
        return [
            "-y",
            "-framerate",
            String(ANIMATION_EXPORT_FPS),
            "-i",
            framePattern,
            "-vf",
            "fps=30,split[s0][s1];[s0]palettegen=max_colors=256:reserve_transparent=1:stats_mode=diff[p];[s1][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle:alpha_threshold=128",
            outFile,
        ];
    }
    return [
        "-y",
        "-framerate",
        String(ANIMATION_EXPORT_FPS),
        "-i",
        framePattern,
        "-vf",
        "fps=30,split[s0][s1];[s0]palettegen=max_colors=256:reserve_transparent=1:stats_mode=diff[p];[s1][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle:alpha_threshold=128",
        outFile,
    ];
}
export function movFfmpegArgs(framePattern: string, outFile: string, preset?: "compact" | "hq"): string[] {
    if (preset === "compact") {
        return [
            "-y",
            "-framerate",
            String(ANIMATION_EXPORT_FPS),
            "-i",
            framePattern,
            "-vf",
            "fps=30,scale=420:-1:flags=lanczos,pad=ceil(iw/2)*2:ceil(ih/2)*2,format=yuva444p10le",
            "-c:v",
            "prores_ks",
            "-profile:v",
            "4444",
            "-qscale:v",
            "34",
            "-movflags",
            "+faststart",
            outFile,
        ];
    }
    return [
        "-y",
        "-framerate",
        String(ANIMATION_EXPORT_FPS),
        "-i",
        framePattern,
        "-vf",
        "pad=ceil(iw/2)*2:ceil(ih/2)*2,format=yuva444p10le",
        "-c:v",
        "prores_ks",
        "-profile:v",
        "4444",
        "-qscale:v",
        "25",
        "-movflags",
        "+faststart",
        outFile,
    ];
}
export function frameFileName(tempDir: string, index: number): string {
    return path.join(tempDir, `frame_${String(index).padStart(4, "0")}.png`);
}
export function framePattern(tempDir: string): string {
    return path.join(tempDir, "frame_%04d.png");
}
export function gifsicleBin(): string {
    const entry = createRequire(import.meta.url).resolve("gifsicle");
    return path.join(path.dirname(entry), "vendor", "gifsicle");
}
export function gifsicleArgs(inFile: string, outFile: string, preset?: "compact" | "hq"): string[] {
    if (preset === "compact") {
        return ["--optimize=3", "--lossy=10", "--colors", "256", "-o", outFile, inFile];
    }
    return ["--optimize=3", "--colors", "256", "-o", outFile, inFile];
}
export function exportCacheKey(options: Pick<RenderAnimationOptions, "format" | "score" | "theme" | "accent"> & { preset?: string; style?: string }): string {
    return createHash("sha1").update(JSON.stringify(["v30", ANIMATION_EXPORT_FRAMES, options.format, options.preset ?? "hq", options.style ?? "card", options.score, options.theme, options.accent])).digest("hex");
}
export function exportCacheDir(): string {
    return path.join(os.tmpdir(), "osu-overlay-cache");
}
export function exportCachePath(key: string, format: AnimationExportFormat): string {
    return path.join(exportCacheDir(), `${key}.${format}`);
}
export function readFreshCache(cachePath: string): Buffer | null {
    try {
        const stat = fs.statSync(cachePath);
        if (Date.now() - stat.mtimeMs > EXPORT_CACHE_TTL_MS)
            return null;
        return fs.readFileSync(cachePath);
    }
    catch {
        return null;
    }
}
async function prepareExportPage(page: Page, pageUrl: string): Promise<void> {
    await page.goto(pageUrl, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
        const dock = document.getElementById("control-dock") ??
            document.querySelector(".animation-dock");
        if (dock)
            (dock as HTMLElement).style.display = "none";
    });
    await page.evaluate(async () => {
        if (window.loadDataFromUrlPromise) {
            try {
                await window.loadDataFromUrlPromise;
            }
            catch {
            }
        }
        if (window.waitForAllAssetsReady) {
            await window.waitForAllAssetsReady();
        }
    });
    await page.waitForSelector("#overlay-widget, .showcase-intro-container", { state: "visible" });
    await page.waitForTimeout(350);
    await page.evaluate(() => {
        if (window.stopLiveLoop)
            window.stopLiveLoop();
    });
}
export async function renderAnimationExport(options: RenderAnimationOptions, onProgress?: (done: number, total: number) => void): Promise<RenderedAnimation> {
    const key = exportCacheKey(options);
    const cachePath = exportCachePath(key, options.format);
    const cached = readFreshCache(cachePath);
    if (cached) {
        onProgress?.(ANIMATION_EXPORT_FRAMES, ANIMATION_EXPORT_FRAMES);
        return {
            bytes: cached,
            contentType: ANIMATION_EXPORT_MIME[options.format],
            fileName: animationExportFileName(options.format, options.preset, options.style),
        };
    }
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "osu-overlay-"));
    try {
        const isShowcase = options.style === "showcase";
        const viewport = isShowcase ? { width: 960, height: 540 } : EXPORT_VIEWPORT;
        const deviceScale = isShowcase ? 1.0 : EXPORT_DEVICE_SCALE;
        const pageUrl = buildAnimationExportPageUrl(options.baseUrl, {
            format: options.format,
            preset: options.preset,
            style: options.style,
            score: options.score,
            theme: options.theme,
            accent: options.accent,
        });
        const browser = await chromium.launch();
        try {
            const pages = await Promise.all(Array.from({ length: EXPORT_SHARD_COUNT }, async () => {
                const page = await browser.newPage({
                    viewport,
                    deviceScaleFactor: deviceScale,
                });
                await prepareExportPage(page, pageUrl);
                return page;
            }));
            const clip = await pages[0]!.evaluate(({ padding, viewport, isShowcase }) => {
                if (isShowcase) {
                    return { x: 0, y: 0, width: 960, height: 540 };
                }
                const widget = document.getElementById("overlay-widget");
                if (!widget)
                    return null;
                const rect = widget.getBoundingClientRect();
                const x = Math.max(0, Math.floor(rect.left - padding));
                const y = Math.max(0, Math.floor(rect.top - padding));
                const width = Math.min(viewport.width - x, Math.ceil(rect.right - x + padding));
                const height = Math.min(viewport.height - y, Math.ceil(rect.bottom - y + padding));
                return { x, y, width, height };
            }, { padding: EXPORT_CLIP_PADDING, viewport, isShowcase });
            const shot = clip ?? {
                x: 0,
                y: 0,
                width: viewport.width,
                height: viewport.height,
            };
            let done = 0;
            await Promise.all(pages.map((page, shard) => (async () => {
                for (let i = shard; i < ANIMATION_EXPORT_FRAMES; i += EXPORT_SHARD_COUNT) {
                    const t = (i / (ANIMATION_EXPORT_FRAMES - 1)) * ANIMATION_EXPORT_DURATION;
                    await page.evaluate((time) => {
                        if (window.seekAnimation)
                            window.seekAnimation(time);
                    }, t);
                    await page.screenshot({
                        path: frameFileName(tempDir, i),
                        clip: shot,
                        omitBackground: true,
                        animations: "disabled",
                    });
                    done += 1;
                    onProgress?.(done, ANIMATION_EXPORT_FRAMES);
                }
            })()));
        }
        finally {
            await browser.close();
        }
        const outFile = path.join(tempDir, options.format === "gif" ? "output.gif" : "output.mov");
        execFileSync("ffmpeg", options.format === "gif"
            ? gifFfmpegArgs(framePattern(tempDir), outFile, options.preset)
            : movFfmpegArgs(framePattern(tempDir), outFile, options.preset), { stdio: "pipe" });
        if (options.format === "gif") {
            try {
                const optimized = path.join(tempDir, "optimized.gif");
                execFileSync(gifsicleBin(), gifsicleArgs(outFile, optimized, options.preset), { stdio: "pipe" });
                fs.renameSync(optimized, outFile);
            }
            catch {
            }
        }
        const bytes = fs.readFileSync(outFile);
        try {
            fs.mkdirSync(exportCacheDir(), { recursive: true });
            fs.copyFileSync(outFile, cachePath);
        }
        catch {
        }
        return {
            bytes,
            contentType: ANIMATION_EXPORT_MIME[options.format],
            fileName: animationExportFileName(options.format, options.preset),
        };
    }
    finally {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        catch {
        }
    }
}

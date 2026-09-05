import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { chromium } from "playwright";
import { bootRenderServer } from "../src/server/renderServer";
import { generatePng } from "../src/server/render/generatePng";
let server: {
    port: number;
    close: () => Promise<void>;
};
beforeAll(async () => {
    server = await bootRenderServer();
});
afterAll(async () => {
    await server.close();
});
describe("render smoke test", () => {
    it("renders the fixture template at the exact requested dimensions", async () => {
        const png = await generatePng({
            fixture: "reference",
            template: "reference",
            width: 1280,
            height: 720,
            baseUrl: `http://localhost:${server.port}`,
        });
        const meta = await sharp(png).metadata();
        expect(meta.width).toBe(1280);
        expect(meta.height).toBe(720);
        expect(meta.format).toBe("png");
    }, 90000);
    it("scales to 1920x1080 from the same logical layout", async () => {
        const png = await generatePng({
            fixture: "reference",
            template: "reference",
            width: 1920,
            height: 1080,
            baseUrl: `http://localhost:${server.port}`,
        });
        const meta = await sharp(png).metadata();
        expect(meta.width).toBe(1920);
        expect(meta.height).toBe(1080);
    }, 90000);
});

it("keeps showcase export geometry equal to the preview", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
        await page.route("https://**", (route) => route.abort());
        const geometry = () => page.evaluate(() => {
            window.stopLiveLoop?.();
            window.seekAnimation?.(3);
            const root = document.querySelector<HTMLElement>(".showcase-intro-container")!;
            const bounds = root.getBoundingClientRect();
            const scale = bounds.width / root.offsetWidth;
            return [".showcase-lens-wrap", ".showcase-bottom-time", ".showcase-score-row", ".showcase-score-mods"].map((selector) => {
                const rect = root.querySelector(selector)!.getBoundingClientRect();
                return { x: Math.round((rect.x - bounds.x) / scale), y: Math.round((rect.y - bounds.y) / scale),
                    width: Math.round(rect.width / scale), height: Math.round(rect.height / scale) };
            });
        });
        await page.goto(`http://localhost:${server.port}/index.html?tab=animation&style=showcase`, { waitUntil: "networkidle" });
        const preview = await geometry();
        for (const format of ["gif", "mov"]) {
            await page.goto(`http://localhost:${server.port}/index.html?tab=animation&style=showcase&exportMode=1&format=${format}`, { waitUntil: "networkidle" });
            expect(await geometry()).toEqual(preview);
            expect(await page.locator(".showcase-intro-container").boundingBox()).toMatchObject({ x: 0, y: 0, width: 960, height: 540 });
        }
        const lens = preview[0]!;
        const mods = preview[3]!;
        expect(mods.y).toBeGreaterThan(lens.y + lens.height / 2);
        expect(mods.y + mods.height).toBeLessThan(lens.y + lens.height);
        expect(preview[1]!.y).toBeGreaterThan(preview[0]!.y + preview[0]!.height);
    }
    finally {
        await browser.close();
    }
});

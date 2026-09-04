import { chromium } from "playwright";
import { bootRenderServer } from "../src/server/renderServer";
async function main() {
    const fixtures = ["reference", "long"];
    const server = await bootRenderServer();
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({
            viewport: { width: 1280, height: 720 },
            deviceScaleFactor: 1,
        });
        for (const fixture of fixtures) {
            const params = new URLSearchParams({ fixture, template: "reference", scale: "1" });
            await page.goto(`http://localhost:${server.port}/render.html?${params}`, {
                waitUntil: "networkidle",
            });
            await page.waitForFunction(() => window.__THUMBNAIL_READY === true, null, { timeout: 30000 });
            await page.waitForTimeout(120);
            const out = `generated/matrix-${fixture}.png`;
            await page.locator("#thumbnail-root").screenshot({ path: out, animations: "disabled" });
            console.log("saved", out);
        }
    }
    finally {
        await browser.close();
        await server.close();
    }
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});

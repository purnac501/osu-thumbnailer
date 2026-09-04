import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
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

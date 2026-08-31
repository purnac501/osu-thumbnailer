import { chromium } from "playwright";
import sharp from "sharp";
import type { EditorState } from "../../thumbnail/overrides";

export interface GenerateOptions {
  url?: string;
  fixture?: string;
  template: string;
  width: number;
  height: number;
  /** Base URL of the running app (vite dev server or static build). */
  baseUrl: string;
  outFile?: string;
  /** Full editor state (overrides), forwarded to the render page. */
  edits?: EditorState;
  /** Legacy individual options; merged into edits for the render page. */
  accent?: string;
  twitchVisible?: boolean;
  bottomPrefix?: string;
  bottomHighlight?: string;
}

/**
 * Renders the template at an exact pixel resolution using headless Chromium.
 * Waits for fonts, images and layout stability, then screenshots only the
 * thumbnail root and verifies the output dimensions.
 */
export async function generatePng(options: GenerateOptions): Promise<Buffer> {
  const params = new URLSearchParams({ template: options.template });
  if (options.fixture) params.set("fixture", options.fixture);
  if (options.url) params.set("url", options.url);

  const edits: EditorState = {
    ...(options.edits ?? {}),
    accent: options.edits?.accent ?? options.accent,
    twitchVisible: options.edits?.twitchVisible ?? options.twitchVisible,
    bottomText: options.edits?.bottomText ?? options.bottomPrefix,
    bottomAccent: options.edits?.bottomAccent ?? options.bottomHighlight,
  };
  params.set("edits", JSON.stringify(edits));
  params.set("scale", String(options.width / 1280));

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: options.width, height: options.height },
      deviceScaleFactor: 1,
    });
    await page.goto(`${options.baseUrl}/render.html?${params.toString()}`, {
      waitUntil: "networkidle",
    });
    await page.waitForSelector("#thumbnail-root[data-render-ready], #thumbnail-root", {
      timeout: 30_000,
    });
    // data-render-ready is set by the Thumbnail effect once fonts+images settle.
    await page
      .waitForSelector("#thumbnail-root", { state: "attached" })
      .then(() => page.waitForFunction(() => window.__THUMBNAIL_READY === true, null, { timeout: 30_000 }));
    await page.evaluate(() => document.fonts.ready);
    // One frame of layout stability.
    await page.waitForTimeout(120);

    const root = page.locator("#thumbnail-root");
    const png = await root.screenshot({ path: options.outFile, animations: "disabled" });

    const meta = await sharp(png).metadata();
    if (meta.width !== options.width || meta.height !== options.height) {
      throw new Error(
        `Rendered PNG is ${meta.width}x${meta.height}, expected ${options.width}x${options.height}`,
      );
    }
    return png;
  } finally {
    await browser.close();
  }
}

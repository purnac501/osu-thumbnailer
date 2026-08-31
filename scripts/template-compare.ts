import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { bootRenderServer } from "../src/server/renderServer";
import { generatePng } from "../src/server/render/generatePng";

const ROOT = path.resolve(import.meta.dirname, "..");
const GENERATED = path.join(ROOT, "generated");

/**
 * Visual comparison workflow:
 * 1. renders the reference template at exactly 1024x576 with fixture data
 * 2. saves generated/reference-render.png
 * 3. diffs against reference/Reference.png -> generated/reference-diff.png
 * 4. builds a 50/50 overlay -> generated/reference-overlay.png
 * 5. prints pixelmatch metrics
 */
async function main() {
  fs.mkdirSync(GENERATED, { recursive: true });

  console.log("Booting render server...");
  const server = await bootRenderServer();

  try {
    const renderPath = path.join(GENERATED, "reference-render.png");
    await generatePng({
      fixture: "reference",
      template: "reference",
      width: 1024,
      height: 576,
      baseUrl: `http://localhost:${server.port}`,
      outFile: renderPath,
    });
    console.log(`Rendered: ${renderPath}`);

    const referencePath = path.join(ROOT, "reference", "Reference.png");
    const ref = PNG.sync.read(fs.readFileSync(referencePath));
    const gen = PNG.sync.read(fs.readFileSync(renderPath));

    if (ref.width !== gen.width || ref.height !== gen.height) {
      throw new Error(
        `Size mismatch: reference ${ref.width}x${ref.height} vs generated ${gen.width}x${gen.height}`,
      );
    }

    const diff = new PNG({ width: ref.width, height: ref.height });
    const mismatched = pixelmatch(ref.data, gen.data, diff.data, ref.width, ref.height, {
      threshold: 0.12,
    });
    const total = ref.width * ref.height;
    const similarity = (1 - mismatched / total) * 100;

    const diffPath = path.join(GENERATED, "reference-diff.png");
    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    // 50/50 overlay for eyeballing alignment.
    const half = await sharp(renderPath).ensureAlpha(0.5).png().toBuffer();
    await sharp(referencePath)
      .composite([{ input: half, blend: "over" }])
      .toFile(path.join(GENERATED, "reference-overlay.png"));

    console.log(`Diff image: ${path.join(GENERATED, "reference-diff.png")}`);
    console.log(`Overlay:    ${path.join(GENERATED, "reference-overlay.png")}`);
    const pct = ((mismatched / total) * 100).toFixed(2);
    console.log(`Mismatched pixels: ${mismatched} / ${total} (${pct}%)`);
    console.log(`Similarity: ${similarity.toFixed(2)}%`);
  } finally {
    await server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

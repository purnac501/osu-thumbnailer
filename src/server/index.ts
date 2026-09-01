import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getThumbnailData } from "./data/thumbnailService";
import { fixtureRegistry } from "./data/fixtures";
import { generatePng } from "./render/generatePng";
import { RESOLUTION_PRESETS } from "../thumbnail/types";
import { globalOsuQueue } from "../shared/osu/queue";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createServer({ serveStatic = true }: { serveStatic?: boolean } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "100kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/queue-status", (_req, res) => {
    res.json(globalOsuQueue.getStatus());
  });

  app.get("/api/fixture/:name", (req, res) => {
    const data = fixtureRegistry[req.params.name];
    if (!data) return res.status(404).send(`Unknown fixture: ${req.params.name}`);
    res.json({ data });
  });

  app.get("/api/thumbnail", async (req, res) => {
    const url = String(req.query.url ?? "");
    if (!url) return res.status(400).send("Missing url parameter");
    try {
      const { result, queueStats } = await globalOsuQueue.run(() => getThumbnailData(url));
      res.json({ ...result, queue: queueStats });
    } catch (err) {
      res.status(400).send(String(err instanceof Error ? err.message : err));
    }
  });

  app.post("/api/generate", async (req, res) => {
    const { url, resolution = "1280x720", fixture, edits } = req.body as {
      url?: string;
      resolution?: string;
      fixture?: string;
      edits?: Record<string, unknown>;
    };

    const preset = RESOLUTION_PRESETS[resolution as keyof typeof RESOLUTION_PRESETS];
    if (!preset) {
      return res.status(400).send(`Unknown resolution: ${resolution}`);
    }

    try {
      // The render page must be reachable from the headless browser: the vite
      // dev server during development, or APP_BASE_URL for static deployments.
      const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:5173";
      const png = await generatePng({
        url,
        fixture,
        template: "reference",
        width: preset.width,
        height: preset.height,
        baseUrl,
        edits: edits as never,
      });
      res.set("Content-Type", "image/png");
      res.send(png);
    } catch (err) {
      res.status(500).send(String(err instanceof Error ? err.message : err));
    }
  });

  // Serve the built client when it exists (production / CLI mode).
  if (serveStatic) {
    const distDir = path.resolve(__dirname, "../../dist");
    app.use(express.static(distDir));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  return app;
}

const isMain = process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js");

if (isMain) {
  const port = Number(process.env.PORT ?? 3737);
  const host = process.env.HOST ?? "127.0.0.1";
  createServer().listen(port, host, () => {
    console.log(`osu-thumbnailer API listening on http://${host}:${port}`);
  });
}

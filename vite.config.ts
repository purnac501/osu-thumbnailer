import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

function overlayExportPlugin(): Plugin {
  return {
    name: "overlay-export-plugin",
    configureServer(server) {
      // Fast Server-side Export (Deterministic seekAnimation + FFmpeg)
      server.middlewares.use("/api/export-animation", async (req, res) => {
        const urlObj = new URL(req.url || "", "http://localhost:5173");
        const format = urlObj.searchParams.get("format") || "gif"; // "gif" or "webm"
        const bg = urlObj.searchParams.get("bg") || "transparent";
        const score = urlObj.searchParams.get("score") || "";
        const theme = urlObj.searchParams.get("theme") || "";
        const accent = urlObj.searchParams.get("accent") || "";

        const tempDir = path.join(os.tmpdir(), `render_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
        fs.mkdirSync(tempDir, { recursive: true });

        try {
          const { chromium } = await import("playwright");
          const browser = await chromium.launch();
          const page = await browser.newPage({
            viewport: { width: 520, height: 410 },
            deviceScaleFactor: 1.5,
          });

          const targetUrl = `http://localhost:5173/overlay.html?bg=${encodeURIComponent(bg)}&exportMode=1${score ? "&url=" + encodeURIComponent(score) : ""}${theme ? "&theme=" + encodeURIComponent(theme) : ""}${accent ? "&accent=" + encodeURIComponent(accent) : ""}`;
          await page.goto(targetUrl, { waitUntil: "networkidle" });
          await page.evaluate(() => document.fonts.ready);

          // Hide dock in export
          await page.evaluate(() => {
            const dock = document.getElementById("control-dock");
            if (dock) dock.style.display = "none";
          });

          // Wait until all images, badges, and banner assets are 100% loaded and decoded
          await page.evaluate(async () => {
            if (window.loadDataFromUrlPromise) {
              try { await window.loadDataFromUrlPromise; } catch {}
            }
            if (window.waitForAllAssetsReady) {
              await window.waitForAllAssetsReady();
            }
          });
          await page.waitForTimeout(350);

          // Deterministic frame capture: 50 frames over 9.0 seconds
          const totalFrames = 50;
          const duration = 9.0;

          for (let i = 0; i < totalFrames; i++) {
            const t = (i / (totalFrames - 1)) * duration;
            await page.evaluate((time) => {
              if (window.seekAnimation) window.seekAnimation(time);
            }, t);

            const framePath = path.join(tempDir, `frame_${String(i).padStart(3, "0")}.png`);
            await page.screenshot({ path: framePath, omitBackground: bg === "transparent" });
          }

          await browser.close();

          if (format === "webm") {
            const outWebm = path.join(tempDir, "output.webm");
            execSync(`ffmpeg -y -framerate 12 -i "${tempDir}/frame_%03d.png" -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 2M "${outWebm}"`);
            const data = fs.readFileSync(outWebm);
            res.writeHead(200, {
              "Content-Type": "video/webm",
              "Content-Disposition": 'attachment; filename="osu-stream-overlay.webm"',
              "Content-Length": data.length,
            });
            res.end(data);
          } else {
            const outGif = path.join(tempDir, "output.gif");
            execSync(`ffmpeg -y -framerate 12 -i "${tempDir}/frame_%03d.png" -vf "split[s0][s1];[s0]palettegen=reserve_transparent=1[p];[s1][p]paletteuse=alpha_threshold=128" "${outGif}"`);
            const data = fs.readFileSync(outGif);
            res.writeHead(200, {
              "Content-Type": "image/gif",
              "Content-Disposition": 'attachment; filename="osu-stream-overlay.gif"',
              "Content-Length": data.length,
            });
            res.end(data);
          }
        } catch (err) {
          console.error("Export animation error:", err);
          res.statusCode = 500;
          res.end("Animation export failed: " + String(err));
        } finally {
          try {
            fs.rmSync(tempDir, { recursive: true, force: true });
          } catch {}
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), overlayExportPlugin()],
  build: {
    rollupOptions: {
      input: {
        index: "index.html",
        render: "render.html",
      },
    },
  },
  server: {
    host: true,
    proxy: {
      "/api": "http://localhost:8788",
    },
  },
});

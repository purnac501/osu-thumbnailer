import { defineConfig, type Plugin } from "vite";
import { randomUUID } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import react from "@vitejs/plugin-react";
import { ANIMATION_EXPORT_FRAMES, parseAnimationExportFormat, parseAnimationExportPreset, parseAnimationStyle } from "./src/shared/animation-export";
import { renderAnimationExport } from "./src/server/export-animation";
interface ExportJobState {
    done: number;
    total: number;
    state: "working" | "done" | "error";
    contentType?: string;
    fileName?: string;
    error?: string;
}
function exportJobDir(id: string): string {
    return path.join(os.tmpdir(), "osu-overlay-jobs", id);
}
function readJob(id: string): ExportJobState | null {
    try {
        return JSON.parse(fs.readFileSync(path.join(exportJobDir(id), "state.json"), "utf8")) as ExportJobState;
    }
    catch {
        return null;
    }
}
function writeJob(id: string, job: ExportJobState): void {
    fs.mkdirSync(exportJobDir(id), { recursive: true });
    fs.writeFileSync(path.join(exportJobDir(id), "state.json"), JSON.stringify(job));
}
function overlayExportPlugin(): Plugin {
    return {
        name: "overlay-export-plugin",
        configureServer(server) {
            server.middlewares.use("/api/export-animation/start", async (req, res) => {
                const urlObj = new URL(req.url || "", "http://localhost:5173");
                const id = randomUUID();
                writeJob(id, { done: 0, total: ANIMATION_EXPORT_FRAMES, state: "working" });
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ id }));
                try {
                    const rendered = await renderAnimationExport({
                        format: parseAnimationExportFormat(urlObj.searchParams.get("format")),
                        preset: parseAnimationExportPreset(urlObj.searchParams.get("preset") ?? urlObj.searchParams.get("compact")),
                        style: parseAnimationStyle(urlObj.searchParams.get("style")),
                        score: urlObj.searchParams.get("score") || "",
                        theme: urlObj.searchParams.get("theme") || "",
                        accent: urlObj.searchParams.get("accent") || "",
                        baseUrl: "http://localhost:5173",
                    }, (done, total) => {
                        writeJob(id, { done, total, state: "working" });
                    });
                    const outPath = path.join(exportJobDir(id), rendered.fileName);
                    fs.writeFileSync(outPath, rendered.bytes);
                    writeJob(id, {
                        done: ANIMATION_EXPORT_FRAMES,
                        total: ANIMATION_EXPORT_FRAMES,
                        state: "done",
                        contentType: rendered.contentType,
                        fileName: rendered.fileName,
                    });
                }
                catch (err) {
                    console.error("Export animation error:", err);
                    writeJob(id, { done: 0, total: ANIMATION_EXPORT_FRAMES, state: "error", error: String(err) });
                }
            });
            server.middlewares.use("/api/export-animation/progress", (req, res) => {
                const id = new URL(req.url || "", "http://localhost:5173").searchParams.get("id") || "";
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(readJob(id) ?? { state: "error", error: "Unknown export job" }));
            });
            server.middlewares.use("/api/export-animation/file", (req, res) => {
                const id = new URL(req.url || "", "http://localhost:5173").searchParams.get("id") || "";
                const job = readJob(id);
                const filePath = job?.fileName ? path.join(exportJobDir(id), job.fileName) : "";
                if (!job || job.state !== "done" || !filePath || !fs.existsSync(filePath)) {
                    res.statusCode = job?.state === "error" ? 500 : 404;
                    res.end(job?.error ?? "Export is not ready");
                    return;
                }
                const bytes = fs.readFileSync(filePath);
                setTimeout(() => {
                    try {
                        fs.rmSync(exportJobDir(id), { recursive: true, force: true });
                    } catch {}
                }, 10 * 60 * 1000);
                res.writeHead(200, {
                    "Content-Type": job.contentType,
                    "Content-Disposition": `attachment; filename="${job.fileName}"`,
                    "Content-Length": bytes.length,
                });
                res.end(bytes);
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

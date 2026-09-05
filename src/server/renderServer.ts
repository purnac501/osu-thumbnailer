import "dotenv/config";
import { type Express } from "express";
import { createServer as createViteServer, type ViteDevServer } from "vite";
import { createServer } from "./index";
export async function bootRenderServer(): Promise<{
    port: number;
    close: () => Promise<void>;
}> {
    const app: Express = createServer({ serveStatic: false });
    const vite: ViteDevServer = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
    });
    app.use(vite.middlewares);
    const server = await new Promise<import("node:http").Server>((resolve) => {
        const s = app.listen(0, () => resolve(s));
    });
    const addr = server.address();
    const port = typeof addr === "object" && addr !== null ? addr.port : 0;
    return {
        port,
        close: async () => {
            await new Promise<void>((resolve) => server.close(() => resolve()));
            await vite.close();
        },
    };
}

import fs from "node:fs";
import path from "node:path";
import { bootRenderServer } from "../src/server/renderServer";
import { generatePng } from "../src/server/render/generatePng";
interface CliArgs {
    url?: string;
    template: string;
    resolution: string;
    out: string;
    accent?: string;
    twitch?: boolean;
    prefix?: string;
    highlight?: string;
}
function parseArgs(argv: string[]): CliArgs {
    const args: CliArgs = { template: "reference", resolution: "1280x720", out: "" };
    const positional: string[] = [];
    for (let i = 0; i < argv.length; i++) {
        switch (argv[i]) {
            case "--template":
                args.template = argv[++i] ?? "reference";
                break;
            case "--resolution":
                args.resolution = argv[++i] ?? "1280x720";
                break;
            case "--out":
                args.out = argv[++i] ?? "";
                break;
            case "--accent":
                args.accent = argv[++i];
                break;
            case "--twitch":
                args.twitch = argv[++i] !== "false";
                break;
            case "--prefix":
                args.prefix = argv[++i];
                break;
            case "--highlight":
                args.highlight = argv[++i];
                break;
            default: {
                const arg = argv[i];
                if (arg !== undefined)
                    positional.push(arg);
            }
        }
    }
    if (positional.length > 0)
        args.url = positional[0];
    return args;
}
async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.url) {
        console.error("Usage: npm run generate -- <score-url> [--template reference] [--resolution 1280x720] [--out file.png]");
        process.exit(1);
    }
    const [widthStr, heightStr] = args.resolution.split("x");
    const width = Number(widthStr);
    const height = Number(heightStr);
    if (!width || !height || width / height !== 16 / 9) {
        console.error(`Invalid resolution: ${args.resolution} (use e.g. 1280x720, 16:9 only)`);
        process.exit(1);
    }
    console.log("Booting render server...");
    const server = await bootRenderServer();
    try {
        const outFile = args.out || path.resolve(`osu-thumbnail-${width}x${height}.png`);
        const png = await generatePng({
            url: args.url,
            template: args.template,
            width,
            height,
            baseUrl: `http://localhost:${server.port}`,
            outFile,
            accent: args.accent,
            twitchVisible: args.twitch,
            bottomPrefix: args.prefix,
            bottomHighlight: args.highlight,
        });
        if (!args.out)
            fs.writeFileSync(outFile, png);
        const kb = (png.length / 1024).toFixed(0);
        console.log(`Saved ${outFile} (${width}x${height}, ${kb} KB)`);
    }
    finally {
        await server.close();
    }
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});

import type { Ruleset } from "../types/thumbnail";
export interface ParsedScoreUrl {
    ruleset: Ruleset | null;
    scoreId: string;
}
const RULESETS: Ruleset[] = ["osu", "taiko", "fruits", "mania"];
export function parseScoreUrl(input: string): ParsedScoreUrl | null {
    const raw = input.trim();
    if (!raw)
        return null;
    let url: URL;
    try {
        url = new URL(raw);
    }
    catch {
        return null;
    }
    if (url.hostname !== "osu.ppy.sh" || url.protocol !== "https:" && url.protocol !== "http:") {
        return null;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] !== "scores" || segments.length < 2 || segments.length > 3) {
        return null;
    }
    const last = segments[segments.length - 1] as string;
    if (!/^\d+$/.test(last))
        return null;
    if (segments.length === 2) {
        return { ruleset: null, scoreId: last };
    }
    const mode = segments[1] as string;
    if (!RULESETS.includes(mode as Ruleset))
        return null;
    return { ruleset: mode as Ruleset, scoreId: last };
}

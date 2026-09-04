import { describe, expect, it } from "vitest";
import { parseScoreUrl } from "../src/shared/score-url/parseScoreUrl";
describe("parseScoreUrl", () => {
    it("parses mode-less score URLs as lazer solo score ids", () => {
        expect(parseScoreUrl("https://osu.ppy.sh/scores/123456789")).toEqual({
            ruleset: null,
            scoreId: "123456789",
        });
    });
    it("parses ruleset score URLs", () => {
        for (const mode of ["osu", "taiko", "fruits", "mania"]) {
            expect(parseScoreUrl(`https://osu.ppy.sh/scores/${mode}/42`)).toEqual({
                ruleset: mode,
                scoreId: "42",
            });
        }
    });
    it("tolerates whitespace, query strings, and trailing slashes", () => {
        expect(parseScoreUrl("  https://osu.ppy.sh/scores/osu/123/?foo=bar  ")).toEqual({
            ruleset: "osu",
            scoreId: "123",
        });
    });
    it("accepts http for local testing", () => {
        expect(parseScoreUrl("http://osu.ppy.sh/scores/7")).toEqual({
            ruleset: null,
            scoreId: "7",
        });
    });
    it("rejects unrelated URLs and garbage", () => {
        expect(parseScoreUrl("https://google.com/scores/123")).toBeNull();
        expect(parseScoreUrl("https://osu.ppy.sh/beatmapsets/123")).toBeNull();
        expect(parseScoreUrl("https://osu.ppy.sh/scores/osu/abc")).toBeNull();
        expect(parseScoreUrl("https://osu.ppy.sh/scores")).toBeNull();
        expect(parseScoreUrl("https://osu.ppy.sh/scores/osu/123/456")).toBeNull();
        expect(parseScoreUrl("")).toBeNull();
        expect(parseScoreUrl("not a url")).toBeNull();
    });
});

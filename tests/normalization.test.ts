import { describe, expect, it } from "vitest";
import { getClockRate, modAssetPath, normalizeMods } from "../src/shared/mods/mods";
import { detectStatus } from "../src/shared/normalize/status";
import { backgroundCandidates, normalizeScore } from "../src/shared/normalize/normalizeScore";
import type { ApiScore } from "../src/shared/types/osu";
import { referenceFixtureScore } from "../src/server/data/fixtures";
import { applyDataOverrides, applyOverrides } from "../src/thumbnail/overrides";
import { referenceTemplate } from "../src/thumbnail/templates/reference/template";
import { formatPp } from "../src/shared/formatting/format";
import { OsuRequestQueue } from "../src/shared/osu/queue";
import { withTextOverride } from "../src/thumbnail/texts";
describe("mods", () => {
    it("normalizes legacy acronym strings and structured mods", () => {
        expect(normalizeMods(["HD", "DT"])).toEqual([
            { acronym: "HD" },
            { acronym: "DT" },
        ]);
        expect(normalizeMods([{ acronym: "NC", settings: { speed_change: 1.4 } }])).toEqual([
            { acronym: "NC", settings: { speed_change: 1.4 } },
        ]);
        expect(normalizeMods(undefined)).toEqual([]);
    });
    it("computes clock rate from traditional mods", () => {
        expect(getClockRate(normalizeMods(["DT"]))).toBe(1.5);
        expect(getClockRate(normalizeMods(["NC"]))).toBe(1.5);
        expect(getClockRate(normalizeMods(["HT"]))).toBe(0.75);
        expect(getClockRate(normalizeMods(["HD", "HR"]))).toBe(1);
    });
    it("prefers structured lazer speed_change settings", () => {
        const mods = normalizeMods([{ acronym: "DT", settings: { speed_change: 1.75 } }]);
        expect(getClockRate(mods)).toBe(1.75);
    });
    it("maps acronyms to bundled assets and leaves unknown ones for fallback", () => {
        expect(modAssetPath("HD")).toBe("/assets/osu/mods/mod-hidden.svg");
        expect(modAssetPath("NC")).toBe("/assets/osu/mods/mod-nightcore.svg");
        expect(modAssetPath("XX")).toBeNull();
    });
});
describe("status / FC detection", () => {
    it("detects FC from a perfect score", () => {
        expect(detectStatus({ ...referenceFixtureScore }).kind).toBe("fc");
    });
    it("reports miss count", () => {
        const score = { ...referenceFixtureScore, is_perfect_combo: true, statistics: { great: 10, miss: 2 } };
        expect(detectStatus(score)).toEqual({ kind: "miss", count: 2 });
    });
    it("detects FC when slider ends are dropped near max combo without misses or slider breaks", () => {
        const score: ApiScore = {
            ...referenceFixtureScore,
            max_combo: 275,
            is_perfect_combo: false,
            statistics: { great: 50, miss: 0 },
        };
        expect(detectStatus(score, 279).kind).toBe("fc");
    });
    it("does not detect FC when a slider break occurs in the middle of the map", () => {
        const score: ApiScore = {
            ...referenceFixtureScore,
            max_combo: 140,
            is_perfect_combo: false,
            statistics: { great: 50, miss: 0 },
        };
        expect(detectStatus(score, 279).kind).toBe("unknown");
    });
    it("counts only large tick misses as slider breaks", () => {
        const score: ApiScore = {
            ...referenceFixtureScore,
            is_perfect_combo: undefined,
            statistics: { great: 10, large_tick_miss: 2, small_tick_miss: 4 },
        };
        expect(detectStatus(score).kind).toBe("unknown");
        expect(normalizeScore(score).sbCount).toBe(2);
    });
});
describe("background fallbacks", () => {
    it("prefers provided covers in quality order", () => {
        const chain = backgroundCandidates(1, { raw: "r.jpg", cover: "c.jpg" });
        expect(chain).toEqual(["r.jpg", "c.jpg"]);
    });
    it("falls back to the documented assets.ppy.sh route", () => {
        const chain = backgroundCandidates(1234);
        expect(chain[0]).toBe("https://assets.ppy.sh/beatmaps/1234/covers/raw.jpg");
        expect(chain.length).toBeGreaterThanOrEqual(3);
    });
});
describe("normalizeScore", () => {
    it("builds the thumbnail model from a raw API score", () => {
        const data = normalizeScore(referenceFixtureScore, { moddedStarRating: 10.53, baseBpm: 130 });
        expect(data.username).toBe("Name");
        expect(data.countryCode).toBe("PL");
        expect(data.pp).toBeCloseTo(1207.34);
        expect(data.grade).toBe("S");
        expect(data.maxCombo).toBe(279);
        expect(data.leaderboardPosition).toBe(2);
        expect(data.isFullCombo).toBe(true);
        expect(data.effectiveBpm).toBe(195);
        expect(data.moddedStarRating).toBe(10.53);
        expect(data.mods.map((m) => m.acronym)).toEqual(["HD", "NC"]);
    });
    it("keeps rank (grade) separate from leaderboard position", () => {
        const data = normalizeScore(referenceFixtureScore);
        expect(data.grade).toBe("S");
        expect(data.leaderboardPosition).toBe(2);
    });
    it("hides an unavailable zero leaderboard position", () => {
        const score = { ...referenceFixtureScore, rank_global: 0 };
        const data = normalizeScore(score, { leaderboardPosition: 0 });
        expect(data.leaderboardPosition).toBeUndefined();
    });
});
describe("manual score-data overrides", () => {
    it("renders a manual slider-break count as a broken combo", () => {
        const data = normalizeScore(referenceFixtureScore);
        const edited = applyDataOverrides(data, { sliderBreakCount: 3 });
        expect(edited.sbCount).toBe(3);
        expect(edited.status.kind).toBe("unknown");
        expect(edited.isFullCombo).toBe(false);
    });
    it("renders manual miss count and statusKind overrides", () => {
        const data = normalizeScore(referenceFixtureScore);
        const missEdited = applyDataOverrides(data, { missCount: 2 });
        expect(missEdited.missCount).toBe(2);
        expect(missEdited.status).toEqual({ kind: "miss", count: 2 });
        expect(missEdited.isFullCombo).toBe(false);
        const fcEdited = applyDataOverrides(missEdited, { statusKind: "fc", missCount: 0, sliderBreakCount: 0 });
        expect(fcEdited.status).toEqual({ kind: "fc" });
        expect(fcEdited.isFullCombo).toBe(true);
        const dualEdited = applyDataOverrides(data, { missCount: 1, sliderBreakCount: 1 });
        expect(dualEdited.missCount).toBe(1);
        expect(dualEdited.sbCount).toBe(1);
        expect(dualEdited.status).toEqual({ kind: "miss", count: 1 });
        expect(dualEdited.isFullCombo).toBe(false);
    });
    it("preserves beatmap status from API response", () => {
        const graveyardScore: ApiScore = {
            ...referenceFixtureScore,
            beatmap: { ...referenceFixtureScore.beatmap!, status: "graveyard" },
        };
        expect(normalizeScore(graveyardScore).beatmapStatus).toBe("graveyard");
        const qualifiedScore: ApiScore = {
            ...referenceFixtureScore,
            beatmap: { ...referenceFixtureScore.beatmap!, status: "qualified" },
        };
        expect(normalizeScore(qualifiedScore).beatmapStatus).toBe("qualified");
    });
    it("maps qualified to approved notch and graveyard to unranked notch", () => {
        expect(referenceTemplate.components.starNotch.assets?.qualified).toBe("/assets/osu/notch/approved.png");
        expect(referenceTemplate.components.starNotch.statusColors?.qualified).toBe("#3EA551");
        expect(referenceTemplate.components.starNotch.assets?.graveyard).toBe("/assets/osu/notch/unranked.png");
        expect(referenceTemplate.components.starNotch.statusColors?.graveyard).toBe("#6D6C70");
    });
    it("applies fontSizeOverrides and colorOverrides to template components and custom texts", () => {
        const custom = {
            id: "custom-test", text: "2407PP", visible: true, x: 10, y: 20,
            fontFamily: "Montserrat", fontSize: 40, fontWeight: 600, color: "#fff",
        };
        const template = applyOverrides(referenceTemplate, {
            customTexts: [custom],
            positionOverrides: { "status-sb": { x: 350, y: 120 } },
            fontSizeOverrides: { pp: 140, "custom-test": 60, status: 200, "status-sb": 80 },
            colorOverrides: { pp: "#00FFCC", "custom-test": "#FF9900", status: "#FF0055", "status-sb": "#FFAA00" },
        });
        expect(template.components.pp.fontSize).toBe(140);
        expect(template.components.pp.color).toBe("#00FFCC");
        expect(template.components.status.fontSize).toBe(200);
        expect(template.components.status.color).toBe("#FF0055");
        expect(template.components.statusSB.fontSize).toBe(80);
        expect(template.components.statusSB.color).toBe("#FFAA00");
        expect(template.components.statusSB.x).toBe(350);
        expect(template.components.statusSB.y).toBe(120);
        expect(template.customTexts?.[0]?.fontSize).toBe(60);
        expect(template.customTexts?.[0]?.color).toBe("#FF9900");
    });
    it("formats PP as ?PP for graveyard and unranked scores without PP", () => {
        const graveyardScore: ApiScore = {
            ...referenceFixtureScore,
            pp: null,
        };
        const data = normalizeScore(graveyardScore);
        expect(data.pp).toBeUndefined();
        expect(formatPp(data.pp)).toBe("?PP");
    });
    it("keeps the PP suffix outside the editable override", () => {
        const texts = { pp: "1207PP" };
        expect(withTextOverride("pp", texts, { ...referenceTemplate, textOverrides: { pp: "1375" } })).toBe("1375PP");
        expect(withTextOverride("pp", texts, { ...referenceTemplate, textOverrides: { pp: "1375PP" } })).toBe("1375PP");
    });
});
describe("OsuRequestQueue", () => {
    it("enqueues and processes tasks with queue statistics", async () => {
        const queue = new OsuRequestQueue();
        expect(queue.getStatus().queuedCount).toBe(0);
        const task1 = queue.run(async () => "result1");
        const task2 = queue.run(async () => "result2");
        const [res1, res2] = await Promise.all([task1, task2]);
        expect(res1.result).toBe("result1");
        expect(res2.result).toBe("result2");
        expect(res1.queueStats.queuePosition).toBeGreaterThanOrEqual(1);
        expect(res2.queueStats.queuePosition).toBeGreaterThanOrEqual(1);
        expect(queue.getStatus().totalProcessed).toBe(2);
    });
    it("rejects work when its pending queue is full", async () => {
        const queue = new OsuRequestQueue(1, 0, 1);
        let release!: () => void;
        const blocker = new Promise<void>((resolve) => { release = resolve; });
        const active = queue.run(() => blocker);
        const pending = queue.run(async () => "pending");
        await expect(queue.run(async () => "overflow")).rejects.toThrow("queue is full");
        release();
        await Promise.all([active, pending]);
    });
});

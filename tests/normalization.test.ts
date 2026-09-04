import { describe, expect, it } from "vitest";
import { getClockRate, modAssetPath, normalizeMods } from "../src/shared/mods/mods";
import { detectStatus } from "../src/shared/normalize/status";
import { backgroundCandidates, normalizeScore } from "../src/shared/normalize/normalizeScore";
import type { ApiScore } from "../src/shared/types/osu";
import { referenceFixtureScore, referenceFixtureThumbnail } from "../src/server/data/fixtures";
import { applyDataOverrides, applyOverrides } from "../src/thumbnail/overrides";
import { referenceTemplate } from "../src/thumbnail/templates/reference/template";
import { cuteTemplate } from "../src/thumbnail/templates/cute/template";
import { leaderboardColor } from "../src/thumbnail/Thumbnail";
import { formatPp } from "../src/shared/formatting/format";
import { OsuRequestQueue } from "../src/shared/osu/queue";
import { computeTexts, withTextOverride } from "../src/thumbnail/texts";
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
    it.each(["X", "XH"])("renders the osu! %s rank as SS", (rank) => {
        const data = normalizeScore({ ...referenceFixtureScore, rank });
        expect(data.grade).toBe("SS");
    });
    it("keeps the CPOL grade inside its column", () => {
        expect(referenceTemplate.components.grade.y).toBe(350);
        expect(referenceTemplate.components.grade.maxWidth).toBe(205);
        expect(referenceTemplate.components.grade.x + referenceTemplate.components.grade.maxWidth!).toBeLessThan(300);
    });
    it("keeps CPOL text glows restrained", () => {
        const glowing = [
            referenceTemplate.components.status,
            referenceTemplate.components.statusMiss,
            referenceTemplate.components.statusSB,
            referenceTemplate.components.starRating,
            referenceTemplate.components.pp,
            referenceTemplate.components.grade,
            referenceTemplate.components.accuracy,
            referenceTemplate.components.leaderboard,
        ];
        expect(glowing.every((layer) => (layer.glow?.blur ?? 0) <= 18)).toBe(true);
    });
    it.each([
        [1, "#E7CE56"],
        [2, "#A5A4A6"],
        [3, "#CD7F32"],
        [4, "#63E564"],
    ])("colors leaderboard position #%s", (leaderboardPosition, color) => {
        const data = { ...referenceFixtureThumbnail, leaderboardPosition };
        expect(leaderboardColor(data, referenceTemplate)).toBe(color);
    });
    it("hides an unavailable zero leaderboard position", () => {
        const score = { ...referenceFixtureScore, rank_global: 0 };
        const data = normalizeScore(score, { leaderboardPosition: 0 });
        expect(data.leaderboardPosition).toBeUndefined();
    });
});
describe("Clean layout", () => {
    it("keeps primary text readable at feed scale", () => {
        expect(cuteTemplate.components.pp.fontSize).toBeGreaterThanOrEqual(130);
        expect(cuteTemplate.components.statusMiss.fontSize).toBeGreaterThanOrEqual(44);
        expect(cuteTemplate.components.accuracy.fontSize).toBeGreaterThanOrEqual(40);
        expect(cuteTemplate.components.starRating.fontSize).toBeGreaterThanOrEqual(44);
        expect(cuteTemplate.components.usernamePanel.fontSize).toBeGreaterThanOrEqual(38);
    });
    it("uses a large centered map block with a quieter artist", () => {
        expect(cuteTemplate.components.mapTitle.fontSize).toBeGreaterThanOrEqual(54);
        expect(cuteTemplate.components.mapTitle.width).toBe(1160);
        expect(cuteTemplate.components.mapTitle.align).toBe("center");
        expect(cuteTemplate.components.mapArtist?.align).toBe("center");
        expect(cuteTemplate.components.mapArtist?.fontSize).toBeLessThan(cuteTemplate.components.mapTitle.fontSize);
        expect(cuteTemplate.components.mapArtist?.color).toBe("#C8C3CC");
        expect(cuteTemplate.components.mapArtist?.y).toBeGreaterThan(cuteTemplate.components.topPanel.y + cuteTemplate.components.topPanel.height);
        expect(cuteTemplate.components.difficultyBadge.textTransform).toBe("uppercase");
    });
    it("uses semantic status colors without pill containers", () => {
        expect(cuteTemplate.components.status.color).toBe("#FFD166");
        expect(cuteTemplate.components.statusMiss.color).toBe("#FF5252");
        expect(cuteTemplate.components.statusSB.color).toBe("#FFFFFF");
        for (const layer of [cuteTemplate.components.status, cuteTemplate.components.statusMiss, cuteTemplate.components.statusSB, cuteTemplate.components.starRating, cuteTemplate.components.mapTitle]) {
            expect(layer.background).toBeUndefined();
            expect(layer.border).toBeUndefined();
        }
        expect(cuteTemplate.components.usernamePanel.background).toBe("transparent");
        expect(cuteTemplate.components.usernamePanel.borderWidth).toBe(0);
        expect(cuteTemplate.dataOptions).toMatchObject({
            fcText: "FC",
            missText: "{count}x",
            sbText: "{count}xSB",
        });
    });
    it("uses one gold star after the star rating", () => {
        expect(computeTexts(referenceFixtureThumbnail, cuteTemplate)["star-rating"]).toMatch(/^\d+\.\d{2} ★$/);
        expect(cuteTemplate.components.starRating.color).toBe("#FFD166");
    });
    it("centers the beatmap status notch at the top", () => {
        expect(cuteTemplate.components.starNotch).toMatchObject({ visible: true, x: 555, y: 0, width: 170, height: 86 });
        expect(cuteTemplate.components.starNotch.x + cuteTemplate.components.starNotch.width / 2).toBe(640);
        expect(cuteTemplate.components.starNotch.assets).toMatchObject({
            ranked: "/assets/osu/notch/ranked.png",
            loved: "/assets/osu/notch/loved.png",
            approved: "/assets/osu/notch/approved.png",
            graveyard: "/assets/osu/notch/unranked.png",
        });
    });
    it("uses the poster-style result grid", () => {
        expect(cuteTemplate.components.starRating).toMatchObject({ x: 500, y: 98, width: 280, fontSize: 73 });
        expect(cuteTemplate.components.statusMiss).toMatchObject({ x: 930, y: 185, height: 275, valign: "center", width: 260, fontSize: 158 });
        expect(cuteTemplate.components.status).toMatchObject({ x: 930, y: 185, height: 275, valign: "center", width: 260, fontSize: 158 });
        expect(cuteTemplate.components.statusSB).toMatchObject({ x: 930, y: 185, height: 275, valign: "center", width: 260, fontSize: 120 });
        expect(cuteTemplate.components.accuracy).toMatchObject({ x: 960, y: 112, width: 260, fontSize: 62, align: "right" });
        expect(cuteTemplate.components.leaderboard).toMatchObject({ x: 960, y: 66, width: 260, fontSize: 40, align: "right" });
        expect(cuteTemplate.components.grade).toMatchObject({ x: 70, y: 185, height: 275, valign: "center", width: 280, fontSize: 190 });
        expect(cuteTemplate.components.pp).toMatchObject({ x: 360, y: 185, height: 275, valign: "center", width: 560, fontSize: 130 });
        expect(cuteTemplate.components.pp.align).toBe("center");
        expect(cuteTemplate.components.starRating.x + cuteTemplate.components.starRating.width! / 2).toBe(640);
        expect(cuteTemplate.components.mapArtist!.x + cuteTemplate.components.mapArtist!.width! / 2).toBe(640);
        expect(cuteTemplate.components.mapTitle.x + cuteTemplate.components.mapTitle.width! / 2).toBe(640);
        expect(cuteTemplate.components.badgeRow.x + cuteTemplate.components.badgeRow.width / 2).toBe(640);
        expect(cuteTemplate.components.grade.height).toBe(275);
    });
    it("shows the CPOL score and map data", () => {
        expect(cuteTemplate.components.comboBadge.visible).toBe(true);
        expect(cuteTemplate.components.difficultyBadge.visible).toBe(true);
        expect(cuteTemplate.components.bpmBadge.visible).toBe(true);
        expect(cuteTemplate.components.grade.visible).toBe(true);
    });
    it("groups score information on one middle glass panel", () => {
        expect(cuteTemplate.components.topPanel).toMatchObject({
            visible: true,
            x: 30,
            y: 185,
            width: 1220,
            height: 275,
            backdropBlur: 10,
        });
        expect(cuteTemplate.components.sparkles?.visible).toBe(false);
        expect(cuteTemplate.components.innerBorder?.visible).toBe(false);
    });
    it("applies the selected accent to the Cute frame tint", () => {
        const edited = applyOverrides(cuteTemplate, { accent: "#00F0FF" });
        expect(edited.background.overlays?.some((overlay) => overlay.boxShadow?.includes("rgba(0, 240, 255, 0.25)"))).toBe(true);
        expect(edited.components.innerBorder?.border).toContain("rgba(0, 240, 255, 0.55)");
    });
});
describe("manual score-data overrides", () => {
    it("can hide only the Classic mod", () => {
        const data = {
            ...referenceFixtureThumbnail,
            mods: [
                { acronym: "CL", name: "Classic" },
                { acronym: "HD", name: "Hidden" },
            ],
        };
        expect(applyDataOverrides(data, { classicVisible: false }).mods.map((mod) => mod.acronym)).toEqual(["HD"]);
        expect(applyDataOverrides(data, {}).mods.map((mod) => mod.acronym)).toEqual(["CL", "HD"]);
    });
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

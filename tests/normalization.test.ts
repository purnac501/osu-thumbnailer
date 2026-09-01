import { describe, expect, it } from "vitest";
import { getClockRate, modAssetPath, normalizeMods } from "../src/shared/mods/mods";
import { detectStatus } from "../src/shared/normalize/status";
import { backgroundCandidates, normalizeScore } from "../src/shared/normalize/normalizeScore";
import type { ApiScore } from "../src/shared/types/osu";
import { referenceFixtureScore } from "../src/server/data/fixtures";
import { applyDataOverrides, applyOverrides } from "../src/thumbnail/overrides";
import { referenceTemplate } from "../src/thumbnail/templates/reference/template";

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

  it("does not claim FC when combo is broken without misses", () => {
    const score = { ...referenceFixtureScore, is_perfect_combo: false };
    expect(detectStatus(score).kind).toBe("unknown");
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
    expect(data.effectiveBpm).toBe(195); // 130 * 1.5 (NC)
    expect(data.moddedStarRating).toBe(10.53);
    expect(data.mods.map((m) => m.acronym)).toEqual(["HD", "NC"]);
  });

  it("keeps rank (grade) separate from leaderboard position", () => {
    const data = normalizeScore(referenceFixtureScore);
    expect(data.grade).toBe("S");
    expect(data.leaderboardPosition).toBe(2);
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

  it("keeps custom text in downloaded template overrides", () => {
    const custom = {
      id: "custom-test", text: "2407PP", visible: true, x: 10, y: 20,
      fontFamily: "Montserrat", fontSize: 40, fontWeight: 600, color: "#fff",
    };
    const template = applyOverrides(referenceTemplate, {
      customTexts: [custom],
      positionOverrides: { "custom-test": { x: 30, y: 40 } },
    });
    expect(template.customTexts?.[0]).toMatchObject({ text: "2407PP", x: 30, y: 40 });
  });
});


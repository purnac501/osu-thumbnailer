import { describe, expect, it } from "vitest";
import {
  formatAccuracy,
  formatBpm,
  formatCombo,
  formatLeaderboardPosition,
  formatMapName,
  formatPp,
  formatStarRating,
} from "../src/shared/formatting/format";

describe("formatting", () => {
  it("formats PP without decimals by default", () => {
    expect(formatPp(1207.34)).toBe("1207PP");
    expect(formatPp(812.6, 1)).toBe("812.6PP");
    expect(formatPp(undefined)).toBe("");
  });

  it("formats accuracy as percentage", () => {
    expect(formatAccuracy(0.992612)).toBe("99.26%");
    expect(formatAccuracy(1)).toBe("100.00%");
    expect(formatAccuracy(0)).toBe("0.00%");
  });

  it("formats combo", () => {
    expect(formatCombo(279)).toBe("279x");
  });

  it("formats bpm", () => {
    expect(formatBpm(195)).toBe("195bpm");
    expect(formatBpm(161.25, 2)).toBe("161.25bpm");
  });

  it("formats star rating", () => {
    expect(formatStarRating(10.528)).toBe("10.53");
    expect(formatStarRating(undefined)).toBe("");
  });

  it("formats leaderboard position, distinct from grade rank", () => {
    expect(formatLeaderboardPosition(2)).toBe("#2");
    expect(formatLeaderboardPosition(undefined)).toBe("");
  });

  it("formats map name", () => {
    const data = { artist: "Artist", title: "MAP NAME" };
    expect(formatMapName(data, "artist-title")).toBe("Artist - MAP NAME");
    expect(formatMapName(data, "title")).toBe("MAP NAME");
  });
});

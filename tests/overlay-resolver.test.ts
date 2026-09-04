import { describe, expect, it, vi } from "vitest";
import { resolveOverlayData } from "../src/server/overlayResolver";
import type { OsuClient } from "../src/shared/osu/client";
function digits(value: string): number {
    return Number(value.replace(/[^0-9]/g, "")) || 0;
}
const user = {
    id: 12345,
    username: "TestPlayer",
    is_supporter: false,
    country_code: "US",
    statistics: {
        country_rank: 10,
        global_rank: 5000,
        pp: 1234.5,
        play_time: 7200,
        play_count: 9000,
    },
    monthly_playcounts: [
        { start_date: "2019-03-01", count: 100 },
        { start_date: "2020-06-01", count: 900 },
    ],
    badges: [{ image_url: "https://example.com/b.png", description: "Winner" }],
    cover_url: "https://example.com/cover.jpg",
    avatar_url: "https://example.com/a.jpg",
};
const beatmap = {
    id: 999,
    version: "Insane",
    ar: 9,
    accuracy: 8.5,
    cs: 4,
    drain: 5,
    bpm: 200,
    difficulty_rating: 6.5,
    user_id: 42,
    beatmapset: {
        title: "Song",
        artist: "Artist",
        creator: "Mapper",
        favourite_count: 138,
        play_count: 17632,
        covers: { cover: "https://example.com/c.jpg" },
    },
};
function clientWith(scoreMods: unknown, scoreThrows = false, moddedAttributes: any = null): OsuClient {
    const lifeline = {
        ...structuredClone(user),
        id: 11367222,
        username: "lifeline",
        country_code: "ID",
        badges: [],
    };
    return {
        fetchScore: scoreThrows
            ? vi.fn().mockRejectedValue(new Error("not found"))
            : vi.fn().mockResolvedValue({ user: { id: 12345 }, beatmap: { id: 999 }, mods: scoreMods }),
        apiGet: vi.fn().mockImplementation(async (path: string) => {
            if (path.includes("11367222"))
                return structuredClone(lifeline);
            if (path.startsWith("/users/"))
                return structuredClone(user);
            return structuredClone(beatmap);
        }),
        getModdedBeatmapAttributes: vi.fn().mockResolvedValue(moddedAttributes),
        fetchLeaderboardPosition: vi.fn(),
    } as unknown as OsuClient;
}
const identity = (url?: string) => url;
describe("resolveOverlayData", () => {
    it("resolves player, map, peak, and badges from a score", async () => {
        const data = await resolveOverlayData("https://osu.ppy.sh/scores/5500357550", clientWith([]), identity);
        expect(data.player.username).toBe("TestPlayer");
        expect(data.player.isSupporter).toBe(false);
        expect(data.player.flag).toBe("🇺🇸");
        expect(data.player.countryCode).toBe("US");
        expect(data.player.grank).toBe("#5000");
        expect(data.player.crank).toBe("#10");
        expect(data.player.pp).toBe("1,235pp");
        expect(data.player.hours).toBe(2);
        expect(data.player.playcount).toBe(9000);
        expect(data.player.badgeCount).toBe(1);
        expect(data.player.peakMonth).toBe("June 2020");
        expect(data.player.peakCount).toBe(900);
        expect(data.map.title).toBe("Song [Insane]");
        expect(data.map.artist).toBe("by Artist");
        expect(data.map.bpm).toBe("200bpm");
        expect(data.map.sr).toBe("6.50");
        expect(digits(data.map.favs)).toBe(138);
        expect(digits(data.map.plays)).toBe(17632);
    });
    it("shows supporter status from the user API", async () => {
        const client = clientWith([]);
        vi.mocked(client.apiGet).mockImplementation(async (path: string) => {
            if (path.startsWith("/users/"))
                return { ...structuredClone(user), is_supporter: true };
            return structuredClone(beatmap);
        });
        const data = await resolveOverlayData("https://osu.ppy.sh/scores/5500357550", client, identity);
        expect(data.player.isSupporter).toBe(true);
    });
    it("applies DT transforms for string and object mods", async () => {
        for (const mods of [["DT"], [{ acronym: "DT" }]]) {
            const data = await resolveOverlayData("https://osu.ppy.sh/scores/5500357550", clientWith(mods), identity);
            expect(data.map.sr).toBe("8.78");
            expect(data.map.ar).toBe(10.33);
            expect(data.map.od).toBe(10.11);
            expect(data.map.bpm).toBe("300bpm");
            expect(data.map.arMs).toBe("400ms");
        }
    });
    it("prioritizes official modded attributes from osu! API when available", async () => {
        const mockAttributes = {
            star_rating: 9.45,
            approach_rate: 10.3,
            overall_difficulty: 10.2,
            circle_size: 4.0,
            drain_rate: 6.0,
            clock_rate: 1.5,
            max_combo: 1250,
        };
        const data = await resolveOverlayData(
            "https://osu.ppy.sh/scores/5500357550",
            clientWith(["DT"], false, mockAttributes),
            identity
        );
        expect(data.map.sr).toBe("9.45");
        expect(data.map.ar).toBe(10.3);
        expect(data.map.od).toBe(10.2);
        expect(data.map.bpm).toBe("300bpm");
        expect(data.score.maxCombo).toBe(1250);
    });
    it("applies HR transforms modifying CS and HP accurately", async () => {
        const data = await resolveOverlayData("https://osu.ppy.sh/scores/5500357550", clientWith(["HR"]), identity);
        expect(data.map.cs).toBe(5.2);
        expect(data.map.hp).toBe(7.0);
        expect(data.map.ar).toBe(10.0);
        expect(data.map.od).toBe(10.0);
    });
    it("falls back to lifeline content when the score cannot load", async () => {
        const data = await resolveOverlayData("https://osu.ppy.sh/scores/1", clientWith([], true), identity);
        expect(data.player.badges).toHaveLength(6);
        expect(data.player.avatar).toBe("/assets/overlay_ref/lifeline_avatar_hd.jpg");
        expect(data.player.banner).toBe("/assets/overlay_ref/lifeline_banner_hd.jpg");
    });
    it("uses lifeline defaults for empty input", async () => {
        const data = await resolveOverlayData("", clientWith([]), identity);
        expect(data.player.badges).toHaveLength(6);
        expect(data.player.badgeCount).toBe(6);
    });
});

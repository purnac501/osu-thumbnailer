import type { OsuClient } from "../shared/osu/client";
import { parseScoreUrl } from "../shared/score-url/parseScoreUrl";
import {
    LIFELINE_AVATAR,
    LIFELINE_BADGES,
    LIFELINE_BANNER,
    LIFELINE_MAPPER_AVATAR,
    LIFELINE_MAP_COVER,
    LIFELINE_USER_ID,
    isLifelineUser,
    type OverlayBadge,
    type OverlayData,
    type OverlayScoreDetails,
    type OverlayTopScore,
} from "../shared/types/overlay";
function getFlagEmoji(countryCode: string): string {
    if (!countryCode || countryCode.length !== 2)
        return "🌐";
    const codePoints = countryCode
        .toUpperCase()
        .split("")
        .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}
function formatShortAgo(isoDate?: string): string {
    if (!isoDate) return "1y";
    const diff = Math.max(0, Date.now() - new Date(isoDate).getTime());
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 30) return `${Math.max(1, days)}d`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}m`;
    return `${Math.floor(months / 12)}y`;
}
function formatLongAgo(isoDate?: string): string {
    if (!isoDate) return "26 minutes ago";
    const diff = Math.max(0, Date.now() - new Date(isoDate).getTime());
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 60) return `${Math.max(1, minutes)} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} days ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} months ago`;
    return `${Math.floor(months / 12)} years ago`;
}
function computeMs(ar: number, od: number): {
    arMs: string;
    odMs: string;
} {
    const arMs = ar <= 5 ? 1800 - 120 * ar : 1200 - 150 * (ar - 5);
    const odMs = 80 - 6 * od;
    return {
        arMs: `${Math.round(arMs)}ms`,
        odMs: `${odMs.toFixed(1)}ms`,
    };
}

export interface BaseStats {
    cs: number;
    ar: number;
    od: number;
    hp: number;
    bpm: number;
    sr: number;
}

export function calculateModdedStats(base: BaseStats, mods: unknown[]): {
    cs: number;
    ar: number;
    od: number;
    hp: number;
    bpm: number;
    sr: number;
    arMs: string;
    odMs: string;
} {
    const acronyms = (mods || []).map((m: any) =>
        (typeof m === "string" ? m : m?.acronym || "").toUpperCase()
    );

    const hasHr = acronyms.includes("HR");
    const hasEz = acronyms.includes("EZ");
    const hasDt = acronyms.includes("DT") || acronyms.includes("NC");
    const hasHt = acronyms.includes("HT") || acronyms.includes("DC");

    // Circle Size (CS)
    let cs = base.cs;
    if (hasHr) cs = Math.min(10, cs * 1.3);
    if (hasEz) cs = Math.max(0, cs * 0.5);

    // HP Drain (HP)
    let hp = base.hp;
    if (hasHr) hp = Math.min(10, hp * 1.4);
    if (hasEz) hp = Math.max(0, hp * 0.5);

    // Approach Rate (AR)
    let ar = base.ar;
    if (hasHr) ar = Math.min(10, ar * 1.4);
    if (hasEz) ar = Math.max(0, ar * 0.5);

    // Overall Difficulty (OD)
    let od = base.od;
    if (hasHr) od = Math.min(10, od * 1.4);
    if (hasEz) od = Math.max(0, od * 0.5);

    // Clock rate
    const clockRate = hasDt ? 1.5 : (hasHt ? 0.75 : 1);
    const bpm = Math.round(base.bpm * clockRate);

    let arMs = ar <= 5 ? 1800 - 120 * ar : 1200 - 150 * (ar - 5);
    arMs = arMs / clockRate;

    if (arMs < 300) {
        ar = 11;
    } else if (arMs <= 1200) {
        ar = 5 + (1200 - arMs) / 150;
    } else {
        ar = (1800 - arMs) / 120;
    }

    let odMs = (80 - 6 * od) / clockRate;
    od = (80 - odMs) / 6;

    let sr = base.sr;
    if (hasDt && hasHr) sr = sr * 1.55;
    else if (hasDt) sr = sr * 1.35;
    else if (hasHr) sr = sr * 1.10;
    else if (hasEz) sr = sr * 0.85;
    else if (hasHt) sr = sr * 0.80;

    return {
        cs: Number(cs.toFixed(2)),
        ar: Number(Math.min(11, ar).toFixed(2)),
        od: Number(Math.min(11, od).toFixed(2)),
        hp: Number(hp.toFixed(2)),
        bpm,
        sr: Number(sr.toFixed(2)),
        arMs: `${Math.round(arMs)}ms`,
        odMs: `${odMs.toFixed(1)}ms`,
    };
}
export async function resolveOverlayData(input: string, client: OsuClient, proxiedAsset: (url?: string) => string | undefined): Promise<OverlayData> {
    const clean = input.trim();
    let targetUserId: string | number = LIFELINE_USER_ID;
    let targetBeatmapId: string | number = 5610489;
    let targetMods: unknown[] = ["DT"];
    let fetchedScore: any = null;
    const parsedScore = parseScoreUrl(clean);
    if (parsedScore) {
        try {
            const score = await client.fetchScore(parsedScore.scoreId, parsedScore.ruleset);
            fetchedScore = score;
            if (score.user?.id)
                targetUserId = score.user.id;
            if (score.beatmap?.id)
                targetBeatmapId = score.beatmap.id;
            if (score.mods)
                targetMods = score.mods;
        }
        catch (e) {
            console.warn("Could not fetch score, fallbacking to user/map detection:", e);
        }
    }
    else {
        const userMatch = clean.match(/osu\.ppy\.sh\/(?:users|u)\/([a-zA-Z0-9_ -]+)/i);
        if (userMatch && userMatch[1]) {
            targetUserId = userMatch[1];
        }
        else if (/^[a-zA-Z0-9_ -]{2,32}$/.test(clean) && !clean.includes("/")) {
            targetUserId = clean;
        }
        const beatmapMatch = clean.match(/osu\.ppy\.sh\/(?:beatmaps|b)\/(\d+)/i) ||
            clean.match(/osu\.ppy\.sh\/beatmapsets\/\d+#(?:[a-z]+)\/(\d+)/i);
        if (beatmapMatch) {
            targetBeatmapId = Number(beatmapMatch[1]);
        }
    }
    const isNumericUser = /^\d+$/.test(String(targetUserId));
    const userPath = isNumericUser
        ? `/users/${targetUserId}/osu`
        : `/users/${encodeURIComponent(String(targetUserId))}/osu?key=username`;
    let u: any;
    try {
        u = await client.apiGet(userPath);
    }
    catch (err) {
        console.error("Failed to fetch user, fallbacking to lifeline:", err);
        u = await client.apiGet(`/users/${LIFELINE_USER_ID}/osu`);
    }
    let bm: any;
    try {
        bm = await client.apiGet(`/beatmaps/${targetBeatmapId}`);
    }
    catch (err) {
        console.error("Failed to fetch beatmap, fallbacking to 5610489:", err);
        bm = await client.apiGet(`/beatmaps/5610489`);
    }
    const stats = u.statistics || {};
    const monthlyPlaycounts = (u.monthly_playcounts || [])
        .filter((m: any) => m.start_date >= "2018-01-01")
        .map((m: any) => ({ date: m.start_date, count: Number(m.count) }));
    let peakMonth = "June 2020";
    let peakCount = 7457;
    if (monthlyPlaycounts.length > 0) {
        let max = monthlyPlaycounts[0];
        for (const item of monthlyPlaycounts) {
            if (item.count > max.count)
                max = item;
        }
        peakCount = max.count;
        try {
            const d = new Date(max.date);
            peakMonth = d.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
        }
        catch { }
    }
    let badges: OverlayBadge[] = [];
    const lifeline = isLifelineUser(u.id, u.username);
    if (lifeline) {
        badges = LIFELINE_BADGES;
    }
    else {
        badges = (u.badges || []).map((b: any) => ({
            url: b.image_url,
            title: b.description || "Tournament Badge",
        }));
    }
    const userBanner = lifeline
        ? LIFELINE_BANNER
        : (proxiedAsset(u.cover_url || u.cover?.url) || LIFELINE_BANNER);
    const userAvatar = lifeline
        ? LIFELINE_AVATAR
        : (proxiedAsset(u.avatar_url) || LIFELINE_AVATAR);
    const set = bm.beatmapset || {};
    const mapCover = proxiedAsset(set.covers?.["card@2x"] || set.covers?.cover) || LIFELINE_MAP_COVER;
    const mapperAvatar = proxiedAsset(`https://a.ppy.sh/${bm.user_id}`) || LIFELINE_MAPPER_AVATAR;
    const baseAr = Number(bm.ar ?? 9.5);
    const baseOd = Number(bm.accuracy ?? 9.2);
    const baseCs = Number(bm.cs ?? 4.0);
    const baseHp = Number(bm.drain ?? 4.5);
    const baseBpm = Number(bm.bpm ?? 200);
    const baseSr = Number(bm.difficulty_rating ?? 7.37);
    // Calculate modded stats using standard math formulas
    const calcStats = calculateModdedStats(
        { cs: baseCs, ar: baseAr, od: baseOd, hp: baseHp, bpm: baseBpm, sr: baseSr },
        targetMods
    );

    // Fetch official modded attributes from osu! v2 API if mods are present
    let attributes: any = null;
    try {
        if (targetBeatmapId > 0 && Array.isArray(targetMods) && targetMods.length > 0) {
            attributes = await client.getModdedBeatmapAttributes(Number(targetBeatmapId), targetMods);
        }
    } catch (e) {
        console.warn("Could not fetch modded attributes:", e);
    }

    const finalSr = attributes?.star_rating !== undefined ? attributes.star_rating.toFixed(2) : calcStats.sr.toFixed(2);
    const finalAr = attributes?.approach_rate !== undefined ? Number(attributes.approach_rate.toFixed(2)) : calcStats.ar;
    const finalOd = attributes?.overall_difficulty !== undefined ? Number(attributes.overall_difficulty.toFixed(2)) : calcStats.od;
    const finalCs = attributes?.circle_size !== undefined ? Number(attributes.circle_size.toFixed(2)) : calcStats.cs;
    const finalHp = attributes?.drain_rate !== undefined ? Number(attributes.drain_rate.toFixed(2)) : calcStats.hp;
    const finalClockRate = attributes?.clock_rate ?? (calcStats.bpm / (baseBpm || 1));
    const finalBpm = Math.round(baseBpm * (finalClockRate || 1));
    const { arMs, odMs } = attributes
        ? computeMs(finalAr, finalOd)
        : { arMs: calcStats.arMs, odMs: calcStats.odMs };
    let topScores: OverlayTopScore[] = [];
    try {
        const bestScores = (await client.apiGet(`/users/${u.id || targetUserId}/scores/best?limit=6&mode=osu`)) as any[];
        if (Array.isArray(bestScores) && bestScores.length > 0) {
            topScores = bestScores.map((item) => {
                const bms = item.beatmapset || {};
                const modsArr: string[] = (item.mods || [])
                    .map((m: any) => (typeof m === "string" ? m : m?.acronym))
                    .filter(Boolean);
                const coverUrl = bms.covers?.cover || bms.covers?.['list@2x'] || bms.covers?.list || (bms.id ? `https://assets.ppy.sh/beatmaps/${bms.id}/covers/cover.jpg` : mapCover);
                return {
                    rank: String(item.rank || "S").replace(/H$/, ""),
                    title: bms.title || item.beatmap?.version || "Beatmap",
                    mods: modsArr,
                    timeAgo: formatShortAgo(item.created_at),
                    pp: item.pp ? `${Math.round(item.pp)}pp` : "0pp",
                    cover: coverUrl,
                };
            });
        }
    } catch (e) {
        console.warn("Could not fetch best scores:", e);
    }
    if (topScores.length === 0) {
        topScores = [
            { rank: "S", title: "Song That Might Play When You Fight Sans", mods: ["HD", "HR"], timeAgo: "1y", pp: "1146pp", cover: "https://assets.ppy.sh/beatmaps/1031435/covers/cover.jpg" },
            { rank: "X", title: "Bike Chase", mods: ["HD", "HR"], timeAgo: "1y", pp: "1120pp", cover: "https://assets.ppy.sh/beatmaps/1449830/covers/cover.jpg" },
            { rank: "S", title: "ANTIDOTE", mods: ["HD", "HR"], timeAgo: "1y", pp: "1108pp", cover: "https://assets.ppy.sh/beatmaps/1271616/covers/cover.jpg" },
            { rank: "S", title: "Bass Slut (Original Mix)", mods: ["HD", "DT"], timeAgo: "2y", pp: "1100pp", cover: "https://assets.ppy.sh/beatmaps/399358/covers/cover.jpg" },
            { rank: "S", title: "Last Goodbye", mods: ["HD", "HR"], timeAgo: "1y", pp: "1064pp", cover: "https://assets.ppy.sh/beatmaps/744372/covers/cover.jpg" },
            { rank: "A", title: "ChuChu Lovely MuniMuni MuraMura", mods: ["HD", "DT"], timeAgo: "1y", pp: "1058pp", cover: "https://assets.ppy.sh/beatmaps/847323/covers/cover.jpg" },
        ];
    }

    let resolvedScore: OverlayScoreDetails;
    if (fetchedScore) {
        const statsObj = fetchedScore.statistics || {};
        const count300 = Number(statsObj.count_300 ?? statsObj.great ?? 0);
        const count100 = Number(statsObj.count_100 ?? statsObj.ok ?? 0);
        const count50 = Number(statsObj.count_50 ?? statsObj.meh ?? 0);
        const countMiss = Number(statsObj.count_miss ?? statsObj.miss ?? 0);
        const maxCombo = Number(fetchedScore.max_combo || 0);
        const bmMaxCombo = Number(attributes?.max_combo || bm.max_combo || fetchedScore.beatmap?.max_combo || maxCombo);
        const ppVal = fetchedScore.pp !== null && fetchedScore.pp !== undefined
            ? `${Math.round(fetchedScore.pp)}PP`
            : (stats.pp ? `${Math.round(stats.pp)}PP` : "0PP");
        const accuracy = fetchedScore.accuracy !== undefined ? `${(fetchedScore.accuracy * 100).toFixed(2)}%` : "100.00%";
        const rank = String(fetchedScore.rank || "S").replace(/H$/, "");
        const modsArr = (fetchedScore.mods || []).map((m: any) => (typeof m === "string" ? m : m?.acronym)).filter(Boolean);
        const rawScore = Number(fetchedScore.total_score ?? fetchedScore.score ?? 0);

        resolvedScore = {
            totalScore: rawScore.toLocaleString("en-US").replace(/,/g, " "),
            combo: maxCombo,
            maxCombo: bmMaxCombo,
            pp: ppVal,
            accuracy,
            rank,
            count300,
            count100,
            count50,
            countMiss,
            playedAtAgo: formatLongAgo(fetchedScore.ended_at || fetchedScore.created_at),
            mods: modsArr,
        };
    } else {
        resolvedScore = {
            totalScore: "80 109 230",
            combo: 1869,
            maxCombo: 1870,
            pp: "880PP",
            accuracy: "99.63%",
            rank: "S",
            count300: 8,
            count100: 0,
            count50: 0,
            countMiss: 0,
            playedAtAgo: "26 minutes ago",
            mods: ["HD", "HR"],
        };
    }

    return {
        player: {
            username: u.username || "Player",
            isSupporter: u.is_supporter === true,
            flag: getFlagEmoji(u.country_code),
            countryCode: u.country_code || "ID",
            crank: stats.country_rank ? `#${stats.country_rank}` : (u.country_rank ? `#${u.country_rank}` : "#1"),
            grank: stats.global_rank ? `#${stats.global_rank}` : (u.global_rank ? `#${u.global_rank}` : "#1"),
            pp: stats.pp ? `${Math.round(stats.pp).toLocaleString()}pp` : "0pp",
            hours: Math.round((stats.play_time || 0) / 3600) || 0,
            playcount: stats.play_count || 0,
            badgeCount: badges.length,
            badges,
            avatar: userAvatar,
            banner: userBanner,
            monthlyPlaycounts,
            peakMonth,
            peakCount,
        },
        map: {
            title: `${set.title || "Beatmap"} [${bm.version || "Normal"}]`,
            artist: `by ${set.artist || "Artist"}`,
            cover: mapCover,
            mapper: set.creator || "mapper",
            mapperAvatar,
            favs: Number(set.favourite_count || 138).toLocaleString(),
            plays: Number(set.play_count || 17632).toLocaleString(),
            sr: finalSr,
            bpm: `${finalBpm}bpm`,
            ar: finalAr,
            arMs,
            od: finalOd,
            odMs,
            cs: finalCs,
            hp: finalHp,
            status: String(bm.status || set.status || "ranked").toLowerCase(),
        },
        score: resolvedScore,
        topScores,
    };
}

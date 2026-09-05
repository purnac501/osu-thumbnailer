export interface OverlayBadge {
    url: string;
    title: string;
}
export interface OverlayMonthlyCount {
    date: string;
    count: number;
}
export interface OverlayTopScore {
    rank: string;
    title: string;
    mods: string[];
    timeAgo: string;
    pp: string;
    cover?: string;
}

export interface OverlayScoreDetails {
    totalScore: string;
    combo: number;
    maxCombo: number;
    pp: string;
    accuracy: string;
    rank: string;
    count300: number;
    count100: number;
    count50: number;
    countMiss: number;
    playedAtAgo: string;
    mods: string[];
}

export interface OverlayData {
    player: {
        username: string;
        isSupporter: boolean;
        flag: string;
        countryCode: string;
        crank: string;
        grank: string;
        pp: string;
        hours: number;
        playcount: number;
        badgeCount: number;
        badges: OverlayBadge[];
        avatar: string;
        banner: string;
        monthlyPlaycounts: OverlayMonthlyCount[];
        peakMonth: string;
        peakCount: number;
    };
    map: {
        title: string;
        artist: string;
        cover: string;
        mapper: string;
        mapperAvatar: string;
        favs: string;
        plays: string;
        sr: string;
        bpm: string;
        ar: number;
        arMs: string;
        od: number;
        odMs: string;
        cs: number;
        hp: number;
        status?: string;
    };
    score?: OverlayScoreDetails;
    topScores?: OverlayTopScore[];
}
export const LIFELINE_USER_ID = 11367222;
export const LIFELINE_USERNAME = "lifeline";
export const LIFELINE_AVATAR = "/assets/overlay_ref/lifeline_avatar_hd.jpg";
export const LIFELINE_BANNER = "/assets/overlay_ref/lifeline_banner_hd.jpg";
export const LIFELINE_MAP_COVER = "/assets/overlay_ref/map_cover_hd.jpg";
export const LIFELINE_MAPPER_AVATAR = "/assets/overlay_ref/mapper_avatar_hd.jpg";
export const LIFELINE_BADGES: OverlayBadge[] = [
    { url: "/assets/overlay_ref/badge_oit15.png", title: "osu! Indonesia Tournament #15 Winner" },
    { url: "/assets/overlay_ref/badge_oit13.jpg", title: "osu! Indonesia Tournament #13 Winner" },
    { url: "/assets/overlay_ref/badge_4s.png", title: "SEA Summer Suiji Showdown 2 Winning Team" },
    { url: "/assets/overlay_ref/badge_oit22.png", title: "osu! Indonesia Tournament 2022 Winner" },
    { url: "/assets/overlay_ref/badge_seat.png", title: "osu! South East Asia Tournament 5 Winner" },
    { url: "/assets/overlay_ref/badge_ucup.png", title: "Ulat Cup 2021 Winning Team" },
];
export function isLifelineUser(id: unknown, username: unknown): boolean {
    return String(id) === String(LIFELINE_USER_ID) || String(username ?? "").toLowerCase() === LIFELINE_USERNAME;
}

export const DEFAULT_OVERLAY_DATA: OverlayData = {
    player: {
        username: "worst hr player",
        isSupporter: true,
        flag: "🇰🇷",
        countryCode: "KR",
        crank: "#4",
        grank: "#68",
        pp: "21 340pp",
        hours: 3664,
        playcount: 301395,
        badgeCount: LIFELINE_BADGES.length,
        badges: LIFELINE_BADGES,
        avatar: "https://a.ppy.sh/1415940",
        banner: LIFELINE_BANNER,
        monthlyPlaycounts: [],
        peakMonth: "June 2020",
        peakCount: 7457,
    },
    map: {
        title: "I thought I was an angel [Fallen]",
        artist: "by Utsu-P",
        cover: LIFELINE_MAP_COVER,
        mapper: "-cy",
        mapperAvatar: LIFELINE_MAPPER_AVATAR,
        favs: "138",
        plays: "17 632",
        sr: "8.53",
        bpm: "300bpm",
        ar: 9.70,
        arMs: "349ms",
        od: 9.70,
        odMs: "16.5ms",
        cs: 4.00,
        hp: 6.00,
        status: "ranked",
    },
    score: {
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
    },
    topScores: [
        { rank: "S", title: "Song That Might Play When You Fight Sans", mods: ["HD", "HR"], timeAgo: "1y", pp: "1146pp", cover: "https://assets.ppy.sh/beatmaps/1031435/covers/cover.jpg" },
        { rank: "X", title: "Bike Chase", mods: ["HD", "HR"], timeAgo: "1y", pp: "1120pp", cover: "https://assets.ppy.sh/beatmaps/1449830/covers/cover.jpg" },
        { rank: "S", title: "ANTIDOTE", mods: ["HD", "HR"], timeAgo: "1y", pp: "1108pp", cover: "https://assets.ppy.sh/beatmaps/1271616/covers/cover.jpg" },
        { rank: "S", title: "Bass Slut (Original Mix)", mods: ["HD", "DT"], timeAgo: "2y", pp: "1100pp", cover: "https://assets.ppy.sh/beatmaps/399358/covers/cover.jpg" },
        { rank: "S", title: "Last Goodbye", mods: ["HD", "HR"], timeAgo: "1y", pp: "1064pp", cover: "https://assets.ppy.sh/beatmaps/744372/covers/cover.jpg" },
        { rank: "A", title: "ChuChu Lovely MuniMuni MuraMura", mods: ["HD", "DT"], timeAgo: "1y", pp: "1058pp", cover: "https://assets.ppy.sh/beatmaps/847323/covers/cover.jpg" },
    ],
};

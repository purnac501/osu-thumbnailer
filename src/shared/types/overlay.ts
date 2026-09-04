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

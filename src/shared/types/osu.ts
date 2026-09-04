import type { NormalizedMod } from "./thumbnail";
export interface ApiMod {
    acronym: string;
    name?: string;
    settings?: Record<string, unknown>;
}
export interface ApiStatistics {
    [judgement: string]: number | undefined;
    miss?: number;
    great?: number;
    good?: number;
    ok?: number;
    meh?: number;
    none?: number;
    large_tick_hit?: number;
    large_tick_miss?: number;
    small_tick_miss?: number;
    slider_tail_hit?: number;
    katu?: number;
    geki?: number;
    perfect?: number;
}
export interface ApiScore {
    id: number | string;
    mode?: string;
    user_id?: number;
    accuracy?: number;
    pp?: number | null;
    rank?: string;
    max_combo?: number;
    mods?: ApiMod[] | string[];
    statistics?: ApiStatistics;
    is_perfect_combo?: boolean;
    rank_global?: number | null;
    created_at?: string;
    beatmap_id?: number;
    beatmap?: ApiBeatmap;
    beatmapset?: ApiBeatmapset;
    user?: ApiUser;
}
export interface ApiBeatmap {
    id: number;
    beatmapset_id: number;
    difficulty_rating?: number;
    version?: string;
    bpm?: number;
    mode?: string;
    status?: string;
    max_combo?: number;
    count_circles?: number;
    count_sliders?: number;
    count_spinners?: number;
}
export interface ApiBeatmapset {
    id: number;
    artist?: string;
    title?: string;
    creator?: string;
    covers?: {
        cover?: string;
        "cover@2x"?: string;
        raw?: string;
        slimcover?: string;
        "slimcover@2x"?: string;
        card?: string;
        list?: string;
    };
}
export interface ApiUser {
    id: number;
    username: string;
    avatar_url?: string;
    country_code?: string;
}
export interface ApiBeatmapAttributes {
    beatmap_id: number;
    difficulty_rating: number;
    star_rating: number;
    max_combo?: number;
    clock_rate?: number;
    ar?: number;
    cs?: number;
    od?: number;
    hp?: number;
}
export function isApiScore(value: unknown): value is ApiScore {
    return (typeof value === "object" &&
        value !== null &&
        ("id" in value || "best_id" in value));
}
export type { NormalizedMod };

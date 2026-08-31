export type Ruleset = "osu" | "taiko" | "fruits" | "mania";

/** A mod after normalization: acronym plus optional lazer settings. */
export interface NormalizedMod {
  acronym: string;
  name?: string;
  settings?: Record<string, unknown>;
}

/** Play status derived from the score. The template renders this, not raw stats. */
export type PlayStatus =
  | { kind: "fc" }
  | { kind: "miss"; count: number }
  | { kind: "unknown" };

/**
 * The normalized data model every template consumes.
 * Raw osu! API JSON never reaches template code.
 */
export interface ThumbnailData {
  scoreId: string;
  ruleset: Ruleset;

  username: string;
  userId: number;
  avatarUrl?: string;
  countryCode?: string;

  pp?: number;

  accuracy: number;
  grade: string;
  maxCombo: number;

  leaderboardPosition?: number;

  status: PlayStatus;
  missCount: number;
  /** Slider breaks / combo breaks when the API exposes them (mostly lazer). */
  sbCount: number;
  isFullCombo: boolean;

  mods: NormalizedMod[];

  statistics: Record<string, number>;

  beatmapId: number;
  beatmapsetId: number;
  /** Beatmap rank status, drives the notch color (ranked/loved/approved/unranked). */
  beatmapStatus?: string;

  artist: string;
  title: string;
  difficultyName: string;
  mapper?: string;

  baseBpm: number;
  effectiveBpm: number;
  clockRate: number;

  baseStarRating?: number;
  moddedStarRating?: number;

  backgroundUrl?: string;
  /** Fallback URLs tried in order when backgroundUrl fails to load. */
  backgroundFallbacks?: string[];

  playedAt?: string;
}

/** Result of normalizing a score URL into thumbnail data. */
export interface ThumbnailResult {
  data: ThumbnailData;
  /** Non-fatal notes, e.g. "leaderboard position unavailable", "mock mode". */
  warnings: string[];
  mode: "live" | "mock";
}

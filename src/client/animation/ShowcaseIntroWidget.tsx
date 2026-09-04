import type { RefCallback } from "react";
import { Star } from "lucide-react";
import { DEFAULT_OVERLAY_DATA, type OverlayData } from "./types";
import { modAssetPath } from "../../shared/mods/mods";
import { resolveAssetUrl } from "../../shared/assets/assetUrl";
import "./showcase-intro.css";

export type ShowcaseNode =
    | "container"
    | "topBar"
    | "lensWrap"
    | "gradeRank"
    | "leftFlyout"
    | "rightFlyout"
    | "bottomTime";

export type ShowcaseRefSetter = (name: ShowcaseNode) => RefCallback<Element>;

const SHOWCASE_MOD_COLORS: Record<string, string> = {
    HD: "#2080E0",
    HR: "#E08510",
    DT: "#9640D8",
    NC: "#7C2AB8",
    FL: "#E59819",
    EZ: "#22A855",
    HT: "#1C8C8C",
    CL: "#4D5663",
    NF: "#3B82F6",
    SO: "#EC4899",
    SD: "#E08510",
    PF: "#E08510",
    MR: "#8C5CFF",
    V2: "#8C5CFF",
};

function formatScoreNumber(val: string | number): string {
    const raw = String(val).replace(/\s+/g, "");
    if (!/^\d+$/.test(raw)) return String(val);
    return raw.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatComboNumber(n: number | string): string {
    const raw = String(n).replace(/\s+/g, "");
    if (!/^\d+$/.test(raw)) return String(n);
    return raw.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatPpValue(pp: string): string {
    const cleaned = pp.trim();
    if (!cleaned) return "0PP";
    return cleaned.toUpperCase().endsWith("PP") ? cleaned.toUpperCase() : `${cleaned}PP`;
}

function getPlayRankClass(rank: string): string {
    const r = rank.toUpperCase().replace(/H$/, "");
    if (r === "SS" || r === "X") return "rank-x";
    if (r === "S") return "rank-s";
    if (r === "A") return "rank-a";
    if (r === "B") return "rank-b";
    if (r === "C") return "rank-c";
    return "rank-d";
}

export function ShowcaseIntroWidget({
    data,
    setRef,
}: {
    data: OverlayData;
    setRef: ShowcaseRefSetter;
}) {
    const score = data.score ?? {
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

    const topScores = (data.topScores && data.topScores.length > 0)
        ? data.topScores.slice(0, 6)
        : (DEFAULT_OVERLAY_DATA.topScores ?? []);

    const csPct = Math.min(100, Math.max(0, (data.map.cs / 10) * 100));
    const arPct = Math.min(100, Math.max(0, (data.map.ar / 11) * 100));
    const odPct = Math.min(100, Math.max(0, (data.map.od / 11) * 100));
    const hpPct = Math.min(100, Math.max(0, (data.map.hp / 10) * 100));

    const rankLetter = (score.rank || "S").toUpperCase().replace(/H$/, "");
    const rankClass = rankLetter === "SS" || rankLetter === "X"
        ? "rank-silver"
        : rankLetter === "A"
        ? "rank-a"
        : rankLetter === "B"
        ? "rank-b"
        : "";

    return (
        <div className="showcase-intro-container" ref={setRef("container") as RefCallback<HTMLDivElement>}>
            {/* Top Map Attributes & Star Rating Bar */}
            <header className="showcase-top-bar" ref={setRef("topBar") as RefCallback<HTMLElement>}>
                {/* Left Gauges: CS & AR */}
                <div className="showcase-gauge-group">
                    <div className="showcase-gauge-item">
                        <div className="showcase-gauge-track">
                            <div className="showcase-gauge-fill cs" style={{ width: `${csPct}%` }} />
                        </div>
                        <div className="showcase-gauge-labels">
                            <span className="showcase-gauge-name">CS:</span>
                            <span className="showcase-gauge-val">{data.map.cs.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="showcase-gauge-item">
                        <div className="showcase-gauge-track">
                            <div className="showcase-gauge-fill ar" style={{ width: `${arPct}%` }} />
                        </div>
                        <div className="showcase-gauge-labels">
                            <span className="showcase-gauge-name">AR:</span>
                            <span className="showcase-gauge-val">{data.map.ar.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Center Star Ribbon & Star Rating Value */}
                <div className="showcase-star-badge">
                    <div className="showcase-star-ribbon">
                        <Star className="showcase-star-icon" />
                    </div>
                    <div className="showcase-sr-value">{data.map.sr}</div>
                </div>

                {/* Right Gauges: OD & HP */}
                <div className="showcase-gauge-group">
                    <div className="showcase-gauge-item">
                        <div className="showcase-gauge-track">
                            <div className="showcase-gauge-fill od" style={{ width: `${odPct}%` }} />
                        </div>
                        <div className="showcase-gauge-labels">
                            <span className="showcase-gauge-name">OD:</span>
                            <span className="showcase-gauge-val">{data.map.od.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="showcase-gauge-item">
                        <div className="showcase-gauge-track">
                            <div className="showcase-gauge-fill hp" style={{ width: `${hpPct}%` }} />
                        </div>
                        <div className="showcase-gauge-labels">
                            <span className="showcase-gauge-name">HP:</span>
                            <span className="showcase-gauge-val">{data.map.hp.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Center Circular Lens */}
            <div className="showcase-lens-wrap" ref={setRef("lensWrap") as RefCallback<HTMLDivElement>}>
                <div
                    className="showcase-lens-artwork"
                    style={{ backgroundImage: `url(${data.map.cover})` }}
                />
                <div className="showcase-lens-dim" />
                <div
                    className={`showcase-grade-rank ${rankClass}`}
                    ref={setRef("gradeRank") as RefCallback<HTMLDivElement>}
                >
                    {rankLetter}
                </div>
            </div>

            {/* Left Flyout: Player Card & Top Plays Stack Curved Along Lens */}
            <aside className="showcase-left-flyout" ref={setRef("leftFlyout") as RefCallback<HTMLElement>}>
                <div className="showcase-player-card">
                    <img
                        className="showcase-player-avatar"
                        src={data.player.avatar}
                        alt={data.player.username}
                        loading="eager"
                        onError={(e) => {
                            const el = e.target as HTMLImageElement;
                            if (!el.dataset.fallback) {
                                el.dataset.fallback = "1";
                                el.src = "https://assets.ppy.sh/beatmaps/1031435/covers/cover.jpg";
                            }
                        }}
                    />
                    <div className="showcase-player-meta">
                        <div className="showcase-player-name">
                            {data.player.username} <span className="showcase-player-grank">{data.player.grank}</span>
                        </div>
                        <div className="showcase-player-sub">
                            <span className="showcase-player-flag">{data.player.flag}</span>
                            <span className="showcase-player-crank">{data.player.crank}</span>
                        </div>
                    </div>
                </div>

                <div className="showcase-top-plays-list">
                    {topScores.map((play, idx) => (
                        <div key={`${play.title}-${idx}`} className={`showcase-play-item showcase-play-row-${idx + 1}`}>
                            <div className="showcase-play-thumb-wrap">
                                <img
                                    className="showcase-play-thumb"
                                    src={play.cover || data.map.cover}
                                    alt={play.title}
                                    loading="eager"
                                    onError={(e) => {
                                        const el = e.target as HTMLImageElement;
                                        if (!el.dataset.fallback) {
                                            el.dataset.fallback = "1";
                                            el.src = data.map.cover;
                                        }
                                    }}
                                />
                                <div className="showcase-play-thumb-dim" />
                                <div className={`showcase-play-rank-badge ${getPlayRankClass(play.rank)}`}>
                                    {play.rank.toUpperCase().replace(/H$/, "")}
                                </div>
                            </div>

                            <div className="showcase-play-body">
                                <div className="showcase-play-title" title={play.title}>
                                    {play.title}
                                </div>
                                <div className="showcase-play-meta">
                                    {play.mods && play.mods.length > 0 && (
                                        <div className="showcase-mod-combo">
                                            {play.mods.slice(0, 3).map((mod) => {
                                                const rawAsset = modAssetPath(mod);
                                                const asset = resolveAssetUrl(rawAsset ?? undefined);
                                                const bg = SHOWCASE_MOD_COLORS[mod.toUpperCase()] ?? "#4D5663";
                                                if (asset) {
                                                    return (
                                                        <div
                                                            key={mod}
                                                            className="showcase-mod-icon-badge"
                                                            style={{ backgroundColor: bg }}
                                                            title={mod}
                                                        >
                                                            <img
                                                                src={asset}
                                                                alt={mod}
                                                                className="showcase-mod-svg"
                                                            />
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <span key={mod} className={`showcase-mod-tag mod-${mod.toLowerCase()}`}>
                                                        {mod}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}
                                    <span className="showcase-play-time">{play.timeAgo}</span>
                                    <span className="showcase-play-pp">{play.pp}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* Right Flyout: Score, Combo, PP Badge, Accuracy, Hit Judgments Curved Along Lens */}
            <aside className="showcase-right-flyout" ref={setRef("rightFlyout") as RefCallback<HTMLElement>}>
                <div className="showcase-right-item showcase-score-row">
                    <span className="showcase-score-label">Score</span>
                    <span className="showcase-score-val">{formatScoreNumber(score.totalScore)}</span>
                </div>

                <div className="showcase-right-item showcase-combo-row">
                    {formatComboNumber(score.combo)}/{formatComboNumber(score.maxCombo)}x
                </div>

                <div className="showcase-right-item showcase-pp-badge">
                    <span className="showcase-pp-text">{formatPpValue(score.pp)}</span>
                </div>

                <div className="showcase-right-item showcase-acc-row">
                    {score.accuracy}
                </div>

                <div className="showcase-right-item showcase-hits-strip">
                    <div className="showcase-hit-box h300">
                        <span>{score.count300}</span>
                    </div>
                    <div className="showcase-hit-box h100">
                        <span>{score.count100}</span>
                    </div>
                    <div className="showcase-hit-box h0">
                        <span>{score.countMiss}</span>
                    </div>
                </div>
            </aside>

            {/* Bottom Timestamp */}
            <footer className="showcase-bottom-time" ref={setRef("bottomTime") as RefCallback<HTMLElement>}>
                {score.playedAtAgo}
            </footer>
        </div>
    );
}

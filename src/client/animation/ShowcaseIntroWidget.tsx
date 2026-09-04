import type { RefCallback } from "react";
import { Star } from "lucide-react";
import type { OverlayData } from "./types";
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

    const topScores = (data.topScores && data.topScores.length > 0) ? data.topScores.slice(0, 6) : [
        { rank: "S", title: "Song That Might Play When You Fight Sans", mods: ["HD", "HR"], timeAgo: "1y", pp: "1146pp" },
        { rank: "X", title: "Bike Chase", mods: ["HD", "HR"], timeAgo: "1y", pp: "1120pp" },
        { rank: "S", title: "ANTIDOTE", mods: ["HD", "HR"], timeAgo: "1y", pp: "1108pp" },
        { rank: "S", title: "Bass Slut (Original Mix)", mods: ["HD", "DT"], timeAgo: "2y", pp: "1100pp" },
        { rank: "S", title: "Last Goodbye", mods: ["HD", "HR"], timeAgo: "1y", pp: "1064pp" },
        { rank: "A", title: "ChuChu Lovely MuniMuni MuraMura", mods: ["HD", "DT"], timeAgo: "1y", pp: "1058pp" },
    ];

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
            {/* Cinematic Background Wallpaper */}
            <div
                className="showcase-bg-layer"
                style={{ backgroundImage: `url(${data.map.cover})` }}
            />
            <div className="showcase-bg-vignette" />

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

            {/* Left Flyout: Player Card & Top Plays */}
            <aside className="showcase-left-flyout" ref={setRef("leftFlyout") as RefCallback<HTMLElement>}>
                <div className="showcase-player-card">
                    <img
                        className="showcase-player-avatar"
                        src={data.player.avatar}
                        alt={data.player.username}
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://a.ppy.sh/1415940";
                        }}
                    />
                    <div className="showcase-player-meta">
                        <div className="showcase-player-name">
                            {data.player.username} {data.player.grank}
                        </div>
                        <div className="showcase-player-sub">
                            <span>{data.player.flag}</span>
                            <span>{data.player.crank}</span>
                        </div>
                    </div>
                </div>

                <div className="showcase-top-plays-list">
                    {topScores.map((play, idx) => (
                        <div key={`${play.title}-${idx}`} className="showcase-play-item">
                            <div className={`showcase-play-rank rank-${play.rank.toLowerCase()}`}>
                                {play.rank}
                            </div>
                            <div className="showcase-play-title" title={play.title}>
                                {play.title}
                            </div>
                            {play.mods.length > 0 ? (
                                <div className="showcase-play-mods">
                                    {play.mods.slice(0, 2).map((m) => (
                                        <span key={m} className="showcase-mod-badge">{m}</span>
                                    ))}
                                </div>
                            ) : null}
                            <div className="showcase-play-time">{play.timeAgo}</div>
                            <div className="showcase-play-pp">{play.pp}</div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* Right Flyout: Score, Combo, PP Badge, Accuracy, Hit Judgments */}
            <aside className="showcase-right-flyout" ref={setRef("rightFlyout") as RefCallback<HTMLElement>}>
                <div className="showcase-score-row">
                    <span className="showcase-score-label">Score</span>
                    <span className="showcase-score-val">{score.totalScore}</span>
                </div>

                <div className="showcase-combo-row">
                    {score.combo.toLocaleString()} / {score.maxCombo.toLocaleString()}x
                </div>

                <div className="showcase-pp-badge">
                    <span className="showcase-pp-text">{score.pp}</span>
                </div>

                <div className="showcase-acc-row">
                    {score.accuracy}
                </div>

                <div className="showcase-hits-strip">
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

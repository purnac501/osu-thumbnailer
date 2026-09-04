import { useEffect } from "react";
import type { ThumbnailData } from "../shared/types/thumbnail";
import type { ThumbnailTemplate } from "./types";
import { computeTexts, withTextOverride } from "./texts";
import { BackgroundLayer } from "./components/Background/BackgroundLayer";
import { BadgeRow, BadgeLayer, PanelLayer, StarNotch } from "./components/Panels/Panels";
import { TextLayer } from "./components/Text/TextLayer";
import { ModList } from "./components/Mods/ModList";
import { Avatar, CountryFlag, UsernamePanel } from "./components/Player/PlayerSection";
import { BottomMessage, TwitchLogo } from "./components/Branding/Branding";
import { CuteSparkles } from "./components/Decorations/CuteSparkles";
declare global {
    interface Window {
        __THUMBNAIL_READY?: boolean;
    }
}
function gradeColor(data: ThumbnailData, template: ThumbnailTemplate): string {
    if (template.components.grade.color !== template.theme.grade) {
        return template.components.grade.color;
    }
    if (data.grade === "S" || data.grade === "SS") {
        const hd = data.mods.some((m) => m.acronym === "HD");
        return hd ? "#A5A4A6" : "#E7CE56";
    }
    return template.dataOptions.gradeColors[data.grade] ?? template.components.grade.color;
}
function starColor(data: ThumbnailData, template: ThumbnailTemplate): string {
    if (template.components.starRating.color !== template.theme.starRating) {
        return template.components.starRating.color;
    }
    const colors = template.components.starNotch.statusColors;
    const status = data.beatmapStatus;
    if (colors) {
        if (status && colors[status])
            return colors[status];
        if (status &&
            ["graveyard", "grave", "wip", "pending", "unranked", "unknown"].includes(status) &&
            (colors.graveyard || colors.grave || colors.unranked || colors.unknown)) {
            return colors.graveyard ?? colors.grave ?? colors.unranked ?? colors.unknown ?? template.components.starRating.color;
        }
        if (colors.ranked)
            return colors.ranked;
    }
    return template.components.starRating.color;
}
export function Thumbnail({ data, template, scale = 1, markReady = false, }: {
    data: ThumbnailData;
    template: ThumbnailTemplate;
    scale?: number;
    markReady?: boolean;
}) {
    const { canvas, components: c } = template;
    const texts = computeTexts(data, template);
    const text = (key: string) => withTextOverride(key, texts, template);
    const bgSrc = data.backgroundUrl ?? data.backgroundFallbacks?.[0];
    const hasMisses = text("status") !== "";
    const hasSliderBreaks = text("status-sb") !== "";
    const splitStatus = hasMisses && hasSliderBreaks;
    const isSbPosOverridden = Boolean(template.positionOverrides?.["status-sb"] || template.positionOverrides?.["statusSB"]);
    const isSbSizeOverridden = Boolean(template.fontSizeOverrides?.["status-sb"] || template.fontSizeOverrides?.["statusSB"] || template.sizeOverrides?.["status-sb"]);
    const isMissSizeOverridden = Boolean(template.fontSizeOverrides?.["status-miss"] || template.fontSizeOverrides?.["status"]);
    const statusMiss = {
        ...c.statusMiss,
        fontSize: !isMissSizeOverridden && splitStatus ? c.statusMiss.fontSize * 0.75 : c.statusMiss.fontSize,
    };
    const statusSB = {
        ...c.statusSB,
        fontSize: isSbSizeOverridden
            ? c.statusSB.fontSize
            : splitStatus
                ? c.statusSB.fontSize * 0.9
                : !hasMisses
                    ? c.statusMiss.fontSize * 0.75
                    : c.statusSB.fontSize,
        x: isSbPosOverridden
            ? c.statusSB.x
            : !hasMisses
                ? c.statusMiss.x
                : c.statusSB.x,
        y: isSbPosOverridden
            ? c.statusSB.y
            : !hasMisses
                ? c.statusMiss.y + 10
                : c.statusSB.y,
    };
    useEffect(() => {
        if (!markReady)
            return;
        let cancelled = false;
        const check = () => {
            if (cancelled)
                return;
            const root = document.getElementById("thumbnail-root");
            const images = root ? Array.from(root.querySelectorAll("img")) : [];
            const fontsReady = document.fonts.status === "loaded";
            const imagesReady = images.every((img) => img.complete);
            if (fontsReady && imagesReady) {
                window.__THUMBNAIL_READY = true;
                document.documentElement.setAttribute("data-render-ready", "true");
                return;
            }
            requestAnimationFrame(check);
        };
        void document.fonts.ready.then(check);
        return () => {
            cancelled = true;
        };
    }, [markReady, data, template]);
    return (<div id="thumbnail-root" style={{
            position: "relative",
            width: canvas.width,
            height: canvas.height,
            transform: scale !== 1 ? `scale(${scale})` : undefined,
            transformOrigin: "top left",
            overflow: "hidden",
            background: "#141414",
            fontFamily: template.components.mapTitle.fontFamily,
        }}>

      <BackgroundLayer config={{
            ...template.background,
            source: data.backgroundUrl ?? template.background.source,
            fallbacks: data.backgroundFallbacks ?? template.background.fallbacks,
        }}/>


      <PanelLayer config={c.topPanel} backgroundSrc={bgSrc}/>
      <StarNotch config={c.starNotch} beatmapStatus={data.beatmapStatus}/>
      {data.status.kind === "fc" && !hasSliderBreaks ? (<TextLayer config={c.status} testId="status">
          {text("status")}
        </TextLayer>) : (<>
          {hasMisses ? (<TextLayer config={statusMiss} testId="status-miss">
              {text("status")}
            </TextLayer>) : null}
          {hasSliderBreaks ? (<TextLayer config={statusSB} testId="status-sb">
              {text("status-sb")}
            </TextLayer>) : null}
        </>)}
      <TextLayer config={{ ...c.starRating, color: starColor(data, template) }} testId="star-rating">
        {text("star-rating")}
      </TextLayer>
      <TextLayer config={c.pp} testId="pp">
        {text("pp")}
      </TextLayer>
      <BadgeRow config={c.badgeRow}>
        <BadgeLayer config={c.comboBadge} testId="combo" variant="row">
          {text("combo")}
        </BadgeLayer>
        <BadgeLayer config={c.difficultyBadge} testId="difficulty" variant="row">
          {text("difficulty")}
        </BadgeLayer>
        <BadgeLayer config={c.bpmBadge} testId="bpm" variant="row">
          {text("bpm")}
        </BadgeLayer>
      </BadgeRow>

      <TextLayer config={c.mapTitle} testId="map-title">
        {text("map-title")}
      </TextLayer>

      <TextLayer config={{ ...c.grade, color: gradeColor(data, template) }} testId="grade">
        {text("grade")}
      </TextLayer>
      <TextLayer config={c.accuracy} testId="accuracy">
        {text("accuracy")}
      </TextLayer>
      <TextLayer config={c.leaderboard} testId="leaderboard">
        {text("leaderboard")}
      </TextLayer>


      <Avatar url={data.avatarUrl} config={c.avatar}/>
      <CountryFlag countryCode={data.countryCode} config={c.countryFlag}/>
      <UsernamePanel username={text("username")} config={c.usernamePanel}/>
      <ModList mods={data.mods} config={c.modList}/>

      <TwitchLogo config={c.twitchLogo}/>

      {c.innerBorder?.visible ? (<div data-layer="inner-border" style={{
                position: "absolute",
                inset: c.innerBorder.inset ?? 18,
                border: c.innerBorder.border ?? "2px solid rgba(255, 255, 255, 0.35)",
                borderRadius: c.innerBorder.borderRadius ?? 20,
                boxShadow: "0 0 16px rgba(255, 255, 255, 0.12)",
                pointerEvents: "none",
                zIndex: 15,
            }}/>) : null}

      {c.sparkles?.visible ? (<CuteSparkles config={c.sparkles} color={template.theme.accent}/>) : null}


      <BottomMessage text={text("bottom-text")} accentPart={template.bottomHighlightOverride} config={c.bottomMessage}/>

      {template.customTexts?.map((item) => (<TextLayer key={item.id} config={item} testId={item.id}>
          {item.text}
        </TextLayer>))}
    </div>);
}

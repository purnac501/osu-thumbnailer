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

declare global {
  interface Window {
    __THUMBNAIL_READY?: boolean;
  }
}

/**
 * Grade letter color. S ranks: gold without HD, silver with HD.
 * Other ranks use the template's per-rank colors.
 */
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

/** Star rating color derives from the actual notch asset color per status. */
function starColor(data: ThumbnailData, template: ThumbnailTemplate): string {
  if (template.components.starRating.color !== template.theme.starRating) {
    return template.components.starRating.color;
  }
  const colors = template.components.starNotch.statusColors;
  const status = data.beatmapStatus;
  if (colors) {
    if (status && colors[status]) return colors[status];
    if (
      status &&
      ["graveyard", "grave", "wip", "pending", "unranked", "unknown"].includes(status) &&
      (colors.graveyard || colors.grave || colors.unranked || colors.unknown)
    ) {
      return colors.graveyard ?? colors.grave ?? colors.unranked ?? colors.unknown ?? template.components.starRating.color;
    }
    if (colors.ranked) return colors.ranked;
  }
  return template.components.starRating.color;
}

/**
 * The thumbnail renderer. Pure function of (data, template, scale).
 * Used by the live preview, the render route, and PNG generation alike.
 * All layout/style comes from the template config, never from JSX.
 */
export function Thumbnail({
  data,
  template,
  scale = 1,
  markReady = false,
}: {
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

  // Signal render completion (fonts + images) for the Playwright pipeline.
  useEffect(() => {
    if (!markReady) return;
    let cancelled = false;
    const check = () => {
      if (cancelled) return;
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

  return (
    <div
      id="thumbnail-root"
      style={{
        position: "relative",
        width: canvas.width,
        height: canvas.height,
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: "top left",
        overflow: "hidden",
        background: "#141414",
        fontFamily: template.components.mapTitle.fontFamily,
      }}
    >
      {/* Background: data URLs win over template defaults; fallback chain included. */}
      <BackgroundLayer
        config={{
          ...template.background,
          source: data.backgroundUrl ?? template.background.source,
          fallbacks: data.backgroundFallbacks ?? template.background.fallbacks,
        }}
      />

      {/* Top panel and its children */}
      <PanelLayer config={c.topPanel} backgroundSrc={bgSrc} />
      <StarNotch config={c.starNotch} beatmapStatus={data.beatmapStatus} />
      {data.status.kind === "fc" && !hasSliderBreaks ? (
        <TextLayer config={c.status} testId="status">
          {text("status")}
        </TextLayer>
      ) : (
        <>
          {hasMisses ? (
            <TextLayer config={statusMiss} testId="status-miss">
              {text("status")}
            </TextLayer>
          ) : null}
          {hasSliderBreaks ? (
            <TextLayer config={statusSB} testId="status-sb">
              {text("status-sb")}
            </TextLayer>
          ) : null}
        </>
      )}
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
      {/* Score section */}
      <TextLayer config={{ ...c.grade, color: gradeColor(data, template) }} testId="grade">
        {text("grade")}
      </TextLayer>
      <TextLayer config={c.accuracy} testId="accuracy">
        {text("accuracy")}
      </TextLayer>
      <TextLayer config={c.leaderboard} testId="leaderboard">
        {text("leaderboard")}
      </TextLayer>

      {/* Player section */}
      <Avatar url={data.avatarUrl} config={c.avatar} />
      <CountryFlag countryCode={data.countryCode} config={c.countryFlag} />
      <UsernamePanel username={text("username")} config={c.usernamePanel} />
      <ModList mods={data.mods} config={c.modList} />

      <TwitchLogo config={c.twitchLogo} />

      {/* Bottom message: manual text with the accent-colored substring
          highlighted wherever it appears. */}
      <BottomMessage
        text={text("bottom-text")}
        accentPart={template.bottomHighlightOverride}
        config={c.bottomMessage}
      />

      {template.customTexts?.map((item) => (
        <TextLayer key={item.id} config={item} testId={item.id}>
          {item.text}
        </TextLayer>
      ))}
    </div>
  );
}

import type { CustomTextLayerConfig, ThumbnailTemplate } from "./types";
import type { ThumbnailData } from "../shared/types/thumbnail";
import { mixColors, withAlpha } from "../shared/formatting/color";

/**
 * Full editor state: runtime design overrides, manual text overrides per
 * layer, and dragged positions. Applied identically by the preview and the
 * PNG pipeline, and persisted to localStorage by the client.
 */
export interface EditorState {
  accent?: string;
  twitchVisible?: boolean;
  /** Manual fallback when osu! does not expose slider-break statistics. */
  sliderBreakCount?: number;
  /** Manual miss count override. */
  missCount?: number;
  /** Manual play status kind override. */
  statusKind?: "fc" | "miss" | "unknown";
  /** Full bottom message text (replaces the template default). */
  bottomText?: string;
  /** Accent-colored substring of the bottom text. */
  bottomAccent?: string;
  /** Manual text per layer id, e.g. { pp: "9999PP" }. */
  textOverrides?: Record<string, string>;
  /** Absolute logical-canvas positions per layer id after dragging. */
  positionOverrides?: Record<string, { x: number; y: number }>;
  /** Config patches per layer id after resizing, e.g. { pp: { fontSize: 130 } }. */
  sizeOverrides?: Record<string, Record<string, number>>;
  /** Text color overrides per layer id. */
  colorOverrides?: Record<string, string>;
  /** Font size overrides per layer id. */
  fontSizeOverrides?: Record<string, number>;
  customTexts?: CustomTextLayerConfig[];
}

/** Applies data edits that cannot be represented by template configuration. */
export function applyDataOverrides(data: ThumbnailData, state: EditorState | undefined): ThumbnailData {
  if (!state) return data;

  const missCount = state.missCount !== undefined ? Math.max(0, Math.round(state.missCount)) : data.missCount;
  const sbCount = state.sliderBreakCount !== undefined ? Math.max(0, Math.round(state.sliderBreakCount)) : data.sbCount;

  let status = data.status;
  if (state.statusKind) {
    if (state.statusKind === "fc") {
      status = { kind: "fc" };
    } else if (state.statusKind === "miss") {
      status = { kind: "miss", count: Math.max(1, missCount) };
    } else {
      status = { kind: "unknown" };
    }
  } else if (state.missCount !== undefined || state.sliderBreakCount !== undefined) {
    if (missCount > 0) {
      status = { kind: "miss", count: missCount };
    } else if (sbCount > 0) {
      status = { kind: "unknown" };
    } else {
      status = { kind: "fc" };
    }
  }

  const isFullCombo = status.kind === "fc" && sbCount === 0 && missCount === 0;

  return {
    ...data,
    missCount,
    sbCount,
    status,
    isFullCombo,
  };
}

/** Maps data-layer ids to component config keys in the template. */
export const COMPONENT_BY_LAYER: Record<string, string> = {
  "top-panel": "topPanel",
  "star-notch": "starNotch",
  status: "status",
  "status-miss": "statusMiss",
  "status-sb": "statusSB",
  "star-rating": "starRating",
  pp: "pp",
  combo: "comboBadge",
  difficulty: "difficultyBadge",
  bpm: "bpmBadge",
  "map-title": "mapTitle",
  grade: "grade",
  accuracy: "accuracy",
  leaderboard: "leaderboard",
  avatar: "avatar",
  "country-flag": "countryFlag",
  username: "usernamePanel",
  "mod-list": "modList",
  "twitch-logo": "twitchLogo",
  "bottom-message": "bottomMessage",
};

/**
 * Applies the full editor state to a template. The same helper runs in the
 * client preview and in the render page that Playwright screenshots, so
 * downloads always match what was edited on screen.
 */
export function applyOverrides(
  template: ThumbnailTemplate,
  state: EditorState | undefined,
): ThumbnailTemplate {
  if (!state || Object.values(state).every((v) => v === undefined)) {
    return template;
  }

  const next = structuredClone(template);
  const {
    accent,
    twitchVisible,
    bottomText,
    bottomAccent,
    textOverrides,
    positionOverrides,
    sizeOverrides,
    colorOverrides,
    fontSizeOverrides,
    customTexts,
  } = state;

  next.customTexts = structuredClone(customTexts ?? []);

  if (accent) {
    next.theme.accent = accent;
    next.theme.panelBorder = withAlpha(accent, 0.85);
    next.theme.badgeBorder = withAlpha(accent, 1);
    next.components.bottomMessage.highlightedColor = accent;
    next.components.bottomMessage.highlightedGlow = {
      blur: 14,
      layers: 2,
    };
    // Border colors are baked into the component configs, so update them here.
    next.components.topPanel.borderColor = withAlpha(accent, 0.85);
    for (const key of ["comboBadge", "difficultyBadge", "bpmBadge"] as const) {
      next.components[key].borderColor = withAlpha(accent, 1);
    }
    // Username panel: spine + dark gradient tinted with the accent (semi-transparent).
    next.components.usernamePanel.leftAccent = {
      ...next.components.usernamePanel.leftAccent!,
      color: mixColors(accent, "#1A0D0F", 0.35) + "D9",
    };
    next.components.usernamePanel.background = `linear-gradient(180deg, ${mixColors(accent, "#1A0D0F", 0.7)}D9 0%, ${mixColors(accent, "#1A0D0F", 0.85)}B3 100%)`;
  }

  if (twitchVisible !== undefined) {
    next.components.twitchLogo.visible = twitchVisible;
  }

  if (bottomText !== undefined) {
    next.dataOptions.bottomPrefix = bottomText;
  }
  if (bottomAccent !== undefined) {
    next.bottomHighlightOverride = bottomAccent === "" ? undefined : bottomAccent;
  }

  if (textOverrides && Object.keys(textOverrides).length > 0) {
    next.textOverrides = { ...next.textOverrides, ...textOverrides };
  }

  if (positionOverrides) {
    const configs = next.components as unknown as Record<string, { x: number; y: number }>;
    for (const [layer, pos] of Object.entries(positionOverrides)) {
      const key = COMPONENT_BY_LAYER[layer];
      const conf = key ? configs[key] : next.customTexts?.find((item) => item.id === layer);
      if (conf) {
        conf.x = Math.round(pos.x);
        conf.y = Math.round(pos.y);
      }
    }
  }

  if (sizeOverrides) {
    const configs = next.components as unknown as Record<string, Record<string, number>>;
    for (const [layer, patch] of Object.entries(sizeOverrides)) {
      const key = COMPONENT_BY_LAYER[layer];
      const conf = key ? configs[key] : next.customTexts?.find((item) => item.id === layer);
      if (conf) Object.assign(conf, patch);
    }
  }

  if (fontSizeOverrides) {
    for (const [layer, size] of Object.entries(fontSizeOverrides)) {
      if (layer.startsWith("custom-")) {
        const item = next.customTexts?.find((c) => c.id === layer);
        if (item) item.fontSize = size;
      } else {
        const key = COMPONENT_BY_LAYER[layer];
        if (key && key in next.components) {
          const conf = (next.components as unknown as Record<string, any>)[key];
          if (conf && typeof conf.fontSize === "number") {
            conf.fontSize = size;
            if (typeof conf.maxWidth === "number") {
              conf.maxWidth = Math.max(conf.maxWidth, size * 8);
            }
          }
          if (layer === "status") {
            next.components.statusMiss.fontSize = size;
            if (typeof next.components.statusMiss.maxWidth === "number") {
              next.components.statusMiss.maxWidth = Math.max(next.components.statusMiss.maxWidth, size * 8);
            }
          }
        }
      }
    }
  }

  if (colorOverrides) {
    for (const [layer, color] of Object.entries(colorOverrides)) {
      if (layer.startsWith("custom-")) {
        const item = next.customTexts?.find((c) => c.id === layer);
        if (item) item.color = color;
      } else {
        const key = COMPONENT_BY_LAYER[layer];
        if (key && key in next.components) {
          const conf = (next.components as unknown as Record<string, any>)[key];
          if (conf) {
            if ("color" in conf) conf.color = color;
            if ("prefixColor" in conf) conf.prefixColor = color;
          }
          if (layer === "status") {
            next.components.statusMiss.color = color;
          }
        }
      }
    }
  }

  return next;
}

/**
 * Template configuration types. CONTENT / LAYOUT / STYLE / ASSETS are separable:
 * a template is data, not JSX. Every meaningful thumbnail element maps to one
 * config object so scripts can change visibility, position, fonts, colors, etc.
 * programmatically without touching component code.
 *
 * All coordinates are in the template's logical canvas space (default 1280x720),
 * top-left anchored. The renderer scales the whole canvas for other resolutions.
 */

export interface LayerBase {
  visible: boolean;
  x: number;
  y: number;
  opacity?: number;
  rotation?: number;
}

export interface TextEffect {
  /** Simple drop shadow. */
  shadow?: { offsetX: number; offsetY: number; blur: number; color: string };
  /** Soft outer glow (layered text-shadow). */
  glow?: { color?: string; blur: number; layers?: number };
  /** Optional gradient text fill (e.g. linear-gradient(180deg, ...)). */
  gradient?: string;
  /** Optional text stroke outline. */
  stroke?: { width: number; color: string };
  /** Solid 3D stepped block extrusion. */
  extrusion?: { depth: number; color?: string; offsetX?: number; offsetY?: number };
}

export interface TextLayerConfig extends LayerBase, TextEffect {
  width?: number;
  height?: number;
  /** Shrink the font until the text fits this width (shrink-to-fit). */
  maxWidth?: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  letterSpacing?: number;
  lineHeight?: number;
  textTransform?: "none" | "uppercase";
  color: string;
  align?: "left" | "center" | "right";
  valign?: "top" | "center" | "bottom";
  transform?: string;
  background?: string;
  border?: string;
  borderRadius?: number | string;
  padding?: string;
  boxShadow?: string;
}

export interface CustomTextLayerConfig extends TextLayerConfig {
  id: string;
  text: string;
}

/** Rounded pill/panel with text, e.g. combo / difficulty / bpm badges. */
export interface BadgeLayerConfig extends TextLayerConfig {
  background: string;
  borderColor: string;
  borderWidth: number;
  /**
   * Corner radius. Accepts CSS shorthand, e.g. "33px 0 0 33px" for a pill
   * with flat inner corners (combo/bpm badges) or a number for uniform radius.
   */
  radius: number | string;
  /** Horizontal text padding inside the badge (only for auto-width layout). */
  paddingX?: number;
  /** Auto-size the badge to its text (width acts as a min-width). */
  autoWidth?: boolean;
  /** Hard width cap for auto-width badges; text shrinks (then clips) beyond it. */
  maxWidth?: number;
  /** Anchor the badge at its horizontal center (x = center) instead of left edge. */
  centerX?: boolean;
  /** Optional accent bar on the left edge (username panel spine). */
  leftAccent?: { color: string; width: number };
}

/** A filled panel shape with no text of its own. */
export interface PanelLayerConfig extends LayerBase {
  width: number;
  height: number;
  background: string;
  borderColor?: string;
  borderWidth?: number;
  radius: number;
  /** Blurs whatever is behind the panel (frosted-glass look). */
  backdropBlur?: number;
  /**
   * Independent background crop rendered inside the panel (cpol-style bar):
   * zoomed, lighter than the overall background.
   */
  backgroundImage?: {
    blur: number;
    brightness: number;
    saturation: number;
    scale: number;
    objectFit: "cover" | "contain";
    objectPosition: string;
    /** Flat tint over the crop. */
    overlayColor: string;
    overlayOpacity: number;
    /** Optional gradient overlay; wins over the flat tint when set. */
    overlayGradient?: string;
    overlayGradientOpacity?: number;
  };
  shadow?: { x: number; y: number; blur: number; color: string };
}

export interface OverlayConfig {
  visible: boolean;
  kind?: "solid" | "linear-gradient" | "radial-gradient";
  color?: string;
  /** CSS gradient string, e.g. "180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.8) 100%". */
  gradient?: string;
  opacity: number;
  blendMode?: string;
  boxShadow?: string;
  border?: string;
}

export interface BackgroundConfig {
  visible: boolean;
  /** Primary image URL (or local asset path). */
  source?: string;
  /** Extra URLs tried in order when the primary fails to load. */
  fallbacks?: string[];
  blur: number;
  brightness: number;
  saturation: number;
  contrast?: number;
  /** Overscan multiplier; 1 shows the full image, higher hides blur fringes. */
  scale: number;
  objectFit: "cover" | "contain";
  objectPosition: string;
  overlays: OverlayConfig[];
}

export interface AvatarConfig extends LayerBase {
  width: number;
  height: number;
  radius: number;
  border?: { color: string; width: number };
  shadow?: { x: number; y: number; blur: number; color: string };
  objectFit: "cover" | "contain";
}

export interface CountryFlagConfig extends LayerBase {
  /** Flag box size; the flag SVG fills it. */
  width: number;
  height: number;
  radius: number;
  border?: { color: string; width: number };
}

export interface ModListConfig extends LayerBase {  iconSize: number;
  gap: number;
  radius: number;
  opacity?: number;
  glow?: { color: string; blur: number };
  /** Render unknown mods as acronym badges instead of dropping them. */
  fallbackAcronyms: boolean;
  /**
   * Optional per-mod tile colors, e.g. { HD: { bg: "#FFCC22", fg: "dark" } }.
   * "fg" is "dark" or "light"; unset mods use the osu! category color.
   */
  modColors?: Record<string, { bg: string; fg: "dark" | "light" }>;
}

export interface TwitchLogoConfig extends LayerBase {
  asset: string;
  size: number;
  radius: number;
  background: string;
  /** Optional tint applied to the glyph (defaults to white). */
  tint?: string;
}

export interface BottomMessageConfig extends LayerBase {
  width?: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  prefixColor: string;
  highlightedColor: string;
  highlightedGlow?: { color?: string; blur: number; layers?: number };
  letterSpacing?: number;
}

export interface StarNotchConfig extends LayerBase {
  /** Per-beatmap-status notch assets (icons baked in). */
  assets?: Partial<Record<string, string>>;
  /** Star-rating text colors sampled from the notch assets, per status. */
  statusColors?: Partial<Record<string, string>>;
  /** Fallback asset when the status has no dedicated asset. */
  asset?: string;
  /** Legacy single-asset recolor filters (used only without per-status assets). */
  statusFilters?: Partial<Record<string, string>>;
  width: number;
  height: number;
  background: string;
  /** Optional darker shade for a vertical gradient (path fallback only). */
  bottomColor?: string;
  radius: number;
  tailColor: string;
  iconColor: string;
}

export interface ThemeColors {
  panel: string;
  panelBorder: string;
  fc: string;
  starRating: string;
  pp: string;
  accent: string;
  leaderboard: string;
  text: string;
  muted: string;
  badgeBorder: string;
  badgeBackground: string;
  namePanel: string;
  twitch: string;
  grade: string;
}

export interface TemplateDataOptions {
  /** Shape used by formatMapName for the MapTitle component. */
  mapNameFormat: "title" | "artist-title";
  /** Text shown for a full combo. */
  fcText: string;
  /** Text template for misses; {count} is replaced. */
  missText: string;
  /** Text template for slider breaks; {count} is replaced. Empty hides the line. */
  sbText: string;
  /** Star ratings at or above this threshold use highStarColor. */
  highStarThreshold?: number;
  highStarColor?: string;
  /** Leaderboard positions above this are hidden entirely (default 50). */
  maxLeaderboardPosition?: number;
  /** Per-rank colors for the grade letter, e.g. { A: "#7CC24E" }. */
  gradeColors: Record<string, string>;
  /** Bottom message; highlighted part uses its own color. */
  bottomPrefix: string;
}

/** Horizontal row that lays out the top-panel badges with space-between. */
export interface BadgeRowConfig extends LayerBase {
  width: number;
  height: number;
  gap: number;
}

export interface ReferenceTemplateComponents {
  topPanel: PanelLayerConfig;
  /** Container that positions combo / difficulty / bpm badges without overlap. */
  badgeRow: BadgeRowConfig;
  status: TextLayerConfig;
  /** Miss status ("5x"), used instead of `status` when the play is not an FC. */
  statusMiss: TextLayerConfig;
  /** Slider-break line ("6xSB"), rendered under statusMiss when present. */
  statusSB: TextLayerConfig;
  starNotch: StarNotchConfig;
  starRating: TextLayerConfig;
  pp: TextLayerConfig;
  comboBadge: BadgeLayerConfig;
  difficultyBadge: BadgeLayerConfig;
  bpmBadge: BadgeLayerConfig;
  mapTitle: TextLayerConfig;
  grade: TextLayerConfig;
  accuracy: TextLayerConfig;
  leaderboard: TextLayerConfig;
  avatar: AvatarConfig;
  countryFlag: CountryFlagConfig;
  usernamePanel: BadgeLayerConfig;
  modList: ModListConfig;
  twitchLogo: TwitchLogoConfig;
  bottomMessage: BottomMessageConfig;
  sparkles?: LayerBase & { color?: string; count?: number };
  innerBorder?: LayerBase & { inset?: number; border?: string; borderRadius?: number };
}

export interface ThumbnailTemplate {
  id: string;
  name: string;
  canvas: { width: number; height: number };
  theme: ThemeColors;
  background: BackgroundConfig;
  dataOptions: TemplateDataOptions;
  components: ReferenceTemplateComponents;
  /**
   * Manual bottom-message accent text (runtime override). When set it replaces
   * the automatic leaderboard-position highlight.
   */
  bottomHighlightOverride?: string;
  /** Manual text per layer id (see computeTexts keys), applied at render time. */
  textOverrides?: Record<string, string>;
  positionOverrides?: Record<string, { x: number; y: number }>;
  sizeOverrides?: Record<string, Record<string, number>>;
  colorOverrides?: Record<string, string>;
  fontSizeOverrides?: Record<string, number>;
  customTexts?: CustomTextLayerConfig[];
}

export const RESOLUTION_PRESETS = {
  "1280x720": { width: 1280, height: 720 },
  "1920x1080": { width: 1920, height: 1080 },
  "2560x1440": { width: 2560, height: 1440 },
  "3840x2160": { width: 3840, height: 2160 },
} as const;

export type ResolutionPreset = keyof typeof RESOLUTION_PRESETS;

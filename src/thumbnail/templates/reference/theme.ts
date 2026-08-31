import type { ThemeColors } from "../../types";

/**
 * Reference template palette, sampled from reference/Reference.png.
 * Centralized so scripts can restyle without touching components.
 */
export const referenceTheme: ThemeColors = {
  panel: "#1d1717",
  // Accent is user-pickable at runtime (GeneratorPage color input).
  // Grey by default; borders derive from it so the whole design shifts together.
  panelBorder: "rgba(190, 190, 190, 0.85)",
  fc: "#F5A83C",
  starRating: "#4FA8E8",
  pp: "#FFFFFF",
  accent: "#B8B8B8",
  leaderboard: "#7E97B8",
  text: "#FFFFFF",
  muted: "#C9C9C9",
  badgeBorder: "rgba(190, 190, 190, 1)",
  badgeBackground: "#2b2222",
  namePanel: "#4A2727",
  twitch: "#9146FF",
  grade: "#BEBEBE",
};

export const FONTS = {
  display: '"Baloo 2", "Montserrat", sans-serif',
  body: '"Montserrat", sans-serif',
} as const;

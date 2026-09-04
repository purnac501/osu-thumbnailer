import type { ThemeColors } from "../../types";
export const showcaseTheme: ThemeColors = {
    panel: "var(--shadow-color, #06070C)",
    panelBorder: "rgba(255, 255, 255, 0.4)",
    fc: "var(--accent-color, #00F0FF)",
    starRating: "#FFD166",
    pp: "#FFFFFF",
    accent: "var(--accent-color, #00F0FF)",
    leaderboard: "#FFEAA7",
    text: "#FFFFFF",
    muted: "#D0DCD5",
    badgeBorder: "var(--accent-color, #00F0FF)",
    badgeBackground: "var(--shadow-color, #06070C)",
    namePanel: "var(--shadow-color, #06070C)",
    twitch: "#9B59B6",
    grade: "#FFFFFF",
};
export const FONTS = {
    kocmoc: '"Teko", "Bebas Neue", sans-serif',
    angelicide: '"Kaushan Script", cursive',
    tidalwave: '"Russo One", "Paytone One", sans-serif',
    default: '"Teko", "Bebas Neue", "Russo One", sans-serif',
    body: '"Montserrat", sans-serif',
} as const;

export interface OverlayTheme {
    accent: string;
    top: string;
    bottom: string;
    lip: string;
}
export const OVERLAY_THEMES: Record<string, OverlayTheme> = {
    cyan: { accent: "#00D2FF", top: "#093448", bottom: "#052332", lip: "#0d4663" },
    purple: { accent: "#C084FC", top: "#20113A", bottom: "#100822", lip: "#321B59" },
    magenta: { accent: "#FF2E93", top: "#360E2A", bottom: "#1E0717", lip: "#521640" },
    gold: { accent: "#FFB703", top: "#2E240D", bottom: "#171204", lip: "#483915" },
    emerald: { accent: "#10B981", top: "#0B2E24", bottom: "#041813", lip: "#104838" },
    crimson: { accent: "#EF4444", top: "#350F14", bottom: "#1F070A", lip: "#541820" },
};
export const OVERLAY_THEME_IDS = [...Object.keys(OVERLAY_THEMES), "custom"] as const;
export type OverlayThemeId = (typeof OVERLAY_THEME_IDS)[number];
export function applyOverlayPalette(accent: string, top: string, bottom: string, lip: string): void {
    const root = document.documentElement.style;
    root.setProperty("--cyan-accent", accent);
    root.setProperty("--card-teal-top", top);
    root.setProperty("--card-teal-bottom", bottom);
    root.setProperty("--bottom-lip-color", lip);
    root.setProperty("--card-border", `${accent}55`);
    root.setProperty("--card-shadow-glow", `${accent}28`);
}
export function customAccentPalette(color: string): OverlayTheme {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return {
        accent: color,
        top: `rgb(${Math.round(r * 0.18 + 5)}, ${Math.round(g * 0.18 + 8)}, ${Math.round(b * 0.18 + 12)})`,
        bottom: `rgb(${Math.round(r * 0.08 + 2)}, ${Math.round(g * 0.08 + 4)}, ${Math.round(b * 0.08 + 6)})`,
        lip: `rgb(${Math.round(r * 0.28 + 8)}, ${Math.round(g * 0.28 + 12)}, ${Math.round(b * 0.28 + 18)})`,
    };
}

import { describe, expect, it, vi } from "vitest";
import { buildPlaycountSpline } from "../src/client/animation/spline";
import { OVERLAY_THEMES, applyOverlayPalette, customAccentPalette, } from "../src/client/animation/themes";
import { OVERLAY_TOTAL_CYCLE, seekOverlay } from "../src/client/animation/timeline";
import type { OverlayNode } from "../src/client/animation/OverlayWidget";
import { DEFAULT_OVERLAY_DATA, type OverlayData } from "../src/client/animation/types";
class FakeEl {
    textContent: string | null = "";
    style: Record<string, string> = {};
    private classes = new Set<string>();
    classList = {
        toggle: (name: string, on: boolean) => {
            if (on)
                this.classes.add(name);
            else
                this.classes.delete(name);
        },
        contains: (name: string) => this.classes.has(name),
    };
}
function makeSource() {
    const els = new Map<string, FakeEl>();
    return {
        els,
        source: {
            get: (name: OverlayNode) => {
                if (!els.has(name))
                    els.set(name, new FakeEl());
                return els.get(name)! as unknown as Element;
            },
        },
    };
}
function digits(value: string | null): number {
    return Number((value ?? "").replace(/[^0-9]/g, "")) || 0;
}
describe("playcount spline", () => {
    it("falls back for missing or tiny histories", () => {
        expect(buildPlaycountSpline(undefined).d.length).toBeGreaterThan(0);
        expect(buildPlaycountSpline([]).d.length).toBeGreaterThan(0);
        expect(buildPlaycountSpline([{ date: "2020-01-01", count: 5 }]).peakX).toBe(134);
    });
    it("draws a smooth curve through monthly counts and marks the peak", () => {
        const spline = buildPlaycountSpline([
            { date: "2024-01-01", count: 1000 },
            { date: "2024-02-01", count: 9000 },
            { date: "2024-03-01", count: 3000 },
        ]);
        expect(spline.d.startsWith("M 20,")).toBe(true);
        expect(spline.d).toContain("C");
        expect(spline.peakY).toBeLessThan(50);
    });
});
describe("overlay themes", () => {
    it("ships six themes with distinct accents", () => {
        const ids = Object.keys(OVERLAY_THEMES);
        expect(ids).toHaveLength(6);
        expect(new Set(ids.map((id) => OVERLAY_THEMES[id]!.accent)).size).toBe(6);
    });
    it("derives dark card tones from a custom accent", () => {
        expect(customAccentPalette("#00D2FF")).toEqual({
            accent: "#00D2FF",
            top: "rgb(5, 46, 58)",
            bottom: "rgb(2, 21, 26)",
            lip: "rgb(8, 71, 89)",
        });
    });
    it("applies the palette to root CSS variables", () => {
        const setProperty = vi.fn();
        vi.stubGlobal("document", { documentElement: { style: { setProperty } } });
        try {
            applyOverlayPalette("#00D2FF", "#093448", "#052332", "#0d4663");
            const names = setProperty.mock.calls.map((call) => call[0]);
            expect(names).toContain("--cyan-accent");
            expect(names).toContain("--card-teal-top");
            expect(names).toContain("--card-teal-bottom");
            expect(names).toContain("--bottom-lip-color");
        }
        finally {
            vi.unstubAllGlobals();
        }
    });
});
describe("overlay timeline", () => {
    const data: OverlayData = {
        ...DEFAULT_OVERLAY_DATA,
        player: { ...DEFAULT_OVERLAY_DATA.player, hours: 3664, playcount: 301395 },
        map: { ...DEFAULT_OVERLAY_DATA.map, favs: "138", plays: "17 632" },
    };
    it("spans a 4.5s loop", () => {
        expect(OVERLAY_TOTAL_CYCLE).toBe(5.4);
    });
    it("opens from nothing into the player view", () => {
        const { els, source } = makeSource();
        seekOverlay(0, source, data);
        expect(Number(els.get("widget")!.style.opacity)).toBe(0);
        seekOverlay(1.2, source, data);
        expect(els.get("widget")!.style.opacity).toBe("1");
        expect(els.get("topPlayer")!.classList.contains("visible")).toBe(true);
        expect(els.get("topMap")!.classList.contains("visible")).toBe(false);
    });
    it("seeks layer fades without browser transition state", () => {
        const { els, source } = makeSource();
        seekOverlay(0.16, source, data);
        const openingOpacity = Number(els.get("topPlayer")!.style.opacity);
        expect(openingOpacity).toBeGreaterThan(0);
        expect(openingOpacity).toBeLessThan(1);
        seekOverlay(2.58, source, data);
        const closingOpacity = Number(els.get("topPlayer")!.style.opacity);
        expect(closingOpacity).toBeGreaterThan(0);
        expect(closingOpacity).toBeLessThan(1);
        seekOverlay(3, source, data);
        const mapOpacity = Number(els.get("topMap")!.style.opacity);
        expect(mapOpacity).toBeGreaterThan(0);
        expect(mapOpacity).toBeLessThan(1);
    });
    it("counts player numbers up and draws the line", () => {
        const { els, source } = makeSource();
        seekOverlay(0.6, source, data);
        expect(digits(els.get("pHours")!.textContent)).toBeGreaterThan(0);
        expect(digits(els.get("pPlaycount")!.textContent)).toBeGreaterThan(0);
        seekOverlay(2.2, source, data);
        expect(digits(els.get("pHours")!.textContent)).toBe(3664);
        expect(digits(els.get("pPlaycount")!.textContent)).toBe(301395);
        const offset = Number(els.get("svgPlayerPath")!.style.strokeDashoffset);
        expect(offset).toBeGreaterThanOrEqual(0);
        expect(offset).toBeLessThan(1200);
    });
    it("parks the map side at empty before the map opens", () => {
        const { els, source } = makeSource();
        seekOverlay(3.6, source, data);
        expect(els.get("fillAr")!.style.width).not.toBe("0%");
        seekOverlay(0, source, data);
        for (const name of ["fillAr", "fillCs", "fillOd", "fillHp"] as const) {
            expect(els.get(name)!.style.width).toBe("0%");
        }
        expect(els.get("mFavs")!.textContent).toBe("0");
        expect(els.get("mPlays")!.textContent).toBe("0");
    });
    it("fills map bars and counts favs and plays", () => {
        const { els, source } = makeSource();
        seekOverlay(3, source, data);
        expect(els.get("topMap")!.classList.contains("visible")).toBe(true);
        expect(els.get("starFooter")!.classList.contains("visible")).toBe(false);
        seekOverlay(4.5, source, data);
        expect(els.get("topMap")!.classList.contains("visible")).toBe(true);
        expect(els.get("bottomMap")!.classList.contains("visible")).toBe(true);
        expect(els.get("starFooter")!.classList.contains("visible")).toBe(true);
        expect(els.get("fillAr")!.style.width).not.toBe("0%");
        expect(digits(els.get("mFavs")!.textContent)).toBe(138);
        expect(digits(els.get("mPlays")!.textContent)).toBe(17632);
    });
    it("shows the star rating with the map details", () => {
        const { els, source } = makeSource();
        seekOverlay(3.18, source, data);
        expect(Number(els.get("starFooter")!.style.opacity)).toBeGreaterThan(0);
        expect(els.get("bottomMap")!.style.opacity).toBe(els.get("starFooter")!.style.opacity);
    });
    it("fades the widget out at the end of the loop", () => {
        const { els, source } = makeSource();
        seekOverlay(5, source, data);
        expect(Number(els.get("widget")!.style.opacity)).toBeLessThan(1);
        expect(Number(els.get("starFooter")!.style.opacity)).toBeLessThan(1);
    });
    it("draws graph lines along their measured length", () => {
        const { els, source } = makeSource();
        const path = source.get("svgPlayerPath") as unknown as Record<string, unknown>;
        path.getTotalLength = () => 600;
        seekOverlay(1.2, source, data);
        expect(els.get("svgPlayerPath")!.style.strokeDasharray).toBe("600");
        const offset = Number(els.get("svgPlayerPath")!.style.strokeDashoffset);
        expect(offset).toBeGreaterThan(0);
        expect(offset).toBeLessThan(600);
        seekOverlay(2.2, source, data);
        expect(els.get("svgPlayerPath")!.style.strokeDashoffset).toBe("0");
    });
});

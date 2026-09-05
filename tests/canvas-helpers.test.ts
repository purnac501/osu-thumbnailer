import { afterEach, expect, it, vi } from "vitest";
import { sampleImagePalette } from "../src/thumbnail/color-sampler";
import { fitFontSize } from "../src/thumbnail/components/Text/fit";

afterEach(() => vi.unstubAllGlobals());

it("preserves palette selection, shadow averaging, and empty defaults", () => {
    class Canvas {
        width = 100;
        height = 1;
        constructor(private pixels: number[][]) {}
        getContext() {
            return { getImageData: () => ({
                data: new Uint8ClampedArray(this.pixels.flatMap((pixel) => [...pixel, ...Array(12).fill(0)])),
            }) };
        }
    }
    vi.stubGlobal("HTMLCanvasElement", Canvas);
    const palette = (pixels: number[][]) => sampleImagePalette(new Canvas(pixels) as unknown as HTMLCanvasElement);
    expect(palette([])).toEqual({ accentColor: "#00f0ff", shadowColor: "#06070c" });
    expect(palette([
        [255, 0, 0, 0], [200, 100, 50, 255], [0, 220, 255, 255], [255, 255, 255, 255],
        [2, 4, 6, 255], [4, 6, 8, 255], [10, 12, 14, 255], [20, 22, 24, 255], [30, 32, 34, 255],
    ])).toEqual({ accentColor: "#00dcff", shadowColor: "#030507" });
    expect(palette([[255, 0, 0, 127], [0, 255, 0, 128], [0, 0, 255, 255]]).accentColor).toBe("#00ff00");
});

it("preserves font fitting, letter spacing, minimum size, and early returns", () => {
    const measureText = vi.fn(() => ({ width: 200 }));
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => ({ measureText }) }) });
    const spec = { fontFamily: "sans-serif", fontWeight: 600, fontSize: 40, letterSpacing: 2 };
    expect(fitFontSize("test", spec, 103)).toBe(20);
    expect(fitFontSize("test", spec, 154.5)).toBe(30);
    expect(fitFontSize("test", spec, 300)).toBe(40);
    expect(fitFontSize("test", spec, 1, 12)).toBe(12);
    measureText.mockClear();
    expect(fitFontSize("", spec, 100)).toBe(40);
    expect(fitFontSize("test", spec, 0)).toBe(40);
    expect(measureText).not.toHaveBeenCalled();
});

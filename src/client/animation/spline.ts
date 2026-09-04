import type { OverlayMonthlyCount } from "./types";
export interface SplineTick {
    label: string;
    y: number;
}
export interface SplineYearTick {
    year: number;
    x: number;
}
export interface PlaycountSpline {
    d: string;
    peakX: number;
    peakY: number;
    yTicks: SplineTick[];
    yearTicks: SplineYearTick[];
}
export const SPLINE_X0 = 20;
export const SPLINE_X1 = 425;
export const SPLINE_TOP = 20;
export const SPLINE_BOTTOM = 95;
function monthTime(date: string): number {
    const match = /^(\d{4})-(\d{2})/.exec(date);
    if (!match)
        return Number.NaN;
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, 1);
}
function formatTick(value: number): string {
    return value >= 1000 ? `${Math.round(value / 1000)}k` : `${Math.round(value)}`;
}
const FALLBACK_SPLINE = "M 20,90.9 C 20.6,87.7 22.6,75.6 23.9,71.5 C 25.2,67.4 26.6,65.1 27.9,66.1 C 29.2,67.1 30.5,74.1 31.8,77.7 C 33.1,81.3 34.4,85.2 35.7,87.8 C 37.0,90.4 38.4,92.4 39.7,93.5 C 41.0,94.6 42.3,94.2 43.6,94.3 C 44.9,94.4 46.2,95.4 47.5,94.1 C 48.8,92.8 50.2,86.5 51.5,86.4 C 52.8,86.3 54.1,92.5 55.4,93.7 C 56.7,94.9 58.0,99.2 59.3,93.4 C 60.6,87.7 62.0,63.8 63.3,59.2 C 64.6,54.6 65.9,63.2 67.2,65.7 C 68.5,68.2 69.8,70.2 71.1,74.2 C 72.4,78.3 73.7,90.7 75,90 C 76.3,89.3 77.7,75.8 79,70.1 C 80.3,64.4 81.6,60.8 82.9,56 C 84.2,51.2 85.5,41.0 86.8,41.3 C 88.1,41.6 89.5,56.3 90.8,57.9 C 92.1,59.5 93.4,52.2 94.7,50.6 C 96.0,49.0 97.3,49.0 98.6,48.5 C 99.9,48.0 101.3,48.6 102.6,47.7 C 103.9,46.8 105.2,44.4 106.5,43 C 107.8,41.6 109.1,38.3 110.4,39.3 C 111.7,40.3 113.1,46.2 114.4,49.1 C 115.7,52.0 117.0,53.8 118.3,56.9 C 119.6,60.0 120.9,69.9 122.2,67.6 C 123.5,65.3 124.9,48.1 126.2,42.8 C 127.5,37.5 128.8,39.0 130.1,36 C 131.4,33.0 132.7,24.3 134,25.1 C 135.3,25.9 136.7,37.5 138,41 C 139.3,44.5 140.6,46.0 141.9,46.4 C 143.2,46.8 144.5,41.8 145.8,43.6 C 147.1,45.4 148.5,55.5 149.8,57.2 C 151.1,59.0 152.4,52.8 153.7,54.1 C 155.0,55.4 156.3,63.4 157.6,65 C 158.9,66.6 160.3,64.3 161.6,63.5 C 162.9,62.7 164.2,59.5 165.5,60.2 C 166.8,60.9 168.1,67.4 169.4,67.6 C 170.7,67.8 172.0,65.2 173.3,61.5 C 174.6,57.8 176.0,48.6 177.3,45.4 C 178.6,42.2 179.9,43.9 181.2,42.5 C 182.5,41.1 183.8,35.7 185.1,37.3 C 186.4,38.9 187.8,48.9 189.1,52.2 C 190.4,55.6 191.7,56.1 193,57.4 C 194.3,58.7 195.6,60.4 196.9,60 C 198.2,59.6 199.6,56.5 200.9,55.2 C 202.2,53.9 203.5,51.5 204.8,52 C 206.1,52.5 207.4,54.1 208.7,58 C 210.0,61.9 211.4,74.6 212.7,75.1 C 214.0,75.6 215.3,63.1 216.6,61 C 217.9,58.9 219.2,61.4 220.5,62.3 C 221.8,63.2 223.2,64.7 224.5,66.5 C 225.8,68.3 227.1,70.9 228.4,73.4 C 229.7,75.9 231.0,78.7 232.3,81.5 C 233.6,84.3 235.0,88.5 236.3,90.5 C 237.6,92.5 238.9,99.4 240.2,93.5 C 241.5,87.6 242.8,61.9 244.1,55.2 C 245.4,48.5 246.8,54.0 248.1,53.4 C 249.4,52.8 250.7,50.6 252,51.8 C 253.3,52.9 254.6,58.3 255.9,60.3 C 257.2,62.3 258.6,63.1 259.9,63.9 C 261.2,64.7 262.5,65.4 263.8,65.2 C 265.1,65.0 266.4,62.0 267.7,63 C 269.0,64.0 270.4,69.6 271.7,70.9 C 273.0,72.2 274.3,69.9 275.6,70.9 C 276.9,72.0 278.2,77.8 279.5,77.2 C 280.8,76.6 282.1,68.1 283.4,67.2 C 284.7,66.3 286.1,69.4 287.4,71.7 C 288.7,74.0 290.0,80.4 291.3,81.1 C 292.6,81.8 293.9,76.5 295.2,75.6 C 296.5,74.7 297.9,76.0 299.2,75.8 C 300.5,75.5 301.8,75.6 303.1,74.1 C 304.4,72.6 305.7,67.2 307,66.8 C 308.3,66.4 309.7,70.6 311,71.8 C 312.3,73.0 313.6,73.0 314.9,73.8 C 316.2,74.6 317.5,76.3 318.8,76.4 C 320.1,76.5 321.5,75.9 322.8,74.6 C 324.1,73.3 325.4,68.6 326.7,68.7 C 328.0,68.8 329.3,73.5 330.6,75.3 C 331.9,77.1 333.3,80.5 334.6,79.6 C 335.9,78.7 337.2,71.4 338.5,70.1 C 339.8,68.8 341.1,72.0 342.4,71.7 C 343.7,71.4 345.1,68.3 346.4,68.4 C 347.7,68.5 349.0,71.1 350.3,72.4 C 351.6,73.7 352.9,77.3 354.2,76.2 C 355.5,75.2 356.9,67.1 358.2,66.1 C 359.5,65.1 360.8,68.5 362.1,70 C 363.4,71.5 364.7,74.9 366,75.1 C 367.3,75.3 368.7,73.5 370,71.2 C 371.3,68.9 372.6,60.8 373.9,61.3 C 375.2,61.8 376.5,71.2 377.8,74.3 C 379.1,77.4 380.4,79.4 381.7,79.9 C 383.0,80.5 384.4,78.7 385.7,77.6 C 387.0,76.5 388.3,72.8 389.6,73.2 C 390.9,73.6 392.2,78.8 393.5,79.9 C 394.8,81.0 396.2,80.0 397.5,80 C 398.8,80.0 400.1,79.2 401.4,79.9 C 402.7,80.6 404.0,83.6 405.3,84 C 406.6,84.4 408.0,82.0 409.3,82.4 C 410.6,82.9 411.9,85.8 413.2,86.7 C 414.5,87.6 415.8,88.3 417.1,87.7 C 418.4,87.1 419.8,82.4 421.1,83.3 C 422.4,84.2 424.4,91.4 425,93";
export function buildPlaycountSpline(counts: OverlayMonthlyCount[] | undefined): PlaycountSpline {
    const yTicks = (max: number): SplineTick[] => [1, 0.75, 0.5, 0.25].map((part) => ({
        label: formatTick(max * part),
        y: SPLINE_BOTTOM - (SPLINE_BOTTOM - SPLINE_TOP) * part,
    }));
    if (!counts || counts.length < 2) {
        return {
            d: FALLBACK_SPLINE,
            peakX: 134,
            peakY: 25.1,
            yTicks: yTicks(8000),
            yearTicks: Array.from({ length: 9 }, (_, i) => ({ year: 2018 + i, x: SPLINE_X0 + i * 50.625 })),
        };
    }
    const dated = counts
        .map((count) => ({ ...count, time: monthTime(count.date) }))
        .filter((count) => Number.isFinite(count.time))
        .sort((a, b) => a.time - b.time);
    if (dated.length < 2)
        return buildPlaycountSpline(undefined);
    const start = dated[0]!.time;
    const end = dated[dated.length - 1]!.time;
    const position = (time: number) => SPLINE_X0 + ((time - start) / (end - start)) * (SPLINE_X1 - SPLINE_X0);
    const firstYear = new Date(start).getUTCFullYear();
    const lastYear = new Date(end).getUTCFullYear();
    const allYears = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i);
    const yearStep = Math.max(1, Math.ceil(allYears.length / 9));
    const visibleYears = allYears.filter((_, i) => i % yearStep === 0);
    if (visibleYears.at(-1) !== lastYear)
        visibleYears.push(lastYear);
    const yearTicks = visibleYears.map((year) => ({
        year,
        x: Number(Math.min(SPLINE_X1, Math.max(SPLINE_X0, position(Date.UTC(year, 0, 1)))).toFixed(1)),
    }));
    let maxCount = 0;
    dated.forEach((c) => {
        if (c.count > maxCount)
            maxCount = c.count;
    });
    const maxCap = Math.max(8000, maxCount * 1.1);
    const pts = dated.map((m) => {
        const x = position(m.time);
        const y = 95 - (Math.min(maxCap, m.count) / maxCap) * 75;
        return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), count: m.count };
    });
    let peak = pts[0]!;
    pts.forEach((p) => {
        if (p.count > peak.count)
            peak = p;
    });
    let d = `M ${pts[0]!.x},${pts[0]!.y}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)]!;
        const p1 = pts[i]!;
        const p2 = pts[i + 1]!;
        const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
        const cp1x = (p1.x + (p2.x - p0.x) / 6).toFixed(1);
        const cp1y = (p1.y + (p2.y - p0.y) / 6).toFixed(1);
        const cp2x = (p2.x - (p3.x - p1.x) / 6).toFixed(1);
        const cp2y = (p2.y - (p3.y - p1.y) / 6).toFixed(1);
        d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return { d, peakX: peak.x, peakY: peak.y, yTicks: yTicks(maxCap), yearTicks };
}

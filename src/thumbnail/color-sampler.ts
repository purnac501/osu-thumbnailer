export interface ExtractedPalette {
  accentColor: string;
  shadowColor: string;
}

/**
 * RGB to HSV conversion helper.
 */
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h, s, v];
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Samples an HTMLImageElement or Canvas to extract:
 * 1. --accent-color: The most vibrant, dominant hue in the artwork.
 * 2. --shadow-color: The darkest dominant tone sampled from shadow areas.
 */
export function sampleImagePalette(img: HTMLImageElement | HTMLCanvasElement): ExtractedPalette {
  const canvas =
    img instanceof HTMLCanvasElement
      ? img
      : document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { accentColor: "#00F0FF", shadowColor: "#06070C" };
  }

  const sampleSize = 100;
  if (!(img instanceof HTMLCanvasElement)) {
    canvas.width = sampleSize;
    canvas.height = Math.round((sampleSize * (img.naturalHeight || 720)) / (img.naturalWidth || 1280));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const totalPixels = canvas.width * canvas.height;

  let bestVibrantScore = -1;
  let bestVibrantRgb: [number, number, number] = [0, 240, 255];

  const shadowBuckets: [number, number, number][] = [];

  // Step 4 pixels for performance
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const a = data[i + 3]!;

    if (a < 128) continue;

    const [, s, v] = rgbToHsv(r, g, b);

    // Vibrant score: reward high saturation and good brightness
    const vibrantScore = Math.pow(s, 1.4) * Math.pow(v, 1.1);
    if (vibrantScore > bestVibrantScore && s > 0.45 && v > 0.4) {
      bestVibrantScore = vibrantScore;
      bestVibrantRgb = [r, g, b];
    }

    // Shadow candidate: low brightness
    if (v < 0.22) {
      shadowBuckets.push([r, g, b]);
    }
  }

  let shadowRgb: [number, number, number] = [6, 7, 12];
  if (shadowBuckets.length > 0) {
    // Average lowest 30% darkest shadows
    shadowBuckets.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
    const subset = shadowBuckets.slice(0, Math.max(1, Math.floor(shadowBuckets.length * 0.4)));
    const avgR = subset.reduce((acc, p) => acc + p[0], 0) / subset.length;
    const avgG = subset.reduce((acc, p) => acc + p[1], 0) / subset.length;
    const avgB = subset.reduce((acc, p) => acc + p[2], 0) / subset.length;
    shadowRgb = [Math.round(avgR), Math.round(avgG), Math.round(avgB)];
  }

  return {
    accentColor: toHex(...bestVibrantRgb),
    shadowColor: toHex(...shadowRgb),
  };
}

/**
 * Injects CSS variables directly into an element's or document root's styles.
 */
export function applyColorsToRoot(
  palette: ExtractedPalette,
  target: HTMLElement = document.documentElement
) {
  target.style.setProperty("--accent-color", palette.accentColor);
  target.style.setProperty("--shadow-color", palette.shadowColor);
}

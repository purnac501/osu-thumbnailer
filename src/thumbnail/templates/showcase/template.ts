import type { ThumbnailTemplate } from "../../types";
import { showcaseLayout } from "./layout";
import { showcaseTheme } from "./theme";

export const showcaseTemplate: ThumbnailTemplate = {
  id: "showcase",
  name: "Showcase (KOCMOC / GD Benchmarks)",
  canvas: { width: 1280, height: 720 },
  theme: showcaseTheme,
  background: {
    visible: true,
    source: "/assets/benchmarks/kocmoc.jpg",
    fallbacks: [
      "/assets/benchmarks/angelicide.jpg",
      "/assets/benchmarks/tidal_wave.jpg",
      "/assets/cute/chika-bg.jpg",
    ],
    blur: 0,
    brightness: 1.0,
    saturation: 1.0,
    contrast: 1.0,
    scale: 1.0,
    objectFit: "cover",
    objectPosition: "center center",
    overlays: [
      // Subtle dark vignette (18-20% opacity) solely for text legibility
      {
        visible: true,
        kind: "radial-gradient",
        gradient: "circle at 50% 50%, rgba(0, 0, 0, 0) 35%, rgba(0, 0, 0, 0.65) 100%",
        opacity: 0.2,
      },
    ],
  },
  dataOptions: {
    mapNameFormat: "title",
    fcText: "FULL COMBO",
    missText: "{count}x MISS",
    sbText: "{count}x SB",
    maxLeaderboardPosition: 50,
    gradeColors: {
      A: "#55E6C1",
      B: "#FFD166",
      C: "#A29BFE",
      D: "#FF7675",
    },
    bottomPrefix: "",
  },
  bottomHighlightOverride: undefined,
  components: showcaseLayout,
};

export default showcaseTemplate;

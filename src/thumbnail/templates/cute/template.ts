import type { ThumbnailTemplate } from "../../types";
import { cuteLayout } from "./layout";
import { cuteTheme } from "./theme";

export const cuteTemplate: ThumbnailTemplate = {
  id: "cute",
  name: "Cute & Clean",
  canvas: { width: 1280, height: 720 },
  theme: cuteTheme,
  background: {
    visible: true,
    source: "/assets/cute/chika-bg.jpg",
    fallbacks: ["/assets/template/fixture-bg.jpg"],
    blur: 0.5,
    brightness: 0.95,
    saturation: 1.12,
    contrast: 1.05,
    scale: 1.02,
    objectFit: "cover",
    objectPosition: "center 30%",
    overlays: [
      {
        visible: true,
        kind: "linear-gradient",
        gradient: "180deg, rgba(15, 10, 24, 0.02) 0%, rgba(15, 10, 24, 0.25) 50%, rgba(15, 10, 24, 0.72) 100%",
        opacity: 0.85,
        blendMode: "multiply",
      },
      {
        visible: true,
        kind: "solid",
        boxShadow: "inset 0 0 100px rgba(255, 101, 132, 0.25)",
        opacity: 1,
      },
    ],
  },
  dataOptions: {
    mapNameFormat: "artist-title",
    fcText: "✦ FULL COMBO ✦",
    missText: "★ {count}x MISS ★",
    sbText: "★ {count}x SB ★",
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
  components: cuteLayout,
};

export default cuteTemplate;

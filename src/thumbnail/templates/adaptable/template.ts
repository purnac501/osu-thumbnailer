import type { ThumbnailTemplate } from "../../types";
import { adaptableLayout } from "./layout";
import { adaptableTheme } from "./theme";
export const adaptableTemplate: ThumbnailTemplate = {
    id: "adaptable",
    name: "Adaptable (Zyoan Tutorial)",
    canvas: { width: 1280, height: 720 },
    theme: adaptableTheme,
    background: {
        visible: true,
        source: "/assets/adaptable/lemontree-bg.jpg",
        fallbacks: ["/assets/cute/chika-bg.jpg", "/assets/template/fixture-bg.jpg"],
        blur: 1.2,
        brightness: 1.06,
        saturation: 1.2,
        contrast: 1.08,
        scale: 1.02,
        objectFit: "cover",
        objectPosition: "center 30%",
        overlays: [
            {
                visible: true,
                kind: "linear-gradient",
                gradient: "180deg, rgba(10, 16, 12, 0.02) 0%, rgba(10, 16, 12, 0.35) 55%, rgba(10, 16, 12, 0.8) 100%",
                opacity: 0.85,
                blendMode: "multiply",
            },
            {
                visible: true,
                kind: "solid",
                boxShadow: "inset 0 0 90px rgba(85, 230, 193, 0.22)",
                opacity: 1,
            },
        ],
    },
    dataOptions: {
        mapNameFormat: "title",
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
    components: adaptableLayout,
};
export default adaptableTemplate;

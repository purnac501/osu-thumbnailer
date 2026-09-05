import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ShowcaseIntroWidget } from "../src/client/animation/ShowcaseIntroWidget";
import { DEFAULT_OVERLAY_DATA } from "../src/client/animation/types";
import { describe, expect, it } from "vitest";
import {
    animationExportFileName,
    buildAnimationExportPageUrl,
    buildAnimationExportStartPath,
    parseAnimationStyle,
} from "../src/shared/animation-export";
import {
    seekShowcaseIntro,
    SHOWCASE_INTRO_TOTAL_CYCLE,
    type ShowcaseNodeSource,
} from "../src/client/animation/timeline";
import type { ShowcaseNode } from "../src/client/animation/ShowcaseIntroWidget";

class FakeEl {
    textContent: string | null = "";
    style: Record<string, string> = {};
}

describe("showcase animation export helpers", () => {
    it("parses animation style correctly", () => {
        expect(parseAnimationStyle("showcase")).toBe("showcase");
        expect(parseAnimationStyle("card")).toBe("card");
        expect(parseAnimationStyle(null)).toBe("card");
        expect(parseAnimationStyle(undefined)).toBe("card");
        expect(parseAnimationStyle("invalid")).toBe("card");
    });

    it("names export files with showcase prefix when style is showcase", () => {
        expect(animationExportFileName("gif", "compact", "showcase")).toBe("osu-showcase-intro-compact.gif");
        expect(animationExportFileName("gif", "hq", "showcase")).toBe("osu-showcase-intro.gif");
        expect(animationExportFileName("mov", "compact", "showcase")).toBe("osu-showcase-intro-compact.mov");
        expect(animationExportFileName("mov", "hq", "showcase")).toBe("osu-showcase-intro.mov");
    });

    it("defaults export filenames to osu-score-card when style is card", () => {
        expect(animationExportFileName("gif", "compact", "card")).toBe("osu-score-card-compact.gif");
        expect(animationExportFileName("gif", "hq")).toBe("osu-score-card.gif");
    });

    it("includes style param in start path and page url when style is showcase", () => {
        const startPath = buildAnimationExportStartPath({
            format: "gif",
            preset: "compact",
            style: "showcase",
            score: "https://osu.ppy.sh/scores/123",
            theme: "cyan",
            accent: "#00D2FF",
        });
        const startUrl = new URL(startPath, "http://localhost:5173");
        expect(startUrl.searchParams.get("style")).toBe("showcase");

        const pageUrl = new URL(buildAnimationExportPageUrl("http://localhost:5173", {
            format: "mov",
            preset: "hq",
            style: "showcase",
            score: "https://osu.ppy.sh/scores/123",
            theme: "cyan",
            accent: "#00D2FF",
        }));
        expect(pageUrl.searchParams.get("style")).toBe("showcase");
    });

    it("omits style param in query when style is card", () => {
        const startPath = buildAnimationExportStartPath({
            format: "gif",
            style: "card",
            score: "",
            theme: "",
            accent: "",
        });
        const startUrl = new URL(startPath, "http://localhost:5173");
        expect(startUrl.searchParams.get("style")).toBeNull();
    });
});

describe("seekShowcaseIntro timeline", () => {
    function createMockNodes(): { source: ShowcaseNodeSource; elements: Record<ShowcaseNode, FakeEl> } {
        const elements: Record<ShowcaseNode, FakeEl> = {
            container: new FakeEl(),
            topBar: new FakeEl(),
            lensWrap: new FakeEl(),
            gradeRank: new FakeEl(),
            leftFlyout: new FakeEl(),
            rightFlyout: new FakeEl(),
            bottomTime: new FakeEl(),
        };

        const source: ShowcaseNodeSource = {
            get: (name: ShowcaseNode) => elements[name] as unknown as Element ?? null,
        };

        return { source, elements };
    }

    it("has 5.4s total cycle", () => {
        expect(SHOWCASE_INTRO_TOTAL_CYCLE).toBe(5.4);
    });

    it("initializes elements as hidden/translated at t=0", () => {
        const { source, elements } = createMockNodes();
        seekShowcaseIntro(0, source);

        expect(elements.topBar.style.opacity).toBe("0");
        expect(elements.topBar.style.transform).toBe("translateY(-24px)");
        expect(elements.lensWrap.style.opacity).toBe("0");
        expect(elements.gradeRank.style.opacity).toBe("0");
        expect(elements.leftFlyout.style.opacity).toBe("0");
        expect(elements.rightFlyout.style.opacity).toBe("0");
        expect(elements.bottomTime.style.opacity).toBe("0");
    });

    it("animates top bar and lens rise by t=1.0", () => {
        const { source, elements } = createMockNodes();
        seekShowcaseIntro(1.0, source);

        expect(elements.topBar.style.opacity).toBe("1");
        expect(elements.topBar.style.transform).toBe("translateY(0)");
        expect(Number(elements.lensWrap.style.opacity)).toBeGreaterThan(0.5);
    });

    it("settles all components by t=3.0", () => {
        const { source, elements } = createMockNodes();
        seekShowcaseIntro(3.0, source);

        expect(elements.topBar.style.opacity).toBe("1");
        expect(elements.lensWrap.style.opacity).toBe("1");
        expect(elements.gradeRank.style.opacity).toBe("1");
        expect(elements.leftFlyout.style.opacity).toBe("1");
        expect(elements.leftFlyout.style.transform).toBe("translateX(0)");
        expect(elements.rightFlyout.style.opacity).toBe("1");
        expect(elements.rightFlyout.style.transform).toBe("translateX(0)");
        expect(elements.bottomTime.style.opacity).toBe("1");
        expect(elements.container.style.opacity).toBe("1");
    });

    it("fades out cleanly during outro at t=5.3", () => {
        const { source, elements } = createMockNodes();
        seekShowcaseIntro(5.3, source);

        expect(Number(elements.container.style.opacity)).toBeLessThan(0.7);
    });
});

it("shows every mod on a leaderboard score", () => {
    const data = {
        ...DEFAULT_OVERLAY_DATA,
        topScores: [{ rank: "S", title: "Natsukoi Hanabi (Sped Up Ver.)", timeAgo: "1y", pp: "100pp", mods: ["NC", "HR", "HD", "CL"] }],
    };
    const html = renderToStaticMarkup(createElement(ShowcaseIntroWidget, { data, setRef: () => () => {} }));
    expect(html).toContain('title="Natsukoi Hanabi (Sped Up Ver.)">Natsukoi Hanabi (S...<');
    for (const mod of data.topScores[0]!.mods)
        expect(html).toContain(`alt="${mod}"`);
});

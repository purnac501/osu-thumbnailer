import type { OverlayData } from "./types";
import type { OverlayNode } from "./OverlayWidget";
import type { ShowcaseNode } from "./ShowcaseIntroWidget";

export interface OverlayNodeSource {
    get(name: OverlayNode): Element | null;
}

export const OVERLAY_TOTAL_CYCLE = 5.4;

/**
 * Snappy decelerating cubic bezier easing: cubic-bezier(0.16, 1, 0.3, 1)
 * Fast responsive launch with clean elegant deceleration.
 */
export function easeMotionDecel(t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let s = t;
    for (let i = 0; i < 5; i++) {
        const s2 = s * s;
        const s3 = s2 * s;
        const oneMinus = 1 - s;
        const currentX = 3 * oneMinus * oneMinus * s * 0.16 + 3 * oneMinus * s2 * 0.3 + s3;
        const dx = 3 * oneMinus * oneMinus * 0.16 + 6 * oneMinus * s * (0.3 - 0.16) + 3 * s2 * (1 - 0.3);
        if (Math.abs(dx) < 1e-6) break;
        s -= (currentX - t) / dx;
        s = Math.min(1, Math.max(0, s));
    }
    const oneMinusS = 1 - s;
    return 1 - oneMinusS * oneMinusS * oneMinusS;
}

const easeOutCubic = (x: number): number => 1 - Math.pow(1 - x, 3);
const smoothstep = (x: number): number => {
    const t = Math.min(1, Math.max(0, x));
    return t * t * (3 - 2 * t);
};

function styled(nodes: OverlayNodeSource, name: OverlayNode): HTMLElement | SVGElement | null {
    return nodes.get(name) as HTMLElement | SVGElement | null;
}

function paintLayer(
    nodes: OverlayNodeSource,
    name: OverlayNode,
    progress: number,
    translateX = 0,
    translateY = 0
): void {
    const el = styled(nodes, name);
    if (!el) return;
    const clamped = Math.min(1, Math.max(0, progress));
    el.classList.toggle("visible", clamped > 0);
    el.style.opacity = String(clamped);
    if (translateX !== 0 || translateY !== 0) {
        el.style.transform = `translate(${translateX.toFixed(2)}px, ${translateY.toFixed(2)}px)`;
    } else {
        el.style.transform = "";
    }
}

function setBanners(nodes: OverlayNodeSource, data: OverlayData, playerOpacity: number, mapOpacity: number): void {
    const playerBanner = styled(nodes, "topBanner") as HTMLElement | null;
    if (playerBanner) {
        playerBanner.style.backgroundImage = `url("${data.player.banner}")`;
        playerBanner.style.opacity = String(playerOpacity);
    }
    const mapBanner = styled(nodes, "topBannerMap") as HTMLElement | null;
    if (mapBanner) {
        mapBanner.style.backgroundImage = `url("${data.map.cover}")`;
        mapBanner.style.opacity = String(mapOpacity);
    }
}

function setCounter(node: Element | null, value: number): void {
    if (node) {
        node.textContent = value.toLocaleString();
    }
}

const dashLengths = new WeakMap<Element, { d: string | null; length: number }>();
function measuredDash(el: Element): number {
    const current = typeof el.getAttribute === "function" ? el.getAttribute("d") : null;
    const known = dashLengths.get(el);
    if (known && known.d === current) return known.length;
    let length = 1200;
    try {
        const measured = (el as unknown as SVGPathElement).getTotalLength?.();
        if (typeof measured === "number" && measured > 0) length = measured;
    } catch {
        // Fallback default
    }
    dashLengths.set(el, { d: current, length });
    return length;
}

function hidePath(nodes: OverlayNodeSource, name: OverlayNode): void {
    const el = styled(nodes, name);
    if (!el) return;
    const length = measuredDash(el);
    el.style.strokeDasharray = String(length);
    el.style.strokeDashoffset = String(length);
}

function drawPath(nodes: OverlayNodeSource, name: OverlayNode, progress: number): void {
    const el = styled(nodes, name);
    if (!el) return;
    const length = measuredDash(el);
    el.style.strokeDasharray = String(length);
    el.style.strokeDashoffset = String(Math.round(length * (1 - Math.min(1, Math.max(0, progress)))));
}

function clearMapSide(nodes: OverlayNodeSource): void {
    const fills: OverlayNode[] = ["fillAr", "fillCs", "fillOd", "fillHp"];
    for (const name of fills) {
        const el = styled(nodes, name);
        if (el) el.style.width = "0%";
    }
    hidePath(nodes, "svgMapPath");
    const favs = nodes.get("mFavs");
    if (favs) favs.textContent = "0";
    const plays = nodes.get("mPlays");
    if (plays) plays.textContent = "0";

    const dot = styled(nodes, "pPeakDot");
    if (dot) {
        dot.style.opacity = "0";
        dot.style.transform = "scale(0)";
    }
    const peakLine = styled(nodes, "pPeakLine");
    if (peakLine) {
        peakLine.style.opacity = "0";
    }
}

function parseCount(value: string): number {
    return Number(value.replace(/[^0-9]/g, "")) || 0;
}

function paintPeak(nodes: OverlayNodeSource, progress: number): void {
    const dot = styled(nodes, "pPeakDot");
    const line = styled(nodes, "pPeakLine");
    const dotEl = nodes.get("pPeakDot");
    const cx = dotEl && typeof dotEl.getAttribute === "function" ? Number(dotEl.getAttribute("cx")) || 134 : 134;
    const peakThreshold = Math.max(0.08, Math.min(0.92, (cx - 20) / 405));

    if (progress < peakThreshold) {
        if (dot) {
            dot.style.opacity = "0";
            dot.style.transform = "scale(0)";
        }
        if (line) {
            line.style.opacity = "0";
        }
    } else {
        const p = Math.min(1, Math.max(0, (progress - peakThreshold) / 0.15));
        const pEase = easeMotionDecel(p);
        if (dot) {
            dot.style.opacity = String(pEase);
            const cy = dotEl && typeof dotEl.getAttribute === "function" ? Number(dotEl.getAttribute("cy")) || 25 : 25;
            dot.style.transformOrigin = `${cx}px ${cy}px`;
            dot.style.transform = `scale(${(0.7 + 0.3 * pEase).toFixed(2)})`;
        }
        if (line) {
            line.style.opacity = String(pEase);
        }
    }
}

function paintLoopingIcons(nodes: OverlayNodeSource, t: number): void {
    const chevron = styled(nodes, "mapChevron");
    if (chevron) {
        chevron.style.transform = `translateY(${-1.5 + 1.5 * Math.cos((t * Math.PI * 2) / 1.8)}px)`;
    }
    const star = styled(nodes, "starIcon");
    if (star) {
        star.style.transform = `scale(${1.075 - 0.075 * Math.cos((t * Math.PI * 2) / 2.5)})`;
    }
}

function setYearsOpacity(nodes: OverlayNodeSource, progress: number): void {
    const group = nodes.get("chartYearsGroup");
    if (!group || typeof group.querySelectorAll !== "function") return;
    const labels = group.querySelectorAll(".chart-label-x");
    labels.forEach((node, idx) => {
        const threshold = idx * 0.08;
        const p = Math.min(1, Math.max(0, (progress - threshold) / 0.35));
        (node as HTMLElement).style.opacity = String(p);
    });
}

export function seekOverlay(t: number, nodes: OverlayNodeSource, data: OverlayData): void {
    paintLoopingIcons(nodes, t);

    const widget = styled(nodes, "widget");
    const topCard = styled(nodes, "topCard");
    const bottomCard = styled(nodes, "bottomCard");
    const lipShine = styled(nodes, "lipShine");
    const playerHeaderLeft = styled(nodes, "playerHeaderLeft");
    const playerHeaderRight = styled(nodes, "playerHeaderRight");
    const pHours = nodes.get("pHours");
    const pPlaycount = nodes.get("pPlaycount");
    const fillAr = styled(nodes, "fillAr");
    const fillCs = styled(nodes, "fillCs");
    const fillOd = styled(nodes, "fillOd");
    const fillHp = styled(nodes, "fillHp");
    if (lipShine) lipShine.style.opacity = "0";

    // =========================================================================
    // 1. OPENING SEQUENCE (0.0s - 0.50s)
    // Container A enters first (0.0s - 0.35s): subtle scale 97% -> 100%, fade-in,
    // outward slide (left elements -5px -> 0px, right elements +5px -> 0px).
    // Container B enters with +100ms delay (0.10s - 0.45s): vertical clip-path reveal downwards,
    // line draws quickly along x-axis, year labels fade in sequentially.
    // =========================================================================
    if (t < 0.50) {
        const stageOpacity = Math.min(1, Math.max(0, t / 0.08));
        if (widget) {
            widget.style.opacity = String(stageOpacity);
            widget.style.transform = "scale(1)";
        }

        // Container A (Profile Header) - 350ms duration
        const pA = easeMotionDecel(Math.min(1, Math.max(0, t / 0.35)));
        if (topCard) {
            topCard.style.opacity = String(pA);
            topCard.style.transform = `scale(${(0.97 + 0.03 * pA).toFixed(4)})`;
        }
        if (playerHeaderLeft) {
            playerHeaderLeft.style.transform = `translateX(${(-5 * (1 - pA)).toFixed(2)}px)`;
        }
        if (playerHeaderRight) {
            playerHeaderRight.style.transform = `translateX(${(5 * (1 - pA)).toFixed(2)}px)`;
        }
        paintLayer(nodes, "topPlayer", pA);
        paintLayer(nodes, "topMap", 0);
        setBanners(nodes, data, 0.55 * pA, 0);

        // Container B (Graph Panel) - Delayed entrance (+100ms delay, 350ms duration)
        if (t < 0.10) {
            if (bottomCard) {
                bottomCard.style.clipPath = "inset(0 0 100% 0 round 14px)";
                bottomCard.style.opacity = "0";
                bottomCard.style.transform = "scale(1)";
            }
            paintLayer(nodes, "bottomPlayer", 0);
            hidePath(nodes, "svgPlayerPath");
            paintPeak(nodes, 0);
            setYearsOpacity(nodes, 0);
            setCounter(pHours, 0);
            setCounter(pPlaycount, 0);
        } else {
            const pB = easeMotionDecel(Math.min(1, Math.max(0, (t - 0.10) / 0.35)));
            const curtainPercent = Math.max(0, (1 - pB) * 100).toFixed(1);
            if (bottomCard) {
                bottomCard.style.clipPath = `inset(0 0 ${curtainPercent}% 0 round 14px)`;
                bottomCard.style.opacity = String(pB);
                bottomCard.style.transform = "scale(1)";
            }
            paintLayer(nodes, "bottomPlayer", pB);

            // Graph line starts completely blank until curtain opens at t = 0.25s,
            // then smoothly draws from 0% all the way to 100% (NO snap-back or resets)
            if (t < 0.25) {
                hidePath(nodes, "svgPlayerPath");
                paintPeak(nodes, 0);
                setYearsOpacity(nodes, 0);
                setCounter(pHours, 0);
                setCounter(pPlaycount, 0);
            } else {
                const lineProgress = easeMotionDecel(Math.min(1, Math.max(0, (t - 0.25) / 1.35)));
                drawPath(nodes, "svgPlayerPath", lineProgress);
                paintPeak(nodes, lineProgress);

                // Year labels fade in sequentially along bottom
                const yearProgress = Math.min(1, Math.max(0, (t - 0.20) / 0.35));
                setYearsOpacity(nodes, yearProgress);

                // Numbers count up in tandem
                const countProgress = easeMotionDecel(Math.min(1, Math.max(0, (t - 0.25) / 1.20)));
                setCounter(pHours, Math.round(data.player.hours * countProgress));
                setCounter(pPlaycount, Math.round(data.player.playcount * countProgress));
            }
        }

        paintLayer(nodes, "bottomMap", 0);
        paintLayer(nodes, "starFooter", 0);
        clearMapSide(nodes);
    }
    // =========================================================================
    // 2. SCREEN A ACTIVE & STABLE DISPLAY (0.50s - 2.30s)
    // Stable presentation with completed counters, full spline, and visible badges.
    // =========================================================================
    else if (t < 2.30) {
        if (widget) {
            widget.style.opacity = "1";
            widget.style.transform = "scale(1)";
        }
        if (topCard) {
            topCard.style.opacity = "1";
            topCard.style.transform = "scale(1)";
            topCard.style.boxShadow = "";
        }
        if (bottomCard) {
            bottomCard.style.clipPath = "";
            bottomCard.style.opacity = "1";
            bottomCard.style.transform = "scale(1)";
            bottomCard.style.boxShadow = "";
        }
        if (playerHeaderLeft) playerHeaderLeft.style.transform = "translateX(0)";
        if (playerHeaderRight) playerHeaderRight.style.transform = "translateX(0)";

        paintLayer(nodes, "topPlayer", 1);
        paintLayer(nodes, "bottomPlayer", 1);
        paintLayer(nodes, "topMap", 0);
        paintLayer(nodes, "bottomMap", 0);
        paintLayer(nodes, "starFooter", 0);

        setBanners(nodes, data, 0.55, 0);

        // Graph line smoothly completes the full graph line from 0% to 100%
        const lineDrawP = Math.min(1, Math.max(0, (t - 0.25) / 1.35));
        const lineEase = easeMotionDecel(lineDrawP);
        drawPath(nodes, "svgPlayerPath", lineEase);
        paintPeak(nodes, lineEase);
        setYearsOpacity(nodes, 1);

        const countProgress = Math.min(1, Math.max(0, (t - 0.25) / 1.20));
        const countEase = easeMotionDecel(countProgress);
        setCounter(pHours, Math.round(data.player.hours * countEase));
        setCounter(pPlaycount, Math.round(data.player.playcount * countEase));
        clearMapSide(nodes);
    }
    // =========================================================================
    // 3. SCREEN-TO-SCREEN DYNAMIC TRANSITION (2.30s - 3.06s)
    // Broadcast-grade transition sequence:
    // - Kinetic depth pulse (elastic micro-compression 1.0 -> 0.988 -> 1.0)
    // - Holographic light blade sweeps across both cards (headerShine, bottomShine & lipShine)
    // - Radiant accent border glow pulse
    // - Screen A slides left and fades out (t = 2.30s - 2.72s)
    // - Screen B slides in from right smoothly (t = 2.65s - 3.12s)
    // - Seamless dual-banner crossfade with ZERO black flash or blinking
    // =========================================================================
    else if (t < 3.06) {
        if (widget) {
            widget.style.opacity = "1";
            widget.style.transform = "scale(1)";
        }

        // Kinetic depth pulse: subtle elastic micro-compression (1.0 -> 0.988 -> 1.0)
        const squeezeP = Math.sin(Math.min(1, Math.max(0, (t - 2.30) / 0.65)) * Math.PI);
        const cardScale = (1 - 0.012 * easeMotionDecel(squeezeP)).toFixed(4);
        const glowP = Math.sin(Math.min(1, Math.max(0, (t - 2.35) / 0.50)) * Math.PI);
        const innerGlow = (0.35 + 0.35 * glowP).toFixed(2);
        const shineP = Math.min(1, Math.max(0, (t - 2.30) / 0.76));
        if (lipShine) {
            lipShine.style.opacity = String(Math.sin(Math.PI * shineP) * 0.9);
            lipShine.style.transform = `translateX(${(-120 + shineP * 520).toFixed(1)}%) skewX(-18deg)`;
        }
        if (topCard) {
            topCard.style.opacity = "1";
            topCard.style.transform = `scale(${cardScale})`;
            topCard.style.boxShadow = `0 12px 18px -8px rgba(0, 0, 0, 0.88), inset 0 1px 1.5px rgba(255, 255, 255, ${innerGlow})`;
        }
        if (bottomCard) {
            bottomCard.style.clipPath = "";
            bottomCard.style.opacity = "1";
            bottomCard.style.transform = `scale(${cardScale})`;
            bottomCard.style.boxShadow = `0 12px 18px -8px rgba(0, 0, 0, 0.88), inset 0 1px 1.5px rgba(255, 255, 255, ${innerGlow})`;
        }

        // Screen A exits: slides left (-22px) and fades out smoothly
        const outP = Math.min(1, Math.max(0, (t - 2.30) / 0.42));
        const outDecel = easeMotionDecel(outP);
        const screenAOpacity = Math.max(0, 1 - outP);
        const slideLeft = -22 * outDecel;
        paintLayer(nodes, "topPlayer", screenAOpacity, slideLeft);
        paintLayer(nodes, "bottomPlayer", screenAOpacity, slideLeft);

        // Screen B enters: slides in from right (+22px -> 0) with snappy deceleration
        let screenBOpacity = 0;
        let slideInRight = 22;
        if (t >= 2.65) {
            const inP = Math.min(1, Math.max(0, (t - 2.65) / 0.47));
            const inDecel = easeMotionDecel(inP);
            screenBOpacity = inDecel;
            slideInRight = 22 * (1 - inDecel);
        }
        paintLayer(nodes, "topMap", screenBOpacity, slideInRight);
        paintLayer(nodes, "bottomMap", 0);
        paintLayer(nodes, "starFooter", 0);

        // Smooth continuous dual-banner crossfade (no "none" flash)
        const bannerCrossP = Math.min(1, Math.max(0, (t - 2.45) / 0.35));
        const bannerCrossDecel = easeMotionDecel(bannerCrossP);
        const playerBannerOpacity = 0.55 * (1 - bannerCrossDecel);
        const mapBannerOpacity = 0.55 * bannerCrossDecel;
        setBanners(nodes, data, playerBannerOpacity, mapBannerOpacity);

        clearMapSide(nodes);
    }
    // =========================================================================
    // 4. SCREEN B ACTIVE & STABLE DISPLAY (3.06s - 4.70s)
    // Screen B elements settle and animate:
    // - topMap remains 100% visible and stable with ZERO blinking
    // - bottomMap and starFooter glide in simultaneously (t = 3.06s - 3.34s)
    // - Stat bars fill sequentially (AR -> CS -> OD -> HP)
    // - 30-day activity wave curve draws smoothly
    // =========================================================================
    else if (t < 4.70) {
        if (widget) {
            widget.style.opacity = "1";
            widget.style.transform = "scale(1)";
        }
        if (topCard) {
            topCard.style.opacity = "1";
            topCard.style.transform = "scale(1)";
            topCard.style.boxShadow = "";
        }
        if (bottomCard) {
            bottomCard.style.clipPath = "";
            bottomCard.style.opacity = "1";
            bottomCard.style.transform = "scale(1)";
            bottomCard.style.boxShadow = "";
        }
        if (playerHeaderLeft) playerHeaderLeft.style.transform = "translateX(0)";
        if (playerHeaderRight) playerHeaderRight.style.transform = "translateX(0)";

        paintLayer(nodes, "topPlayer", 0);
        paintLayer(nodes, "bottomPlayer", 0);

        // topMap is fully landed and remains completely solid and visible (NO BLINKING)
        paintLayer(nodes, "topMap", 1, 0);

        // bottomMap and starFooter glide in together
        const detailsP = Math.min(1, Math.max(0, (t - 3.06) / 0.28));
        const detailsEase = easeMotionDecel(detailsP);
        paintLayer(nodes, "bottomMap", detailsEase);
        paintLayer(nodes, "starFooter", detailsEase, 0, (1 - detailsEase) * 6);

        setBanners(nodes, data, 0, 0.55);

        // Stat bars fill sequentially with clean stagger: AR -> CS -> OD -> HP
        const arP = easeOutCubic(Math.min(1, Math.max(0, (t - 2.94) / 0.85)));
        const csP = easeOutCubic(Math.min(1, Math.max(0, (t - 3.00) / 0.85)));
        const odP = easeOutCubic(Math.min(1, Math.max(0, (t - 3.06) / 0.85)));
        const hpP = easeOutCubic(Math.min(1, Math.max(0, (t - 3.12) / 0.85)));

        if (fillAr) fillAr.style.width = `${arP * Math.min(100, (data.map.ar / 11) * 100)}%`;
        if (fillCs) fillCs.style.width = `${csP * Math.min(100, (data.map.cs / 10) * 100)}%`;
        if (fillOd) fillOd.style.width = `${odP * Math.min(100, (data.map.od / 11) * 100)}%`;
        if (fillHp) fillHp.style.width = `${hpP * Math.min(100, (data.map.hp / 10) * 100)}%`;

        const mapLineP = easeOutCubic(Math.min(1, Math.max(0, (t - 3.06) / 0.90)));
        drawPath(nodes, "svgMapPath", mapLineP);

        const countP = easeOutCubic(Math.min(1, Math.max(0, (t - 2.94) / 0.85)));
        setCounter(nodes.get("mFavs"), Math.round(parseCount(data.map.favs) * countP));
        setCounter(nodes.get("mPlays"), Math.round(parseCount(data.map.plays) * countP));
    }
    // =========================================================================
    // 5. CLOSING ANIMATION SEQUENCE (4.70s - 5.40s)
    // Reverse staggered entry: elements collapse inward toward origin,
    // internal elements fade out slightly faster than containers,
    // final subtle scale down (100% to 98%) combined with a 200ms fade-out (5.20s - 5.40s)
    // for the entire display group.
    // =========================================================================
    else {
        const pClose = (t - 4.70) / 0.70;
        const pCloseDecel = easeMotionDecel(Math.min(1, Math.max(0, pClose)));

        // Internal elements fade out slightly faster than main containers
        const internalFade = Math.max(0, 1 - pClose * 1.5);
        // Elements collapse inward toward their origin
        const collapseInwardLeft = 6 * pCloseDecel;
        const collapseInwardRight = -6 * pCloseDecel;

        paintLayer(nodes, "topPlayer", 0);
        paintLayer(nodes, "bottomPlayer", 0);
        paintLayer(nodes, "topMap", internalFade, collapseInwardLeft);
        paintLayer(nodes, "bottomMap", internalFade, 0, 4 * pCloseDecel);
        paintLayer(nodes, "starFooter", Math.max(0, 1 - pClose * 1.4), 0, 8 * pCloseDecel);

        // Final subtle scale down (100% to 98%)
        const currentScale = (1 - 0.02 * pCloseDecel).toFixed(4);

        // 200ms fade-out for entire display group at the end (from 5.20s to 5.40s)
        let groupOpacity = 1;
        if (t >= 5.20) {
            groupOpacity = Math.max(0, 1 - (t - 5.20) / 0.20);
        } else {
            groupOpacity = Math.max(0, 1 - (pClose - 0.3) * 0.7);
        }

        if (widget) {
            widget.style.transform = `scale(${currentScale})`;
            widget.style.opacity = String(groupOpacity);
        }

        if (fillAr) fillAr.style.width = `${Math.min(100, (data.map.ar / 11) * 100)}%`;
        if (fillCs) fillCs.style.width = `${Math.min(100, (data.map.cs / 10) * 100)}%`;
        if (fillOd) fillOd.style.width = `${Math.min(100, (data.map.od / 11) * 100)}%`;
        if (fillHp) fillHp.style.width = `${Math.min(100, (data.map.hp / 10) * 100)}%`;
        drawPath(nodes, "svgMapPath", 1);
        setCounter(nodes.get("mFavs"), parseCount(data.map.favs));
        setCounter(nodes.get("mPlays"), parseCount(data.map.plays));
    }
}

export const SHOWCASE_INTRO_TOTAL_CYCLE = 5.4;

export interface ShowcaseNodeSource {
    get(name: ShowcaseNode): Element | null;
}

export function seekShowcaseIntro(t: number, nodes: ShowcaseNodeSource): void {
    const topBar = nodes.get("topBar") as HTMLElement | null;
    const lensWrap = nodes.get("lensWrap") as HTMLElement | null;
    const gradeRank = nodes.get("gradeRank") as HTMLElement | null;
    const leftFlyout = nodes.get("leftFlyout") as HTMLElement | null;
    const rightFlyout = nodes.get("rightFlyout") as HTMLElement | null;
    const bottomTime = nodes.get("bottomTime") as HTMLElement | null;
    const container = nodes.get("container") as HTMLElement | null;

    // Phase 1: Top bar animation (0.0s -> 0.7s)
    if (topBar) {
        if (t <= 0) {
            topBar.style.transform = "translateY(-24px)";
            topBar.style.opacity = "0";
        } else if (t < 0.7) {
            const p = easeMotionDecel(t / 0.7);
            topBar.style.transform = `translateY(${-24 * (1 - p)}px)`;
            topBar.style.opacity = String(p);
        } else {
            topBar.style.transform = "translateY(0)";
            topBar.style.opacity = "1";
        }
    }

    // Phase 2: Center Circular Lens rises from bottom (0.15s -> 1.15s)
    if (lensWrap) {
        if (t < 0.15) {
            lensWrap.style.transform = "translate(-50%, calc(-50% + 240px)) scale(0.4)";
            lensWrap.style.opacity = "0";
        } else if (t < 1.15) {
            const p = easeMotionDecel((t - 0.15) / 1.0);
            const dy = 240 * (1 - p);
            const scale = 0.4 + 0.6 * p;
            lensWrap.style.transform = `translate(-50%, calc(-50% + ${dy.toFixed(1)}px)) scale(${scale.toFixed(3)})`;
            lensWrap.style.opacity = String(Math.min(1, p * 3));
        } else {
            lensWrap.style.transform = "translate(-50%, -50%) scale(1)";
            lensWrap.style.opacity = "1";
        }
    }

    // Phase 3: Big Grade Rank letter pops inside lens (0.75s -> 1.55s)
    if (gradeRank) {
        if (t < 0.75) {
            gradeRank.style.transform = "translateY(-4px) scale(0.65)";
            gradeRank.style.opacity = "0";
        } else if (t < 1.55) {
            const p = easeMotionDecel((t - 0.75) / 0.8);
            const scale = 0.65 + 0.35 * p;
            gradeRank.style.transform = `translateY(-4px) scale(${scale.toFixed(3)})`;
            gradeRank.style.opacity = String(p);
        } else {
            gradeRank.style.transform = "translateY(-4px) scale(1)";
            gradeRank.style.opacity = "1";
        }
    }

    // Phase 4: Left flyout stats slide out to the left (1.10s -> 2.10s)
    if (leftFlyout) {
        if (t < 1.10) {
            leftFlyout.style.transform = "translateX(90px)";
            leftFlyout.style.opacity = "0";
        } else if (t < 2.10) {
            const p = easeMotionDecel((t - 1.10) / 1.0);
            const dx = 90 * (1 - p);
            leftFlyout.style.transform = `translateX(${dx.toFixed(1)}px)`;
            leftFlyout.style.opacity = String(p);
        } else {
            leftFlyout.style.transform = "translateX(0)";
            leftFlyout.style.opacity = "1";
        }
    }

    // Phase 5: Right flyout stats slide out to the right (1.15s -> 2.15s)
    if (rightFlyout) {
        if (t < 1.15) {
            rightFlyout.style.transform = "translateX(-90px)";
            rightFlyout.style.opacity = "0";
        } else if (t < 2.15) {
            const p = easeMotionDecel((t - 1.15) / 1.0);
            const dx = -90 * (1 - p);
            rightFlyout.style.transform = `translateX(${dx.toFixed(1)}px)`;
            rightFlyout.style.opacity = String(p);
        } else {
            rightFlyout.style.transform = "translateX(0)";
            rightFlyout.style.opacity = "1";
        }
    }

    // Phase 6: Bottom relative time fades in (1.80s -> 2.50s)
    if (bottomTime) {
        if (t < 1.80) {
            bottomTime.style.opacity = "0";
        } else if (t < 2.50) {
            const p = (t - 1.80) / 0.70;
            bottomTime.style.opacity = String(Math.min(1, Math.max(0, p)));
        } else {
            bottomTime.style.opacity = "1";
        }
    }

    // Outro fade / loop reset (5.10s -> 5.40s)
    if (container) {
        if (t >= 5.10) {
            const pOut = (t - 5.10) / 0.30;
            container.style.opacity = String(Math.max(0, 1 - pOut));
        } else {
            container.style.opacity = "1";
        }
    }
}



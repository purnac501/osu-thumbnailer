import type { OverlayData } from "./types";
import type { OverlayNode } from "./OverlayWidget";
export interface OverlayNodeSource {
    get(name: OverlayNode): Element | null;
}
export const OVERLAY_TOTAL_CYCLE = 5.4;
const easeOutCubic = (x: number): number => 1 - Math.pow(1 - x, 3);
const easeInOutCubic = (x: number): number => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const smoothstep = (x: number): number => {
    const t = Math.min(1, Math.max(0, x));
    return t * t * (3 - 2 * t);
};
function styled(nodes: OverlayNodeSource, name: OverlayNode): HTMLElement | SVGElement | null {
    return nodes.get(name) as HTMLElement | SVGElement | null;
}
function paintLayer(nodes: OverlayNodeSource, name: OverlayNode, progress: number, distance: number): void {
    const el = styled(nodes, name);
    if (!el)
        return;
    const p = smoothstep(progress);
    el.classList.toggle("visible", p > 0);
    el.style.opacity = String(p);
    el.style.transform = `translateY(${distance * (1 - p)}px)`;
}
function paintWidget(nodes: OverlayNodeSource, opacity: string, transform: string): void {
    const widget = styled(nodes, "widget");
    if (widget) {
        widget.style.opacity = opacity;
        widget.style.transform = transform;
    }
}
function setBanner(nodes: OverlayNodeSource, image: string): void {
    const topBanner = styled(nodes, "topBanner") as HTMLElement | null;
    if (topBanner)
        topBanner.style.backgroundImage = image;
}
function setCounter(node: Element | null, value: number): void {
    if (node)
        node.textContent = value.toLocaleString();
}
const dashLengths = new WeakMap<Element, { d: string | null; length: number }>();
function measuredDash(el: Element): number {
    const current = typeof el.getAttribute === "function" ? el.getAttribute("d") : null;
    const known = dashLengths.get(el);
    if (known && known.d === current)
        return known.length;
    let length = 1200;
    try {
        const measured = (el as unknown as SVGPathElement).getTotalLength?.();
        if (typeof measured === "number" && measured > 0)
            length = measured;
    }
    catch {
    }
    dashLengths.set(el, { d: current, length });
    return length;
}
function hidePath(nodes: OverlayNodeSource, name: OverlayNode): void {
    const el = styled(nodes, name);
    if (!el)
        return;
    const length = measuredDash(el);
    el.style.strokeDasharray = String(length);
    el.style.strokeDashoffset = String(length);
}
function drawPath(nodes: OverlayNodeSource, name: OverlayNode, progress: number): void {
    const el = styled(nodes, name);
    if (!el)
        return;
    const length = measuredDash(el);
    el.style.strokeDasharray = String(length);
    el.style.strokeDashoffset = String(Math.round(length * (1 - progress)));
}
function clearMapSide(nodes: OverlayNodeSource): void {
    const fills: OverlayNode[] = ["fillAr", "fillCs", "fillOd", "fillHp"];
    for (const name of fills) {
        const el = styled(nodes, name);
        if (el)
            el.style.width = "0%";
    }
    hidePath(nodes, "svgMapPath");
    const shine = styled(nodes, "lipShine");
    if (shine) {
        shine.style.transform = "skewX(-25deg) translateX(-100px)";
        shine.style.opacity = "0";
    }
    const favs = nodes.get("mFavs");
    if (favs)
        favs.textContent = "0";
    const plays = nodes.get("mPlays");
    if (plays)
        plays.textContent = "0";
}
function parseCount(value: string): number {
    return Number(value.replace(/[^0-9]/g, "")) || 0;
}
function paintViews(nodes: OverlayNodeSource, player: number, map: number, star: number): void {
    paintLayer(nodes, "topPlayer", player, 6);
    paintLayer(nodes, "bottomPlayer", player, 8);
    paintLayer(nodes, "topMap", map, 6);
    paintLayer(nodes, "bottomMap", map, 8);
    paintLayer(nodes, "starFooter", star, 6);
}
function paintLoopingIcons(nodes: OverlayNodeSource, t: number): void {
    const chevron = styled(nodes, "mapChevron");
    if (chevron)
        chevron.style.transform = `translateY(${-1.5 + 1.5 * Math.cos((t * Math.PI * 2) / 1.8)}px)`;
    const star = styled(nodes, "starIcon");
    if (star)
        star.style.transform = `scale(${1.075 - 0.075 * Math.cos((t * Math.PI * 2) / 2.5)})`;
}
const easeOutBack = (x: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
export function seekOverlay(t: number, nodes: OverlayNodeSource, data: OverlayData): void {
    paintLoopingIcons(nodes, t);
    const lipShine = styled(nodes, "lipShine");
    const pHours = nodes.get("pHours");
    const pPlaycount = nodes.get("pPlaycount");
    const fillAr = styled(nodes, "fillAr");
    const fillCs = styled(nodes, "fillCs");
    const fillOd = styled(nodes, "fillOd");
    const fillHp = styled(nodes, "fillHp");
    if (t < 0.42) {
        const p = Math.min(1, Math.max(0, t / 0.42));
        const eased = easeOutBack(p);
        paintWidget(nodes, String(Math.min(1, p * 1.8)), `perspective(1000px) translateY(${Math.round(24 * (1 - p))}px) scale(${0.86 + 0.14 * p}) scaleY(${0.08 + 0.92 * eased})`);
        paintViews(nodes, (p - 0.2) / 0.55, 0, 0);
        setBanner(nodes, `url("${data.player.banner}")`);
        hidePath(nodes, "svgPlayerPath");
        setCounter(pHours, 0);
        setCounter(pPlaycount, 0);
        clearMapSide(nodes);
    }
    else if (t < 2.28) {
        paintWidget(nodes, "1", "perspective(1000px) translateY(0) scale(1) scaleY(1)");
        paintViews(nodes, 1, 0, 0);
        setBanner(nodes, `url("${data.player.banner}")`);
        const lineDrawP = Math.min(1, Math.max(0, (t - 0.42) / 1.2));
        const lineEase = 1 - Math.pow(1 - lineDrawP, 3);
        drawPath(nodes, "svgPlayerPath", lineEase);
        const numP = Math.min(1, Math.max(0, (t - 0.42) / 1.08));
        const numEase = 1 - Math.pow(1 - numP, 3);
        setCounter(pHours, Math.round(data.player.hours * numEase));
        setCounter(pPlaycount, Math.round(data.player.playcount * numEase));
        clearMapSide(nodes);
    }
    else if (t < 2.88) {
        const p = (t - 2.28) / 0.6;
        paintViews(nodes, 1 - p, 0, 0);
        setBanner(nodes, "none");
        const settle = easeInOutCubic(p);
        paintWidget(nodes, "1", `perspective(1000px) translateY(0) scale(${1 - 0.06 * settle}) scaleY(1)`);
        clearMapSide(nodes);
        if (lipShine) {
            if (p > 0.12 && p < 0.88) {
                const sp = smoothstep((p - 0.12) / 0.76);
                lipShine.style.transform = `skewX(-25deg) translateX(${sp * 520}px)`;
                lipShine.style.opacity = String(Math.sin(sp * Math.PI));
            }
            else {
                lipShine.style.transform = "skewX(-25deg) translateX(-100px)";
                lipShine.style.opacity = "0";
            }
        }
    }
    else if (t < 4.74) {
        const grow = easeOutCubic(Math.min(1, Math.max(0, (t - 2.88) / 0.36)));
        paintWidget(nodes, "1", `perspective(1000px) translateY(0) scale(${0.94 + 0.06 * grow}) scaleY(1)`);
        paintLayer(nodes, "topPlayer", 0, 6);
        paintLayer(nodes, "bottomPlayer", 0, 8);
        paintLayer(nodes, "topMap", (t - 2.88) / 0.3, 6);
        paintLayer(nodes, "bottomMap", (t - 3.06) / 0.3, 8);
        paintLayer(nodes, "starFooter", (t - 3.9) / 0.3, 6);
        setBanner(nodes, `url("${data.map.cover}")`);
        const arP = easeOutCubic(Math.min(1, Math.max(0, (t - 2.94) / 1.08)));
        const csP = easeOutCubic(Math.min(1, Math.max(0, (t - 3.0) / 1.08)));
        const odP = easeOutCubic(Math.min(1, Math.max(0, (t - 3.06) / 1.08)));
        const hpP = easeOutCubic(Math.min(1, Math.max(0, (t - 3.12) / 1.08)));
        if (fillAr)
            fillAr.style.width = `${arP * Math.min(100, (data.map.ar / 11) * 100)}%`;
        if (fillCs)
            fillCs.style.width = `${csP * Math.min(100, (data.map.cs / 10) * 100)}%`;
        if (fillOd)
            fillOd.style.width = `${odP * Math.min(100, (data.map.od / 11) * 100)}%`;
        if (fillHp)
            fillHp.style.width = `${hpP * Math.min(100, (data.map.hp / 10) * 100)}%`;
        const mapLineP = easeOutCubic(Math.min(1, Math.max(0, (t - 2.94) / 1.2)));
        drawPath(nodes, "svgMapPath", mapLineP);
        const countP = easeOutCubic(Math.min(1, Math.max(0, (t - 2.94) / 1.08)));
        setCounter(nodes.get("mFavs"), Math.round(parseCount(data.map.favs) * countP));
        setCounter(nodes.get("mPlays"), Math.round(parseCount(data.map.plays) * countP));
        if (lipShine) {
            lipShine.style.transform = "skewX(-25deg) translateX(-100px)";
            lipShine.style.opacity = "0";
        }
    }
    else {
        const p = Math.min(1, Math.max(0, (t - 4.74) / 0.66));
        paintWidget(nodes, String(Math.max(0, 1 - p * 1.3)), `perspective(1000px) translateY(${Math.round(22 * p)}px) scale(${1 - 0.12 * p}) scaleY(${Math.max(0.05, 1 - 0.95 * p)})`);
        paintViews(nodes, 0, 1 - p, 1 - p);
        clearMapSide(nodes);
    }
}

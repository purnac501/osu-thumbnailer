import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Flex, SegmentedControl, Switch, TextField } from "@radix-ui/themes";
import { DownloadIcon, PlayIcon } from "@radix-ui/react-icons";
import "./overlay.css";
import "./animation-tab.css";
import { DEFAULT_OVERLAY_DATA, type OverlayData } from "./types";
import { animationExportFileName, buildAnimationExportStartPath, type AnimationExportFormat, type AnimationExportPreset, } from "../../shared/animation-export";
import { OVERLAY_THEMES, applyOverlayPalette, customAccentPalette, type OverlayThemeId } from "./themes";
import { buildPlaycountSpline } from "./spline";
import { OVERLAY_TOTAL_CYCLE, seekOverlay } from "./timeline";
import { OverlayWidget, type OverlayNode, type OverlayRefSetter } from "./OverlayWidget";
import { AccentPicker } from "../AccentPicker";
import { ZoomableStage } from "../CanvasView";
import { parseScoreUrl } from "../../shared/score-url/parseScoreUrl";
declare global {
    interface Window {
        seekAnimation?: (t: number) => void;
        triggerSequence?: () => void;
        switchPhase?: (phase: number) => void;
        stopLiveLoop?: () => void;
        loadDataFromUrlPromise?: Promise<unknown> | null;
        waitForAllAssetsReady?: () => Promise<void>;
    }
}
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const overlayCache = new Map<string, OverlayData>();
function cacheOverlay(url: string, value: OverlayData): void {
    if (overlayCache.size >= 10) {
        const oldest = overlayCache.keys().next();
        if (!oldest.done)
            overlayCache.delete(oldest.value);
    }
    overlayCache.set(url, value);
}
export interface AnimationApi {
    download: (format: AnimationExportFormat, preset?: AnimationExportPreset) => void;
    canDownload: boolean;
}
export function AnimationTab({ exportMode = false, theme, onThemeChange, scoreUrl, onScoreUrlChange, onReady, }: {
    exportMode?: boolean;
    theme: OverlayThemeId;
    onThemeChange: (theme: OverlayThemeId) => void;
    scoreUrl: string;
    onScoreUrlChange: (url: string) => void;
    onReady?: (api: AnimationApi) => void;
}) {
    const [data, setData] = useState<OverlayData>(DEFAULT_OVERLAY_DATA);
    const [accent, setAccent] = useState(OVERLAY_THEMES.gray!.accent);
    const [loop, setLoop] = useState(true);
    const [busy, setBusy] = useState(false);
    const [fetchMsg, setFetchMsg] = useState<string | null>(null);
    const [hasData, setHasData] = useState(true);
    const [downloadReady, setDownloadReady] = useState<{ url: string; filename: string; label: string } | null>(null);
    const [exportQuery] = useState(() => exportMode && typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : null);
    const exportFormat = exportQuery?.get("format") ?? null;
    const exportTransparent = (exportQuery?.get("bg") ?? "transparent") !== "dark";
    const nodes = useRef(new Map<OverlayNode, Element>());
    const dataRef = useRef(data);
    dataRef.current = data;
    const loopRef = useRef(loop);
    loopRef.current = loop;
    const raf = useRef<number | null>(null);
    const start = useRef<number | null>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const setRef: OverlayRefSetter = useCallback((name) => (el) => {
        if (el)
            nodes.current.set(name, el);
        else
            nodes.current.delete(name);
    }, []);
    const source = useMemo(() => ({ get: (name: OverlayNode) => nodes.current.get(name) ?? null }), []);
    const spline = useMemo(() => buildPlaycountSpline(data.player.monthlyPlaycounts), [data.player.monthlyPlaycounts]);
    const stopLiveLoop = useCallback(() => {
        if (raf.current !== null) {
            cancelAnimationFrame(raf.current);
            raf.current = null;
        }
        start.current = null;
    }, []);
    const [phase, setPhase] = useState<"player" | "map">("player");
    const phaseRef = useRef(phase);
    phaseRef.current = phase;
    const range = useRef({ start: 0, end: OVERLAY_TOTAL_CYCLE });
    const replay = useCallback(() => {
        stopLiveLoop();
        const selected = phaseRef.current;
        range.current = {
            start: selected === "map" ? 2.88 : 0,
            end: loopRef.current ? OVERLAY_TOTAL_CYCLE : selected === "map" ? 4.74 : 2.28,
        };
        start.current = performance.now();
        const step = (now: number) => {
            const t = range.current.start + (now - (start.current ?? now)) / 1000;
            if (t >= range.current.end) {
                if (loopRef.current) {
                    range.current = { start: 0, end: OVERLAY_TOTAL_CYCLE };
                    start.current = now;
                    seekOverlay(0, source, dataRef.current);
                    raf.current = requestAnimationFrame(step);
                }
                else {
                    seekOverlay(range.current.end, source, dataRef.current);
                    stopLiveLoop();
                }
                return;
            }
            seekOverlay(t, source, dataRef.current);
            raf.current = requestAnimationFrame(step);
        };
        raf.current = requestAnimationFrame(step);
    }, [source, stopLiveLoop]);
    const selectPhase = useCallback((next: "player" | "map") => {
        setPhase(next);
        stopLiveLoop();
        const widget = nodes.current.get("widget") as HTMLElement | undefined;
        if (widget) {
            widget.style.opacity = "1";
            widget.style.transform = "perspective(1000px) translateY(0) scale(1) scaleY(1)";
        }
        seekOverlay(next === "map" ? 3.8 : 1.3, source, dataRef.current);
    }, [source, stopLiveLoop]);
    const onLoopChange = useCallback((checked: boolean) => {
        setLoop(checked);
        loopRef.current = checked;
        if (checked && raf.current === null)
            replay();
    }, [replay]);
    const fetchData = useCallback(async (url: string) => {
        const clean = url.trim();
        if (!clean)
            return;
        if (!parseScoreUrl(clean)) {
            setFetchMsg("That is not a score link. Paste one like https://osu.ppy.sh/scores/1234567890");
            return;
        }
        const cached = overlayCache.get(clean);
        if (cached) {
            setData(cached);
            setHasData(true);
            setFetchMsg("Synced!");
            replay();
            return;
        }
        setBusy(true);
        setFetchMsg("Fetching...");
        try {
            const pending = fetch(`${API_BASE}/api/overlay-data?url=${encodeURIComponent(clean)}`).then((r) => r.json());
            window.loadDataFromUrlPromise = pending;
            const json = (await pending) as {
                data?: OverlayData;
            };
            if (!json.data)
                throw new Error("No data returned");
            cacheOverlay(clean, json.data);
            setData(json.data);
            setHasData(true);
            await window.waitForAllAssetsReady?.();
            setFetchMsg("Synced!");
            replay();
        }
        catch (err) {
            setFetchMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
        }
        finally {
            setBusy(false);
        }
    }, [replay]);
    useEffect(() => {
        if (theme === "custom") {
            const p = customAccentPalette(accent);
            applyOverlayPalette(p.accent, p.top, p.bottom, p.lip);
        }
        else {
            const t = OVERLAY_THEMES[theme] ?? OVERLAY_THEMES.gray!;
            setAccent(t.accent);
            applyOverlayPalette(t.accent, t.top, t.bottom, t.lip);
        }
    }, [theme]);
    const onAccentInput = (color: string) => {
        setAccent(color);
        onThemeChange("custom");
        const p = customAccentPalette(color);
        applyOverlayPalette(p.accent, p.top, p.bottom, p.lip);
    };
    useEffect(() => {
        const rootEl = document.documentElement;
        const prevScheme = rootEl.style.colorScheme;
        const prevBodyBg = document.body.style.backgroundColor;
        const themeRoot = document.querySelector("#root > div") as HTMLElement | null;
        const prevThemeBg = themeRoot?.style.backgroundColor ?? "";
        if (exportMode && exportTransparent) {
            rootEl.style.colorScheme = "light";
            document.body.style.backgroundColor = "transparent";
            if (themeRoot)
                themeRoot.style.backgroundColor = "transparent";
        }
        window.waitForAllAssetsReady = async () => {
            const root = stageRef.current;
            const imgs = Array.from(root?.querySelectorAll("img") ?? []);
            await Promise.all(imgs.map((img) => img.complete
                ? Promise.resolve()
                : new Promise<void>((resolve) => {
                    img.addEventListener("load", () => resolve(), { once: true });
                    img.addEventListener("error", () => resolve(), { once: true });
                })));
            await document.fonts.ready;
        };
        window.seekAnimation = (t: number) =>
            seekOverlay(t, source, dataRef.current);
        window.triggerSequence = replay;
        window.switchPhase = (index: number) => selectPhase(index === 1 ? "map" : "player");
        window.stopLiveLoop = stopLiveLoop;
        const q = new URLSearchParams(window.location.search);
        if (q.get("accent"))
            onAccentInput(q.get("accent")!);
        if (q.get("url")) {
            onScoreUrlChange(q.get("url")!);
            void fetchData(q.get("url")!);
        }
        else if (!q.get("exportMode") && scoreUrl.trim() && parseScoreUrl(scoreUrl.trim())) {
            void fetchData(scoreUrl.trim());
        }
        return () => {
            stopLiveLoop();
            rootEl.style.colorScheme = prevScheme;
            document.body.style.backgroundColor = prevBodyBg;
            if (themeRoot)
                themeRoot.style.backgroundColor = prevThemeBg;
            delete window.seekAnimation;
            delete window.triggerSequence;
            delete window.switchPhase;
            delete window.stopLiveLoop;
        };
    }, []);
    const [renderProgress, setRenderProgress] = useState<number | null>(null);
    const download = (format: AnimationExportFormat, preset: AnimationExportPreset = "compact") => {
        void (async () => {
            setDownloadReady(null);
            const cleanUrl = scoreUrl.trim();
            const effectiveScore = cleanUrl && parseScoreUrl(cleanUrl)
                ? cleanUrl
                : "https://osu.ppy.sh/scores/2026000001";
            setRenderProgress(0);
            const label = format.toUpperCase() + (preset === "compact" ? " (Small)" : " (HD)");
            setFetchMsg(`Rendering ${label}...`);
            try {
                const started = await (await fetch(buildAnimationExportStartPath({
                    format,
                    preset,
                    score: effectiveScore,
                    theme,
                    accent,
                }))).json() as {
                    id: string;
                };
                for (;;) {
                    await new Promise((resolve) => setTimeout(resolve, 500));
                    const job = await (await fetch(`/api/export-animation/progress?id=${started.id}`)).json() as {
                        state: string;
                        done: number;
                        total: number;
                        error?: string;
                    };
                    if (job.state === "error")
                        throw new Error(job.error ?? "Render failed");
                    const total = Math.max(1, job.total);
                    setRenderProgress(Math.min(1, job.done / total));
                    setFetchMsg(`Rendering ${label} ${Math.round((100 * job.done) / total)}%`);
                    if (job.state === "done")
                        break;
                }
                const downloadUrl = `/api/export-animation/file?id=${started.id}`;
                const filename = animationExportFileName(format, preset);
                setDownloadReady({ url: downloadUrl, filename, label });
                setFetchMsg("Render ready! Tap below or check your downloads.");

                const isMobile = typeof navigator !== "undefined" && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
                if (isMobile) {
                    window.location.href = downloadUrl;
                } else {
                    const a = document.createElement("a");
                    a.href = downloadUrl;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }
            }
            catch (err) {
                setFetchMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
            }
            finally {
                setRenderProgress(null);
            }
        })();
    };
    useEffect(() => {
        onReady?.({ download, canDownload: hasData && renderProgress === null });
    }, [onReady, download, hasData, renderProgress]);
    if (exportMode) {
        const stageClass = exportFormat === "gif" ? "animation-stage gif-export" : "animation-stage";
        const stageStyle = exportTransparent ? { backgroundColor: "transparent" } : undefined;
        if (!hasData) {
            return <div className={stageClass} ref={stageRef} style={stageStyle}/>;
        }
        return (<div className={stageClass} ref={stageRef} style={stageStyle}>
        <OverlayWidget data={data} spline={spline} setRef={setRef}/>
      </div>);
    }
    return (<>
      <aside className="app-sidebar" aria-label="Animation controls">
        <section className="sidebar-section score-section" aria-label="Animation source">
          <label className="field">
            <span className="field-label">Score URL</span>
            <TextField.Root size="2" className="editor-input" value={scoreUrl} onChange={(e) => onScoreUrlChange(e.target.value)} placeholder="https://osu.ppy.sh/scores/1234567890"/>
          </label>
          <Button type="button" size="2" color="gray" highContrast disabled={busy || !scoreUrl.trim()} onClick={() => void fetchData(scoreUrl)} className="fetch-button">
            {busy ? "Fetching..." : "Fetch"}
          </Button>
          {fetchMsg ? <div className="field-note" role="status">{fetchMsg}</div> : null}
          {renderProgress !== null ? (<div className="render-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(renderProgress * 100)}>
            <div className="render-progress-fill" style={{ width: `${Math.round(renderProgress * 100)}%` }}/>
          </div>) : null}
          {downloadReady ? (
            <div className="field-note" role="status">{downloadReady.label} ready! Tap below if the download did not start.</div>
          ) : null}
          {downloadReady ? (
            <Button asChild size="2" variant="soft" color="gray" highContrast style={{ width: "100%", justifyContent: "flex-start", height: "auto", paddingTop: 8, paddingBottom: 8 }}>
              <a
                href={downloadReady.url}
                download={downloadReady.filename}
                title={downloadReady.filename}
                onClick={() => {
                  setTimeout(() => {
                    window.location.href = downloadReady.url;
                  }, 150);
                }}
              >
                <DownloadIcon />
                <Flex direction="column" align="start" gap="1" style={{ minWidth: 0, flex: 1, lineHeight: 1.4 }}>
                  <span>Save file</span>
                  <span style={{ fontSize: 11, opacity: 0.65, fontWeight: 400, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{downloadReady.filename}</span>
                </Flex>
              </a>
            </Button>
          ) : null}
        </section>

        <section className="sidebar-section animation-group" aria-label="Playback">
          <Button type="button" size="2" color="gray" highContrast onClick={replay} disabled={!hasData} className="fetch-button">
            <PlayIcon /> Replay
          </Button>
          <SegmentedControl.Root size="2" className="segmented-control" aria-label="Replay from" value={phase} onValueChange={(v) => selectPhase(v as "player" | "map")}>
            <SegmentedControl.Item value="player">Player</SegmentedControl.Item>
            <SegmentedControl.Item value="map">Map</SegmentedControl.Item>
          </SegmentedControl.Root>
          <div className="setting-row">
            <span className="setting-label">Loop</span>
            <Switch size="2" radius="full" checked={loop} onCheckedChange={onLoopChange} aria-label="Loop"/>
          </div>
        </section>

        <section className="sidebar-section animation-group" aria-label="Style">
          <div className="setting-row">
            <div className="setting-copy">
              <span className="setting-label">Accent color</span>
              <span className="setting-value">{accent.toUpperCase()}</span>
            </div>
            <AccentPicker color={accent} onChange={onAccentInput} align="right"/>
          </div>
        </section>
      </aside>

      <main className="app-preview" aria-label="Animation canvas">
        {hasData ? (<ZoomableStage width={470} height={340} maxFitZoom={1} fitLabel="Fit animation to screen" background="transparent">
            <div ref={stageRef}>
              <OverlayWidget data={data} spline={spline} setRef={setRef}/>
            </div>
          </ZoomableStage>) : (<div className="empty-state">
            <p>Paste a score URL and fetch it to see the animation.</p>
          </div>)}
      </main>
    </>);
}

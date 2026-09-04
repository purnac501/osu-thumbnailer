import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type React from "react";
import { Button, Flex, IconButton, Tooltip } from "@radix-ui/themes";
import { EnterFullScreenIcon, MinusIcon, PlusIcon } from "@radix-ui/react-icons";
import "./CanvasView.css";
export interface CanvasViewOptions {
    width: number;
    height: number;
    scale?: number;
    maxFitZoom?: number;
}
export function useCanvasView({ width, height, scale = 1, maxFitZoom = 1.5 }: CanvasViewOptions) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const panStart = useRef<{
        pointerX: number;
        pointerY: number;
        x: number;
        y: number;
    } | null>(null);
    const viewPlaced = useRef(false);
    const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
    const [placed, setPlaced] = useState(false);
    const [panning, setPanning] = useState(false);
    const viewRef = useRef(view);
    viewRef.current = view;
    const effectiveScale = scale * view.zoom;
    const resetFitView = useCallback(() => {
        const viewport = viewportRef.current;
        if (!viewport)
            return;
        const w = viewport.clientWidth;
        const h = viewport.clientHeight;
        if (w <= 0 || h <= 0)
            return;
        const fitZoom = Math.min((w - 24) / (width * scale), (h - 24) / (height * scale), maxFitZoom);
        const zoom = Math.max(0.15, fitZoom);
        const totalWidth = width * scale * zoom;
        const totalHeight = height * scale * zoom;
        setView({
            zoom,
            x: (w - totalWidth) / 2,
            y: (h - totalHeight) / 2,
        });
        setPlaced(true);
    }, [height, maxFitZoom, scale, width]);
    useLayoutEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport)
            return;
        const observer = new ResizeObserver(([entry]) => {
            if (!entry)
                return;
            if (!viewPlaced.current && entry.contentRect.width > 0) {
                viewPlaced.current = true;
                resetFitView();
            }
        });
        observer.observe(viewport);
        return () => observer.disconnect();
    }, [resetFitView]);
    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport)
            return;
        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            const bounds = viewport.getBoundingClientRect();
            const cursorX = event.clientX - bounds.left;
            const cursorY = event.clientY - bounds.top;
            setView((current) => {
                const zoom = Math.min(3, Math.max(0.5, current.zoom * Math.exp(-event.deltaY * 0.001)));
                const ratio = zoom / current.zoom;
                return {
                    zoom,
                    x: cursorX - (cursorX - current.x) * ratio,
                    y: cursorY - (cursorY - current.y) * ratio,
                };
            });
        };
        viewport.addEventListener("wheel", onWheel, { passive: false });
        return () => viewport.removeEventListener("wheel", onWheel);
    }, []);
    const zoomIn = useCallback(() => setView((v) => ({ ...v, zoom: Math.min(3, v.zoom * 1.25) })), []);
    const zoomOut = useCallback(() => setView((v) => ({ ...v, zoom: Math.max(0.15, v.zoom * 0.8) })), []);
    const beginPan = useCallback((clientX: number, clientY: number) => {
        const current = viewRef.current;
        panStart.current = { pointerX: clientX, pointerY: clientY, x: current.x, y: current.y };
        setPanning(true);
    }, []);
    const movePan = useCallback((clientX: number, clientY: number) => {
        const start = panStart.current;
        if (!start)
            return;
        setView((current) => ({
            ...current,
            x: start.x + clientX - start.pointerX,
            y: start.y + clientY - start.pointerY,
        }));
    }, []);
    const endPan = useCallback(() => {
        panStart.current = null;
        setPanning(false);
    }, []);
    return {
        viewportRef,
        view,
        effectiveScale,
        placed,
        panning,
        resetFitView,
        zoomIn,
        zoomOut,
        beginPan,
        movePan,
        endPan,
    };
}
export function CanvasZoomControls({ onZoomIn, onZoomOut, onFit, fitLabel, }: {
    onZoomIn: () => void;
    onZoomOut: () => void;
    onFit: () => void;
    fitLabel: string;
}) {
    return (<Flex data-editor-control className="canvas-zoom-controls" align="center" gap="2">
      <Tooltip content="Zoom in" side="top" sideOffset={10}><IconButton type="button" onClick={onZoomIn} size="2" variant="soft" color="gray" aria-label="Zoom in"><PlusIcon /></IconButton></Tooltip>
      <Tooltip content="Zoom out" side="top" sideOffset={10}><IconButton type="button" onClick={onZoomOut} size="2" variant="soft" color="gray" aria-label="Zoom out"><MinusIcon /></IconButton></Tooltip>
      <Tooltip content={fitLabel} side="top" sideOffset={10}><Button type="button" onClick={onFit} size="2" variant="soft" color="gray" aria-label={fitLabel}><EnterFullScreenIcon />Fit</Button></Tooltip>
    </Flex>);
}
function releaseCapture(target: HTMLElement, pointerId: number): void {
    try {
        target.releasePointerCapture(pointerId);
    }
    catch {
    }
}
export function ZoomableStage({ width, height, scale = 1, maxFitZoom = 1.5, fitLabel = "Fit to screen", background, children, }: {
    width: number;
    height: number;
    scale?: number;
    maxFitZoom?: number;
    fitLabel?: string;
    background?: string;
    children: React.ReactNode;
}) {
    const { viewportRef, view, effectiveScale, placed, panning, resetFitView, zoomIn, zoomOut, beginPan, movePan, endPan, } = useCanvasView({ width, height, scale, maxFitZoom });
    return (<div ref={viewportRef} className="canvas-viewport" style={{ background, cursor: panning ? "grabbing" : "grab" }} onPointerDown={(event) => {
            if (event.button === 1)
                event.preventDefault();
            if (event.button !== 0 && event.button !== 1 && event.pointerType !== "touch")
                return;
            event.currentTarget.setPointerCapture(event.pointerId);
            beginPan(event.clientX, event.clientY);
        }} onPointerMove={(event) => movePan(event.clientX, event.clientY)} onPointerUp={(event) => {
            endPan();
            releaseCapture(event.currentTarget, event.pointerId);
        }} onPointerCancel={endPan} onDragStart={(event) => event.preventDefault()}>
      <div style={{
            position: "relative", width, height,
            transform: `translate(${view.x}px, ${view.y}px) scale(${effectiveScale})`,
            transformOrigin: "top left",
            visibility: placed ? "visible" : "hidden",
        }}>
        {children}
      </div>
      <CanvasZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} onFit={resetFitView} fitLabel={fitLabel}/>
    </div>);
}

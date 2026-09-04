import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type React from "react";
import { ContextMenu } from "@radix-ui/themes";
import { Rnd } from "react-rnd";
import { CanvasZoomControls, useCanvasView } from "./CanvasView";
import type { ThumbnailData } from "../shared/types/thumbnail";
import { Thumbnail } from "../thumbnail/Thumbnail";
import type { ReferenceTemplateComponents, ThumbnailTemplate } from "../thumbnail/types";
const UNSELECTABLE = new Set([
    "background", "badge-row", "combo", "difficulty", "bpm",
]);
const TEXT_KEYS: Record<string, string> = {
    status: "status", "status-miss": "status", "status-sb": "status-sb",
    "star-rating": "star-rating", pp: "pp", combo: "combo",
    difficulty: "difficulty", bpm: "bpm", "map-artist": "map-artist", "map-title": "map-title", grade: "grade",
    accuracy: "accuracy", leaderboard: "leaderboard", username: "username",
    "bottom-message": "bottom-text",
};
export const getTextKeyForLayer = (layer: string) => TEXT_KEYS[layer] ?? layer;
const SIZE_FIELDS: Record<string, "size" | "iconSize"> = {
    "twitch-logo": "size",
    "mod-list": "iconSize",
};
export const LAYER_NAMES: Record<string, string> = {
    status: "Status (FC/Miss)",
    "status-miss": "Miss Count",
    "status-sb": "Slider Breaks",
    "star-rating": "Star Rating",
    pp: "PP Counter",
    combo: "Combo Badge",
    difficulty: "Difficulty Badge",
    bpm: "BPM Badge",
    "map-title": "Map Title",
    "map-artist": "Map Artist",
    grade: "Grade / Rank",
    accuracy: "Accuracy",
    leaderboard: "Leaderboard Rank",
    username: "Username",
    "bottom-message": "Bottom Message",
    sparkles: "Cute Sparkles",
};
const STYLE_COMPONENT: Record<string, keyof ReferenceTemplateComponents> = {
    "status-miss": "statusMiss",
    "status-sb": "statusSB",
    "star-rating": "starRating",
    pp: "pp",
    combo: "comboBadge",
    difficulty: "difficultyBadge",
    bpm: "bpmBadge",
    "map-title": "mapTitle",
    "map-artist": "mapArtist",
    grade: "grade",
    accuracy: "accuracy",
    leaderboard: "leaderboard",
    username: "usernamePanel",
};
export function getLayerTextStyle(layer: string | null, template: ThumbnailTemplate, data?: ThumbnailData | null): {
    fontSize: number;
    color: string;
} {
    if (!layer)
        return { fontSize: 48, color: "#FFFFFF" };
    if (layer.startsWith("custom-")) {
        const custom = template.customTexts?.find((c) => c.id === layer);
        return {
            fontSize: custom?.fontSize ?? 54,
            color: custom?.color ?? "#FFFFFF",
        };
    }
    if (layer === "status") {
        const c = data && data.status.kind !== "fc" ? template.components.statusMiss : template.components.status;
        return { fontSize: c.fontSize, color: c.color };
    }
    if (layer === "bottom-message" || layer === "bottom-text") {
        const c = template.components.bottomMessage;
        return { fontSize: c.fontSize, color: c.prefixColor };
    }
    const key = STYLE_COMPONENT[layer];
    if (!key)
        return { fontSize: 48, color: "#FFFFFF" };
    const c = template.components[key] as {
        fontSize: number;
        color: string;
    };
    return { fontSize: c.fontSize, color: c.color };
}
export const isCustomText = (layer: string) => layer.startsWith("custom-");
export const isTextLayer = (layer: string | null): boolean => layer ? Boolean(TEXT_KEYS[layer]) || isCustomText(layer) : false;
interface Rect {
    left: number;
    top: number;
    width: number;
    height: number;
}
interface Props {
    template: ThumbnailTemplate;
    data: ThumbnailData;
    scale: number;
    selected: string | null;
    editing: string | null;
    onSelect: (layer: string | null) => void;
    onEditStart: (layer: string) => void;
    onEditEnd: () => void;
    onMove: (layer: string, x: number, y: number) => void;
    onResize: (layer: string, patch: Record<string, number>) => void;
    onTextChange: (key: string, value: string) => void;
    onAccentSelection: (text: string) => void;
    onInteractStart: () => void;
    onResetLayer: (layer: string) => void;
    onRemoveLayer: (layer: string) => void;
}
export function EditorCanvas({ template, data, scale, selected, editing, onSelect, onEditStart, onEditEnd, onMove, onResize, onTextChange, onAccentSelection, onInteractStart, onResetLayer, onRemoveLayer, }: Props) {
    const canvasRef = useRef<HTMLDivElement>(null);
    const editRef = useRef<HTMLDivElement>(null);
    const geometryStart = useRef<{
        hitbox: Rect;
        layer: Rect;
        fontSize?: number;
    } | null>(null);
    const { viewportRef, view, effectiveScale, placed, panning, resetFitView, zoomIn, zoomOut, beginPan, movePan, endPan, } = useCanvasView({ width: template.canvas.width, height: template.canvas.height, scale });
    const [selection, setSelection] = useState<Rect | null>(null);
    const [draft, setDraft] = useState("");
    const [editStyle, setEditStyle] = useState<React.CSSProperties>({});
    const [contextOpen, setContextOpen] = useState(false);
    const [contextTarget, setContextTarget] = useState<{
        layer: string;
        text: string;
    } | null>(null);
    const contextAvailable = useRef(false);
    const contextTextRange = useRef<Range | null>(null);
    const layerAt = (element: HTMLElement | null): string | null => {
        let current = element;
        while (current && current.id !== "thumbnail-root") {
            if (current.dataset.layer) {
                return UNSELECTABLE.has(current.dataset.layer) ? null : current.dataset.layer;
            }
            current = current.parentElement;
        }
        return null;
    };
    const elementFor = (layer: string) => canvasRef.current?.querySelector(`[data-layer="${layer}"]`) as HTMLElement | null;
    const textElementFor = (layer: string) => {
        const element = elementFor(layer);
        return (element?.querySelector("[data-editor-text]") as HTMLElement | null) ?? element;
    };
    const rectOf = (layer: string, fullLayer = false): Rect | null => {
        const canvas = canvasRef.current;
        const element = elementFor(layer);
        if (!canvas || !element)
            return null;
        const base = canvas.getBoundingClientRect();
        const rect = element.getBoundingClientRect();
        const result = {
            left: (rect.left - base.left) / effectiveScale,
            top: (rect.top - base.top) / effectiveScale,
            width: rect.width / effectiveScale,
            height: rect.height / effectiveScale,
        };
        if (layer === "grade" && !fullLayer) {
            result.top += result.height * 0.15;
            result.height *= 0.7;
        }
        return result;
    };
    useLayoutEffect(() => {
        if (editing)
            return;
        setSelection(selected ? rectOf(selected) : null);
    }, [selected, editing, template]);
    useLayoutEffect(() => {
        if (!editing)
            return;
        const element = textElementFor(editing);
        const canvas = canvasRef.current;
        if (!element || !canvas)
            return;
        const base = canvas.getBoundingClientRect();
        const elementBounds = element.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(element);
        const textBounds = range.getBoundingClientRect();
        const bounds = element.dataset.editorText
            ? elementBounds
            : {
                left: textBounds.left,
                top: elementBounds.top,
                width: textBounds.width,
                height: elementBounds.height,
            };
        const rect = {
            left: (bounds.left - base.left) / effectiveScale,
            top: (bounds.top - base.top) / effectiveScale,
            width: bounds.width / effectiveScale,
            height: bounds.height / effectiveScale,
        };
        const style = getComputedStyle(element);
        setSelection(rect);
        setDraft(element.textContent ?? "");
        setEditStyle({
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            letterSpacing: style.letterSpacing,
            lineHeight: style.lineHeight,
            textAlign: style.textAlign as React.CSSProperties["textAlign"],
            textTransform: style.textTransform as React.CSSProperties["textTransform"],
            color: style.color,
            textShadow: style.textShadow,
            display: style.display,
            alignItems: style.alignItems,
            justifyContent: style.justifyContent,
            padding: style.padding,
        });
        element.style.visibility = "hidden";
        return () => { element.style.visibility = ""; };
    }, [editing]);
    useLayoutEffect(() => {
        const editor = editRef.current;
        if (!editing || !selection || !editor)
            return;
        editor.textContent = draft;
        editor.focus();
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        const selectedText = window.getSelection();
        selectedText?.removeAllRanges();
        selectedText?.addRange(range);
    }, [editing, selection]);
    useEffect(() => {
        const close = (event: MouseEvent) => {
            if (canvasRef.current?.contains(event.target as Node))
                return;
            onEditEnd();
        };
        window.addEventListener("mousedown", close);
        return () => window.removeEventListener("mousedown", close);
    }, [onEditEnd]);
    const applyGeometry = (layer: string, bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    }) => {
        const origin = geometryStart.current;
        const x = bounds.x + (origin ? origin.layer.left - origin.hitbox.left : 0);
        const y = bounds.y + (origin ? origin.layer.top - origin.hitbox.top : 0);
        if (SIZE_FIELDS[layer]) {
            onResize(layer, {
                [SIZE_FIELDS[layer]!]: Math.max(10, Math.round(bounds.width)),
                x: Math.round(x), y: Math.round(y),
            });
        }
        else if (isTextLayer(layer) && origin && origin.hitbox.height > 0 && origin.fontSize) {
            const scaleRatio = bounds.height / origin.hitbox.height;
            const newFontSize = Math.max(10, Math.min(500, Math.round(origin.fontSize * scaleRatio)));
            onResize(layer, {
                fontSize: newFontSize,
                width: Math.round(bounds.width),
                height: Math.round(bounds.height),
                x: Math.round(x),
                y: Math.round(y),
            });
        }
        else {
            onResize(layer, {
                width: Math.round(bounds.width), height: Math.round(bounds.height),
                x: Math.round(x), y: Math.round(y),
            });
        }
    };
    const finishTextEdit = () => {
        if (contextAvailable.current)
            return;
        onEditEnd();
    };
    const beginInteraction = () => {
        onInteractStart();
    };
    return (<div ref={viewportRef} className="canvas-viewport" style={{ cursor: panning ? "grabbing" : undefined }} onPointerDown={(event) => {
            if (event.button === 0 && event.target === event.currentTarget) {
                onSelect(null);
            }
            const isBg = event.target === event.currentTarget ||
                (event.target as HTMLElement).id === "thumbnail-root" ||
                (event.target as HTMLElement).dataset.layer === "background";
            if (event.button === 1 || (isBg && (event.pointerType === "touch" || event.button === 0))) {
                if (event.button === 1)
                    event.preventDefault();
                if (event.button === 1 || isBg) {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    beginPan(event.clientX, event.clientY);
                }
            }
        }} onPointerMove={(event) => movePan(event.clientX, event.clientY)} onPointerUp={(event) => {
            endPan();
            try {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
            catch {
            }
        }} onPointerCancel={endPan}>
      <ContextMenu.Root open={contextOpen} onOpenChange={(open) => {
            setContextOpen(open && contextAvailable.current);
            if (!open) {
                const range = contextTextRange.current;
                contextAvailable.current = false;
                contextTextRange.current = null;
                if (editing && range)
                    requestAnimationFrame(() => {
                        editRef.current?.focus({ preventScroll: true });
                        const selection = window.getSelection();
                        selection?.removeAllRanges();
                        selection?.addRange(range);
                    });
            }
        }}>
        <ContextMenu.Trigger>
          <div ref={canvasRef} style={{
            position: "relative", width: template.canvas.width, height: template.canvas.height,
            transform: `translate(${view.x}px, ${view.y}px) scale(${effectiveScale})`, transformOrigin: "top left",
            visibility: placed ? "visible" : "hidden",
        }} onPointerDown={(event) => {
            if (event.button !== 0)
                return;
            if ((event.target as HTMLElement).closest("[data-editor-control]"))
                return;
            const layer = layerAt(event.target as HTMLElement);
            onSelect(layer);
        }} onDoubleClick={(event) => {
            const layer = layerAt(event.target as HTMLElement);
            if (!layer || !isTextLayer(layer))
                return;
            onSelect(layer);
            onEditStart(layer);
            event.preventDefault();
        }} onContextMenuCapture={(event) => {
            const target = event.target as HTMLElement;
            const layer = layerAt(target) ?? (target.closest("[data-editor-control]") ? editing ?? selected : null);
            contextAvailable.current = Boolean(layer);
            if (!layer) {
                setContextTarget(null);
                return;
            }
            const browserSelection = window.getSelection();
            const isEditingText = Boolean(editing && target.closest("[contenteditable]"));
            const text = isEditingText ? browserSelection?.toString().trim() ?? "" : "";
            contextTextRange.current = isEditingText && browserSelection?.rangeCount
                ? browserSelection.getRangeAt(0).cloneRange()
                : null;
            onSelect(layer);
            setContextTarget({ layer, text });
        }}>
        <Thumbnail data={data} template={template}/>

        {selected && selection && !editing ? (<Rnd key={selected} data-editor-control size={{ width: selection.width, height: selection.height }} position={{ x: selection.left, y: selection.top }} scale={effectiveScale} bounds="parent" lockAspectRatio={Boolean(SIZE_FIELDS[selected])} resizeHandleStyles={resizeHandles} style={{ border: "2px dashed #FFFFFF", zIndex: 50 }} onDoubleClick={(event: React.MouseEvent) => {
                if (!isTextLayer(selected))
                    return;
                event.stopPropagation();
                onEditStart(selected);
            }} onDragStart={() => {
                geometryStart.current = { hitbox: selection, layer: rectOf(selected, true) ?? selection };
                beginInteraction();
            }} onDrag={(_event, position) => {
                const origin = geometryStart.current;
                onMove(selected, position.x + (origin ? origin.layer.left - origin.hitbox.left : 0), position.y + (origin ? origin.layer.top - origin.hitbox.top : 0));
            }} onDragStop={() => { geometryStart.current = null; }} onResizeStart={() => {
                geometryStart.current = {
                    hitbox: selection,
                    layer: rectOf(selected, true) ?? selection,
                    fontSize: getLayerTextStyle(selected, template, data).fontSize,
                };
                beginInteraction();
            }} onResize={(_event, _direction, ref, _delta, position) => applyGeometry(selected, {
                x: position.x, y: position.y, width: ref.offsetWidth, height: ref.offsetHeight,
            })} onResizeStop={() => { geometryStart.current = null; }}/>) : null}

        {editing && selection ? (<div ref={editRef} data-editor-control contentEditable suppressContentEditableWarning onInput={(event) => {
                const value = event.currentTarget.innerText.replace(/\n$/, "");
                setDraft(value);
                onTextChange(getTextKeyForLayer(editing), value);
                if (editing !== "username") {
                    const editor = event.currentTarget;
                    requestAnimationFrame(() => {
                        const rendered = textElementFor(editing);
                        if (rendered) {
                            const style = getComputedStyle(rendered);
                            editor.style.fontSize = style.fontSize;
                            editor.style.lineHeight = style.lineHeight;
                            editor.style.letterSpacing = style.letterSpacing;
                        }
                        const bounds = editor.getBoundingClientRect();
                        onResize(editing, {
                            x: selection.left,
                            y: selection.top,
                            width: bounds.width / effectiveScale,
                            height: bounds.height / effectiveScale,
                        });
                    });
                }
            }} onBlur={finishTextEdit} onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    finishTextEdit();
                }
                if (event.key === "Escape")
                    finishTextEdit();
            }} style={{
                position: "absolute", left: selection.left, top: selection.top,
                width: "max-content", height: "max-content",
                minWidth: 1, minHeight: 1,
                boxSizing: "border-box", outline: "2px solid #ffffff",
                background: "transparent", padding: 0, margin: 0,
                overflow: "visible", whiteSpace: "pre", zIndex: 60, ...editStyle,
            }}/>) : null}

          </div>
        </ContextMenu.Trigger>
        <ContextMenu.Content size="1" style={{ minWidth: 190 }}>
          {contextTarget?.text && (contextTarget.layer === "bottom-message" || contextTarget.layer === "bottom-text") ? (<>
              <ContextMenu.Item onSelect={() => onAccentSelection(contextTarget.text)}>
                Apply accent color
              </ContextMenu.Item>
              <ContextMenu.Item onSelect={() => onAccentSelection("")}>Clear accent color</ContextMenu.Item>
              <ContextMenu.Separator />
            </>) : null}
          {contextTarget ? (<ContextMenu.Item onSelect={() => {
                if (isCustomText(contextTarget.layer))
                    onRemoveLayer(contextTarget.layer);
                else
                    onResetLayer(contextTarget.layer);
            }}>
              {isCustomText(contextTarget.layer) ? "Remove element" : "Reset element to default"}
            </ContextMenu.Item>) : null}
        </ContextMenu.Content>
      </ContextMenu.Root>


      <CanvasZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} onFit={resetFitView} fitLabel="Fit thumbnail to screen"/>
    </div>);
}
const handle = { width: 12, height: 12, background: "#ffffff", border: "2px solid #000000", borderRadius: 3 };
const resizeHandles = { topLeft: handle, topRight: handle, bottomLeft: handle, bottomRight: handle };

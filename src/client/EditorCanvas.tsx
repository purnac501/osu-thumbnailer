import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type React from "react";
import { createPortal } from "react-dom";
import { Rnd } from "react-rnd";
import type { ThumbnailData } from "../shared/types/thumbnail";
import { Thumbnail } from "../thumbnail/Thumbnail";
import type { ThumbnailTemplate } from "../thumbnail/types";

const UNSELECTABLE = new Set([
  "background", "badge-row", "combo", "difficulty", "bpm",
]);
const TEXT_KEYS: Record<string, string> = {
  status: "status", "status-miss": "status", "status-sb": "status-sb",
  "star-rating": "star-rating", pp: "pp", combo: "combo",
  difficulty: "difficulty", bpm: "bpm", "map-title": "map-title", grade: "grade",
  accuracy: "accuracy", leaderboard: "leaderboard", username: "username",
  "bottom-message": "bottom-text",
};
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
  grade: "Grade / Rank",
  accuracy: "Accuracy",
  leaderboard: "Leaderboard Rank",
  username: "Username",
  "bottom-message": "Bottom Message",
};

export function getLayerTextStyle(
  layer: string | null,
  template: ThumbnailTemplate,
  data?: ThumbnailData | null,
): { fontSize: number; color: string } {
  if (!layer) return { fontSize: 48, color: "#FFFFFF" };
  if (layer.startsWith("custom-")) {
    const custom = template.customTexts?.find((c) => c.id === layer);
    return {
      fontSize: custom?.fontSize ?? 54,
      color: custom?.color ?? "#FFFFFF",
    };
  }

  const c = template.components;
  switch (layer) {
    case "status":
      return {
        fontSize: data && data.status.kind !== "fc" ? c.statusMiss.fontSize : c.status.fontSize,
        color: data && data.status.kind !== "fc" ? c.statusMiss.color : c.status.color,
      };
    case "status-miss":
      return { fontSize: c.statusMiss.fontSize, color: c.statusMiss.color };
    case "status-sb":
      return { fontSize: c.statusSB.fontSize, color: c.statusSB.color };
    case "star-rating":
      return { fontSize: c.starRating.fontSize, color: c.starRating.color };
    case "pp":
      return { fontSize: c.pp.fontSize, color: c.pp.color };
    case "combo":
      return { fontSize: c.comboBadge.fontSize, color: c.comboBadge.color };
    case "difficulty":
      return { fontSize: c.difficultyBadge.fontSize, color: c.difficultyBadge.color };
    case "bpm":
      return { fontSize: c.bpmBadge.fontSize, color: c.bpmBadge.color };
    case "map-title":
      return { fontSize: c.mapTitle.fontSize, color: c.mapTitle.color };
    case "grade":
      return { fontSize: c.grade.fontSize, color: c.grade.color };
    case "accuracy":
      return { fontSize: c.accuracy.fontSize, color: c.accuracy.color };
    case "leaderboard":
      return { fontSize: c.leaderboard.fontSize, color: c.leaderboard.color };
    case "username":
      return { fontSize: c.usernamePanel.fontSize, color: c.usernamePanel.color };
    case "bottom-message":
    case "bottom-text":
      return { fontSize: c.bottomMessage.fontSize, color: c.bottomMessage.prefixColor };
    default:
      return { fontSize: 48, color: "#FFFFFF" };
  }
}

export const isCustomText = (layer: string) => layer.startsWith("custom-");
export const isTextLayer = (layer: string | null): boolean =>
  layer ? Boolean(TEXT_KEYS[layer]) || isCustomText(layer) : false;

interface Rect { left: number; top: number; width: number; height: number }
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

/** Direct editor overlay. The thumbnail and react-rnd use the same logical coordinates. */
export function EditorCanvas({
  template, data, scale, selected, editing, onSelect, onEditStart, onEditEnd,
  onMove, onResize, onTextChange, onAccentSelection, onInteractStart,
  onResetLayer,
  onRemoveLayer,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLDivElement>(null);
  const panStart = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
  const geometryStart = useRef<{ hitbox: Rect; layer: Rect; fontSize?: number } | null>(null);
  const viewPlaced = useRef(false);
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [selection, setSelection] = useState<Rect | null>(null);
  const [draft, setDraft] = useState("");
  const [editStyle, setEditStyle] = useState<React.CSSProperties>({});
  const [accentMenu, setAccentMenu] = useState<{ x: number; y: number; text: string } | null>(null);
  const [layerMenu, setLayerMenu] = useState<{ x: number; y: number; layer: string } | null>(null);
  const effectiveScale = scale * view.zoom;

  const resetFitView = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    if (w <= 0 || h <= 0) return;

    const fitZoom = Math.min(
      (w - 24) / (template.canvas.width * scale),
      (h - 24) / (template.canvas.height * scale),
      1.5
    );
    const zoom = Math.max(0.15, fitZoom);
    const totalWidth = template.canvas.width * scale * zoom;
    const totalHeight = template.canvas.height * scale * zoom;

    setView({
      zoom,
      x: (w - totalWidth) / 2,
      y: (h - totalHeight) / 2,
    });
  }, [scale, template.canvas.height, template.canvas.width]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      if (!viewPlaced.current && entry.contentRect.width > 0) {
        viewPlaced.current = true;
        resetFitView();
      }
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [resetFitView]);

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
  const elementFor = (layer: string) =>
    canvasRef.current?.querySelector(`[data-layer="${layer}"]`) as HTMLElement | null;
  const textElementFor = (layer: string) => {
    const element = elementFor(layer);
    return (element?.querySelector("[data-editor-text]") as HTMLElement | null) ?? element;
  };
  const rectOf = (layer: string, fullLayer = false): Rect | null => {
    const canvas = canvasRef.current;
    const element = elementFor(layer);
    if (!canvas || !element) return null;
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
    if (editing) return;
    setSelection(selected ? rectOf(selected) : null);
  }, [selected, editing, template]);

  useLayoutEffect(() => {
    if (!editing) return;
    const element = textElementFor(editing);
    const canvas = canvasRef.current;
    if (!element || !canvas) return;
    const base = canvas.getBoundingClientRect();
    const elementBounds = element.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element);
    const textBounds = range.getBoundingClientRect();
    const bounds = element.dataset.editorText
      ? elementBounds
      : { ...elementBounds, left: textBounds.left, width: textBounds.width };
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
    if (!editing || !selection || !editor) return;
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
      if (canvasRef.current?.contains(event.target as Node)) return;
      setAccentMenu(null);
      setLayerMenu(null);
      onEditEnd();
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [onEditEnd]);

  const applyGeometry = (
    layer: string,
    bounds: { x: number; y: number; width: number; height: number },
  ) => {
    const origin = geometryStart.current;
    const x = bounds.x + (origin ? origin.layer.left - origin.hitbox.left : 0);
    const y = bounds.y + (origin ? origin.layer.top - origin.hitbox.top : 0);
    if (SIZE_FIELDS[layer]) {
      onResize(layer, {
        [SIZE_FIELDS[layer]!]: Math.max(10, Math.round(bounds.width)),
        x: Math.round(x), y: Math.round(y),
      });
    } else if (isTextLayer(layer) && origin && origin.hitbox.height > 0 && origin.fontSize) {
      const scaleRatio = bounds.height / origin.hitbox.height;
      const newFontSize = Math.max(10, Math.min(500, Math.round(origin.fontSize * scaleRatio)));
      onResize(layer, {
        fontSize: newFontSize,
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
        x: Math.round(x),
        y: Math.round(y),
      });
    } else {
      onResize(layer, {
        width: Math.round(bounds.width), height: Math.round(bounds.height),
        x: Math.round(x), y: Math.round(y),
      });
    }
  };

  const finishTextEdit = () => {
    setAccentMenu(null);
    onEditEnd();
  };
  const beginInteraction = () => {
    setAccentMenu(null);
    setLayerMenu(null);
    onInteractStart();
  };

  return (
    <div
      ref={viewportRef}
      style={{
        position: "relative", width: "100%", height: "100%",
        overflow: "hidden", cursor: panStart.current ? "grabbing" : undefined,
      }}
      onWheel={(event) => {
        event.preventDefault();
        const viewport = viewportRef.current!.getBoundingClientRect();
        const cursorX = event.clientX - viewport.left;
        const cursorY = event.clientY - viewport.top;
        setView((current) => {
          const zoom = Math.min(3, Math.max(0.5, current.zoom * Math.exp(-event.deltaY * 0.001)));
          const ratio = zoom / current.zoom;
          return {
            zoom,
            x: cursorX - (cursorX - current.x) * ratio,
            y: cursorY - (cursorY - current.y) * ratio,
          };
        });
      }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onSelect(null);
        }
        const isBg = event.target === event.currentTarget ||
          (event.target as HTMLElement).id === "thumbnail-root" ||
          (event.target as HTMLElement).dataset.layer === "background";
        if (event.button === 1 || (isBg && (event.pointerType === "touch" || event.button === 0))) {
          if (event.button === 1 || isBg) {
            event.currentTarget.setPointerCapture(event.pointerId);
            panStart.current = { pointerX: event.clientX, pointerY: event.clientY, x: view.x, y: view.y };
          }
        }
      }}
      onPointerMove={(event) => {
        const start = panStart.current;
        if (!start) return;
        setView((current) => ({
          ...current,
          x: start.x + event.clientX - start.pointerX,
          y: start.y + event.clientY - start.pointerY,
        }));
      }}
      onPointerUp={(event) => {
        if (panStart.current) {
          panStart.current = null;
          try {
            event.currentTarget.releasePointerCapture(event.pointerId);
          } catch {
            // ignore
          }
        }
      }}
    >
      <div
        ref={canvasRef}
        style={{
          position: "relative", width: template.canvas.width, height: template.canvas.height,
          transform: `translate(${view.x}px, ${view.y}px) scale(${effectiveScale})`, transformOrigin: "top left",
        }}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("[data-editor-control]")) return;
          const layer = layerAt(event.target as HTMLElement);
          onSelect(layer);
        }}
        onDoubleClick={(event) => {
          const layer = layerAt(event.target as HTMLElement);
          if (!layer || !isTextLayer(layer)) return;
          onSelect(layer);
          onEditStart(layer);
          event.preventDefault();
        }}
        onContextMenu={(event) => {
          if ((event.target as HTMLElement).closest("[contenteditable]")) return;
          const layer = layerAt(event.target as HTMLElement);
          if (!layer) return;
          event.preventDefault();
          onSelect(layer);
          setLayerMenu({ x: event.clientX, y: event.clientY, layer });
        }}
      >
        <Thumbnail data={data} template={template} />

        {selected && selection && !editing ? (
          <Rnd
            key={selected}
            data-editor-control
            size={{ width: selection.width, height: selection.height }}
            position={{ x: selection.left, y: selection.top }}
            scale={effectiveScale}
            bounds="parent"
            lockAspectRatio={Boolean(SIZE_FIELDS[selected])}
            resizeHandleStyles={resizeHandles}
            style={{ border: "2px dashed #FF66AA", zIndex: 50 }}
            onDoubleClick={(event: React.MouseEvent) => {
              if (!isTextLayer(selected)) return;
              event.stopPropagation();
              onEditStart(selected);
            }}
            onDragStart={() => {
              geometryStart.current = { hitbox: selection, layer: rectOf(selected, true) ?? selection };
              beginInteraction();
            }}
            onDrag={(_event, position) => {
              const origin = geometryStart.current;
              onMove(
                selected,
                position.x + (origin ? origin.layer.left - origin.hitbox.left : 0),
                position.y + (origin ? origin.layer.top - origin.hitbox.top : 0),
              );
            }}
            onDragStop={() => { geometryStart.current = null; }}
            onResizeStart={() => {
              geometryStart.current = {
                hitbox: selection,
                layer: rectOf(selected, true) ?? selection,
                fontSize: getLayerTextStyle(selected, template, data).fontSize,
              };
              beginInteraction();
            }}
            onResize={(_event, _direction, ref, _delta, position) =>
              applyGeometry(selected, {
                x: position.x, y: position.y, width: ref.offsetWidth, height: ref.offsetHeight,
              })
            }
            onResizeStop={() => { geometryStart.current = null; }}
          />
        ) : null}

        {editing && selection ? (
          <div
            ref={editRef}
            data-editor-control
            contentEditable
            suppressContentEditableWarning
            onInput={(event) => {
              const value = event.currentTarget.innerText.replace(/\n$/, "");
              setDraft(value);
              onTextChange(TEXT_KEYS[editing] ?? editing, value);
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
            }}
            onBlur={finishTextEdit}
            onKeyDown={(event) => {
              if (event.key === "Escape") finishTextEdit();
            }}
            onContextMenu={(event) => {
              if (editing !== "bottom-message") return;
              const text = window.getSelection()?.toString() ?? "";
              if (!text) return;
              event.preventDefault();
              setAccentMenu({ x: event.clientX, y: event.clientY, text });
            }}
            style={{
              position: "absolute", left: selection.left, top: selection.top,
              width: "max-content", height: "max-content",
              minWidth: 1, minHeight: 1,
              boxSizing: "border-box", outline: "2px solid #FF66AA",
              background: "transparent", padding: 0, margin: 0,
              overflow: "visible", whiteSpace: "pre", zIndex: 60, ...editStyle,
            }}
          />
        ) : null}

        {accentMenu ? createPortal(
          <div data-editor-control onMouseDown={(event) => event.stopPropagation()}
            style={{ position: "fixed", left: accentMenu.x, top: accentMenu.y, ...menuStyle }}>
            <button style={{ ...menuButtonStyle, color: "#F0A83C" }} onMouseDown={(event) => event.preventDefault()}
              onClick={() => { onAccentSelection(accentMenu.text); setAccentMenu(null); }}>
              Accent "{accentMenu.text}"
            </button>
            <button style={menuButtonStyle} onMouseDown={(event) => event.preventDefault()}
              onClick={() => { onAccentSelection(""); setAccentMenu(null); }}>
              Clear accent
            </button>
          </div>, document.body
        ) : null}
        {layerMenu ? createPortal(
          <div data-editor-control onMouseDown={(event) => event.stopPropagation()}
            style={{ position: "fixed", left: layerMenu.x, top: layerMenu.y, ...menuStyle }}>
            <button style={menuButtonStyle} onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (isCustomText(layerMenu.layer)) onRemoveLayer(layerMenu.layer);
                else onResetLayer(layerMenu.layer);
                setLayerMenu(null);
              }}>
              {isCustomText(layerMenu.layer) ? "Remove element" : "Reset element to default"}
            </button>
          </div>, document.body
        ) : null}
      </div>

      {/* Floating Zoom & Fit Controls */}
      <div
        data-editor-control
        style={{
          position: "absolute",
          bottom: 14,
          right: 14,
          display: "flex",
          gap: 6,
          background: "rgba(24, 20, 22, 0.85)",
          backdropFilter: "blur(6px)",
          padding: 5,
          borderRadius: 8,
          border: "1px solid #3d3439",
          zIndex: 40,
        }}
      >
        <button
          type="button"
          onClick={() => setView((v) => ({ ...v, zoom: Math.min(3, v.zoom * 1.25) }))}
          style={{
            background: "#332b2f",
            border: "1px solid #4a3e44",
            color: "#eee",
            borderRadius: 6,
            padding: "4px 10px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
          title="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setView((v) => ({ ...v, zoom: Math.max(0.15, v.zoom * 0.8) }))}
          style={{
            background: "#332b2f",
            border: "1px solid #4a3e44",
            color: "#eee",
            borderRadius: 6,
            padding: "4px 10px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
          title="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={resetFitView}
          style={{
            background: "#332b2f",
            border: "1px solid #4a3e44",
            color: "#eee",
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
          }}
          title="Fit thumbnail to screen"
        >
          Fit
        </button>
      </div>
    </div>
  );
}

const handle = { width: 12, height: 12, background: "#FF66AA", border: "2px solid white", borderRadius: 3 };
const resizeHandles = { topLeft: handle, topRight: handle, bottomLeft: handle, bottomRight: handle };
const menuStyle: React.CSSProperties = {
  background: "#241f22", border: "1px solid #54494f", borderRadius: 8,
  padding: 6, zIndex: 100, display: "flex", flexDirection: "column", minWidth: 180,
  fontFamily: '"Montserrat", sans-serif', fontSize: 13,
};
const menuButtonStyle: React.CSSProperties = {
  background: "none", border: 0, color: "#eee", textAlign: "left",
  padding: "7px 10px", cursor: "pointer", font: "inherit",
};

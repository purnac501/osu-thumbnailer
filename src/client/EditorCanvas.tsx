import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type React from "react";
import { createPortal } from "react-dom";
import { Rnd } from "react-rnd";
import type { ThumbnailData } from "../shared/types/thumbnail";
import { Thumbnail } from "../thumbnail/Thumbnail";
import { COMPONENT_BY_LAYER } from "../thumbnail/overrides";
import type { ThumbnailTemplate } from "../thumbnail/types";

const NON_INTERACTIVE = new Set(["background", "badge-row", "status-sb", "status-miss"]);
const TEXT_KEYS: Record<string, string> = {
  status: "status", "star-rating": "star-rating", pp: "pp", combo: "combo",
  difficulty: "difficulty", bpm: "bpm", "map-title": "map-title", grade: "grade",
  accuracy: "accuracy", leaderboard: "leaderboard", username: "username",
  "bottom-message": "bottom-text",
};
const FONT_SIZE_LAYERS = new Set([
  "status", "star-rating", "pp", "map-title", "grade", "accuracy", "leaderboard", "bottom-message",
]);
const SIZE_FIELDS: Record<string, "size" | "iconSize"> = {
  "twitch-logo": "size",
  "mod-list": "iconSize",
};

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
  onTextCommit: (key: string, value: string) => void;
  onAccentSelection: (text: string) => void;
  onInteractStart: () => void;
  onResetLayer: (layer: string) => void;
}

/** Direct editor overlay. The thumbnail and react-rnd use the same logical coordinates. */
export function EditorCanvas({
  template, data, scale, selected, editing, onSelect, onEditStart, onEditEnd,
  onMove, onResize, onTextCommit, onAccentSelection, onInteractStart,
  onResetLayer,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const panStart = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
  const resizeStart = useRef<{ rect: Rect; fontSize: number } | null>(null);
  const viewPlaced = useRef(false);
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [selection, setSelection] = useState<Rect | null>(null);
  const [draft, setDraft] = useState("");
  const [editStyle, setEditStyle] = useState<React.CSSProperties>({});
  const [accentMenu, setAccentMenu] = useState<{ x: number; y: number; text: string } | null>(null);
  const [layerMenu, setLayerMenu] = useState<{ x: number; y: number; layer: string } | null>(null);
  const effectiveScale = scale * view.zoom;

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry || viewPlaced.current) return;
      viewPlaced.current = true;
      setView({
        zoom: 1,
        x: (entry.contentRect.width - template.canvas.width * scale) / 2,
        y: (entry.contentRect.height - template.canvas.height * scale) / 2,
      });
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [scale, template.canvas.height, template.canvas.width]);

  const layerAt = (element: HTMLElement | null): string | null => {
    let current = element;
    while (current && current.id !== "thumbnail-root") {
      if (current.dataset.layer) return current.dataset.layer;
      current = current.parentElement;
    }
    return null;
  };
  const elementFor = (layer: string) =>
    canvasRef.current?.querySelector(`[data-layer="${layer}"]`) as HTMLElement | null;
  const rectOf = (layer: string): Rect | null => {
    const canvas = canvasRef.current;
    const element = elementFor(layer);
    if (!canvas || !element) return null;
    const base = canvas.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return {
      left: (rect.left - base.left) / effectiveScale,
      top: (rect.top - base.top) / effectiveScale,
      width: rect.width / effectiveScale,
      height: rect.height / effectiveScale,
    };
  };
  const configFor = (layer: string): Record<string, number | string | undefined> => {
    const key = COMPONENT_BY_LAYER[layer];
    return key
      ? (template.components as unknown as Record<string, Record<string, number | string | undefined>>)[key] ?? {}
      : {};
  };

  useLayoutEffect(() => {
    setSelection(selected && !editing ? rectOf(selected) : null);
  }, [selected, editing, template]);

  useLayoutEffect(() => {
    if (!editing) return;
    const element = elementFor(editing);
    const rect = rectOf(editing);
    if (!element || !rect) return;
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
      color: style.color,
    });
  }, [editing]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (canvasRef.current?.contains(event.target as Node)) return;
      setAccentMenu(null);
      setLayerMenu(null);
      onEditEnd();
      onSelect(null);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [onEditEnd, onSelect]);

  const applyGeometry = (
    layer: string,
    bounds: { x: number; y: number; width: number; height: number },
    original: Rect,
  ) => {
    const start = resizeStart.current;
    const origin = start?.rect ?? original;
    if (FONT_SIZE_LAYERS.has(layer)) {
      const ratio = Math.max(0.15, bounds.height / Math.max(1, origin.height));
      onResize(layer, {
        fontSize: Math.max(10, Math.round((start?.fontSize ?? (Number(configFor(layer).fontSize) || 40)) * ratio)),
        x: Math.round(bounds.x), y: Math.round(bounds.y),
      });
    } else if (SIZE_FIELDS[layer]) {
      onResize(layer, {
        [SIZE_FIELDS[layer]!]: Math.max(10, Math.round(bounds.width)),
        x: Math.round(bounds.x), y: Math.round(bounds.y),
      });
    } else {
      onResize(layer, {
        width: Math.round(bounds.width), height: Math.round(bounds.height),
        x: Math.round(bounds.x), y: Math.round(bounds.y),
      });
    }
  };

  const finishTextEdit = (commit: boolean) => {
    if (commit && editing) onTextCommit(TEXT_KEYS[editing] ?? editing, draft);
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
        if (event.button !== 1) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        panStart.current = { pointerX: event.clientX, pointerY: event.clientY, x: view.x, y: view.y };
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
        if (event.button !== 1) return;
        panStart.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
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
          if (layer) onSelect(layer);
        }}
        onDoubleClick={(event) => {
          const layer = layerAt(event.target as HTMLElement);
          if (!layer || !TEXT_KEYS[layer]) return;
          onSelect(layer);
          onEditStart(layer);
          event.preventDefault();
        }}
        onContextMenu={(event) => {
          if ((event.target as HTMLElement).closest("textarea")) return;
          const layer = layerAt(event.target as HTMLElement) ?? selected;
          if (!layer) return;
          event.preventDefault();
          onSelect(layer);
          setLayerMenu({ x: event.clientX, y: event.clientY, layer });
        }}
      >
        <Thumbnail data={data} template={template} />

        {selected && selection && !editing && !NON_INTERACTIVE.has(selected) ? (
          <Rnd
            key={selected}
            data-editor-control
            size={{ width: selection.width, height: selection.height }}
            position={{ x: selection.left, y: selection.top }}
            scale={effectiveScale}
            bounds="parent"
            lockAspectRatio={FONT_SIZE_LAYERS.has(selected) || Boolean(SIZE_FIELDS[selected])}
            resizeHandleStyles={resizeHandles}
            style={{ border: "2px dashed #FF66AA", zIndex: 50 }}
            onDoubleClick={(event: React.MouseEvent) => {
              if (!TEXT_KEYS[selected]) return;
              event.stopPropagation();
              onEditStart(selected);
            }}
            onDragStart={beginInteraction}
            onDrag={(_event, position) => onMove(selected, position.x, position.y)}
            onResizeStart={() => {
              resizeStart.current = {
                rect: selection,
                fontSize: Number(configFor(selected).fontSize) || 40,
              };
              beginInteraction();
            }}
            onResize={(_event, _direction, ref, _delta, position) =>
              applyGeometry(selected, {
                x: position.x, y: position.y, width: ref.offsetWidth, height: ref.offsetHeight,
              }, selection)
            }
            onResizeStop={() => { resizeStart.current = null; }}
          />
        ) : null}

        {selected && selection && !editing && NON_INTERACTIVE.has(selected) ? (
          <div data-editor-control style={{
            position: "absolute", left: selection.left, top: selection.top,
            width: selection.width, height: selection.height, border: "2px dashed #FF66AA",
            pointerEvents: "none", zIndex: 50,
          }} />
        ) : null}

        {editing && selection ? (
          <textarea
            data-editor-control autoFocus value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => finishTextEdit(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                finishTextEdit(true);
              } else if (event.key === "Escape") {
                finishTextEdit(false);
              }
            }}
            onContextMenu={(event) => {
              if (editing !== "bottom-message") return;
              const text = draft.slice(event.currentTarget.selectionStart, event.currentTarget.selectionEnd);
              if (!text) return;
              event.preventDefault();
              setAccentMenu({ x: event.clientX, y: event.clientY, text });
            }}
            style={{
              position: "absolute", left: selection.left, top: selection.top,
              width: Math.max(selection.width, 80), height: Math.max(selection.height, 24),
              boxSizing: "border-box", border: "2px solid #FF66AA",
              background: "rgba(0,0,0,0.35)", padding: 0, margin: 0,
              resize: "none", overflow: "hidden", zIndex: 60, ...editStyle,
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
              onClick={() => { onResetLayer(layerMenu.layer); setLayerMenu(null); }}>
              Reset element to default
            </button>
          </div>, document.body
        ) : null}
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

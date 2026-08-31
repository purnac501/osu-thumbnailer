import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type React from "react";
import type { RndDragCallback, RndResizeCallback } from "react-rnd";
import { Rnd } from "react-rnd";
import type { ThumbnailData } from "../shared/types/thumbnail";
import type { ThumbnailTemplate } from "../thumbnail/types";
import { COMPONENT_BY_LAYER } from "../thumbnail/overrides";
import { Thumbnail } from "../thumbnail/Thumbnail";

/** Layers that cannot be dragged or resized. */
const NON_INTERACTIVE = new Set(["background", "badge-row", "status-sb", "status-miss"]);

/** Text layers, mapped to their text key. */
const TEXT_KEY_BY_LAYER: Record<string, string> = {
  status: "status",
  "star-rating": "star-rating",
  pp: "pp",
  combo: "combo",
  difficulty: "difficulty",
  bpm: "bpm",
  "map-title": "map-title",
  grade: "grade",
  accuracy: "accuracy",
  leaderboard: "leaderboard",
  username: "username",
  "bottom-message": "bottom-text",
};

/** Text layers resize via fontSize. */
const FONT_SIZE_LAYERS = new Set([
  "status",
  "star-rating",
  "pp",
  "map-title",
  "grade",
  "accuracy",
  "leaderboard",
  "bottom-message",
]);

/** Icon layers resize via a single size field. */
const SIZE_FIELD_BY_LAYER: Record<string, "size" | "iconSize"> = {
  "twitch-logo": "size",
  "mod-list": "iconSize",
};

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
  onCancelEdit: () => void;
  onDragStart: () => void;
  onMove: (layer: string, x: number, y: number) => void;
  onResizeStart: () => void;
  onResize: (layer: string, patch: Record<string, number>) => void;
  onTextChange: (key: string, value: string) => void;
  onAccentSelection: (text: string) => void;
  onInteractEnd: () => void;
}

/**
 * Preview surface with direct manipulation built on react-rnd (MIT, by the
 * re-resizable author): controlled position+size, anchored resize with eight
 * handles, and first-class support for previews under `transform: scale()`
 * via its `scale` prop. Drag/resize events are translated into template
 * config patches (fontSize for text, width/height for boxes, size for icons).
 */
export function EditorCanvas({
  template,
  data,
  scale,
  selected,
  editing,
  onSelect,
  onEditStart,
  onCancelEdit,
  onDragStart,
  onMove,
  onResizeStart,
  onResize,
  onTextChange,
  onAccentSelection,
  onInteractEnd,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selRect, setSelRect] = useState<Rect | null>(null);
  const [editRect, setEditRect] = useState<Rect | null>(null);
  const [editStyle, setEditStyle] = useState<{
    fontSize: number;
    fontFamily: string;
    fontWeight: number;
    align: "left" | "center" | "right";
    lineHeight: number;
    color: string;
  } | null>(null);
  const [accentMenu, setAccentMenu] = useState<{ x: number; y: number; text: string } | null>(null);
  const interacted = useRef(false);

  const layerAt = (el: HTMLElement | null): string | null => {
    let cur: HTMLElement | null = el;
    while (cur && cur.id !== "thumbnail-root") {
      const l = cur.getAttribute("data-layer");
      if (l) return l;
      cur = cur.parentElement;
    }
    return null;
  };

  const rectOf = (layer: string): Rect | null => {
    const container = containerRef.current;
    const el = container?.querySelector(`[data-layer="${layer}"]`) as HTMLElement | null;
    if (!container || !el) return null;
    const c = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { left: r.left - c.left, top: r.top - c.top, width: r.width, height: r.height };
  };

  const confOf = (layer: string): Record<string, number | string | undefined> => {
    const key = COMPONENT_BY_LAYER[layer];
    return key
      ? (template.components as unknown as Record<string, Record<string, number | string | undefined>>)[key] ?? {}
      : {};
  };

  // Track the selected element's rect while it is selected.
  useLayoutEffect(() => {
    if (!selected || editing) {
      setSelRect(null);
      return;
    }
    let raf = 0;
    const update = () => {
      const r = rectOf(selected);
      if (r) setSelRect(r);
      raf = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, editing, template]);

  // While inline-editing, track the element rect and match its text style.
  useLayoutEffect(() => {
    if (!editing) {
      setEditRect(null);
      setEditStyle(null);
      return;
    }
    const r = rectOf(editing);
    if (!r) return;
    const conf = confOf(editing);
    setEditRect(r);
    setEditStyle({
      fontSize: (Number(conf.fontSize) || 40) * scale,
      fontFamily: (conf.fontFamily as string) ?? "inherit",
      fontWeight: Number(conf.fontWeight) || 600,
      align:
        conf.align === "right" ? "right" : conf.align === "left" ? "left" : "center",
      lineHeight: r.height / scale,
      color: (conf.color as string) ?? "#fff",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, template]);

  // Deselect and commit when clicking outside the canvas.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        if (editing) onCancelEdit();
        onSelect(null);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [editing, onCancelEdit]);

  function commitEdit() {
    if (!editing) return;
    setAccentMenu(null);
    onCancelEdit();
  }

  /** Translates a drag/resize result into config patches for the layer. */
  function applyGeometry(
    layer: string,
    bounds: { x: number; y: number; width: number; height: number },
    orig: Rect,
  ) {
    if (FONT_SIZE_LAYERS.has(layer)) {
      const ratio = Math.max(0.15, bounds.height / Math.max(1, orig.height));
      onResize(layer, {
        fontSize: Math.max(10, Math.round((Number(confOf(layer).fontSize) || 40) * ratio)),
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
      });
    } else if (SIZE_FIELD_BY_LAYER[layer]) {
      const field = SIZE_FIELD_BY_LAYER[layer]!;
      onResize(layer, {
        [field]: Math.max(10, Math.round(bounds.width)),
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
      });
    } else {
      onResize(layer, {
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
      });
    }
  }

  function onDoubleClick(e: React.MouseEvent) {
    const layer = layerAt(e.target as HTMLElement);
    if (!layer) return;
    const key = TEXT_KEY_BY_LAYER[layer];
    if (!key) return;
    onSelect(layer);
    onEditStart(layer);
    setAccentMenu(null);
    e.preventDefault();
  }

  const showRnd = selected && selRect && !editing && !NON_INTERACTIVE.has(selected);
  const showBox = selected && selRect && !editing && NON_INTERACTIVE.has(selected);

  return (
    <div
      ref={containerRef}
      style={{
        width: template.canvas.width * scale,
        height: template.canvas.height * scale,
        overflow: "hidden",
        position: "relative",
        cursor: editing ? "text" : "default",
      }}
      onDoubleClick={onDoubleClick}
    >
      <Thumbnail data={data} template={template} scale={scale} />

      {/* react-rnd proxy over the selected layer: drag inside the box to move,
          drag the handles to resize. Controlled from the layer's live rect. */}
      {showRnd && selected && selRect ? (
        <Rnd
          key={selected}
          size={{ width: selRect.width, height: selRect.height }}
          position={{ x: selRect.left, y: selRect.top }}
          scale={scale}
          bounds="parent"
          enableResizing={{
            top: false,
            right: false,
            bottom: false,
            left: false,
            topLeft: true,
            topRight: true,
            bottomLeft: true,
            bottomRight: true,
          }}
          resizeHandleStyles={{
            topLeft: handleStyle("nwse-resize"),
            topRight: handleStyle("nesw-resize"),
            bottomLeft: handleStyle("nesw-resize"),
            bottomRight: handleStyle("nwse-resize"),
          }}
          dragHandleClassName=".rnd-drag-area"
          style={{
            border: "2px dashed #9146FF",
            background: "transparent",
            zIndex: 50,
          }}
          onDragStart={() => {
            interacted.current = true;
            onDragStart();
          }}
          onDrag={(_e, data) => onMove(selected, data.x, data.y)}
          onDragStop={() => onInteractEnd()}
          onResizeStart={() => {
            interacted.current = true;
            onResizeStart();
          }}
          onResize={(_e, _dir, ref, _delta, pos) => {
            applyGeometry(
              selected,
              { x: pos.x, y: pos.y, width: ref.offsetWidth, height: ref.offsetHeight },
              selRect,
            );
          }}
          onResizeStop={() => onInteractEnd()}
        >
          {/* Transparent drag area covering the whole box */}
          <div className="rnd-drag-area" style={{ position: "absolute", inset: 0, cursor: "move" }} />
        </Rnd>
      ) : null}

      {/* Non-interactive layers still show a selection box */}
      {showBox && selRect ? (
        <div
          style={{
            position: "absolute",
            left: selRect.left - 3,
            top: selRect.top - 3,
            width: selRect.width + 6,
            height: selRect.height + 6,
            border: "2px dashed #9146FF",
            pointerEvents: "none",
            zIndex: 50,
          }}
        />
      ) : null}

      {/* Inline text editor, styled to match the element */}
      {editing && editRect && editStyle ? (
        <textarea
          autoFocus
          defaultValue={containerRef.current?.querySelector(`[data-layer="${editing}"]`)?.textContent ?? ""}
          onChange={(e) => {
            onTextChange(TEXT_KEY_BY_LAYER[editing] ?? editing, e.target.value);
          }}
          onBlur={() => commitEdit()}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commitEdit();
            }
            if (e.key === "Escape") {
              onCancelEdit();
            }
          }}
          onContextMenu={(e) => {
            if (editing !== "bottom-message") return;
            const sel = window.getSelection()?.toString() ?? "";
            if (!sel) return;
            e.preventDefault();
            e.stopPropagation();
            setAccentMenu({ x: e.clientX, y: e.clientY, text: sel });
          }}
          style={{
            position: "absolute",
            left: editRect.left,
            top: editRect.top,
            width: Math.max(editRect.width, 80),
            height: Math.max(editRect.height, 24),
            border: "2px solid #9146FF",
            borderRadius: 4,
            background: "rgba(0,0,0,0.45)",
            color: editStyle.color,
            fontFamily: editStyle.fontFamily,
            fontSize: editStyle.fontSize,
            fontWeight: editStyle.fontWeight,
            textAlign: editStyle.align,
            lineHeight: `${editStyle.lineHeight}px`,
            resize: "none",
            overflow: "hidden",
            zIndex: 60,
            padding: 0,
            margin: 0,
          }}
        />
      ) : null}

      {/* Accent context menu for the bottom message */}
      {accentMenu ? (
        <div
          style={{
            position: "fixed",
            left: accentMenu.x,
            top: accentMenu.y,
            background: "#241f22",
            border: "1px solid #444",
            borderRadius: 8,
            padding: 6,
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            minWidth: 180,
          }}
        >
          <button
            onClick={() => {
              onAccentSelection(accentMenu.text);
              setAccentMenu(null);
            }}
            style={{ ...menuButtonStyle, color: "#F0A83C" }}
          >
            Accent: "{accentMenu.text}"
          </button>
          <button
            onClick={() => {
              onAccentSelection("");
              setAccentMenu(null);
            }}
            style={menuButtonStyle}
          >
            Clear accent
          </button>
        </div>
      ) : null}
    </div>
  );

}

function handleStyle(cursor: string): React.CSSProperties {
  return {
    width: 11,
    height: 11,
    background: "#9146FF",
    border: "2px solid #fff",
    borderRadius: 3,
    cursor,
  };
}

const menuButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#eee",
  textAlign: "left",
  padding: "6px 10px",
  borderRadius: 6,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 13,
};

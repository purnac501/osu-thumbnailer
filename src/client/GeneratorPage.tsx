import { useEffect, useMemo, useRef, useState } from "react";
import "@fontsource/baloo-2/400.css";
import "@fontsource/baloo-2/700.css";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/600.css";
import "flag-icons/css/flag-icons.min.css";
import "../thumbnail/styles.css";
import { templates } from "../thumbnail/templates/registry";
import { applyOverrides, type EditorState } from "../thumbnail/overrides";
import { computeTexts } from "../thumbnail/texts";
import { RESOLUTION_PRESETS, type ResolutionPreset } from "../thumbnail/types";
import type { ThumbnailResult } from "../shared/types/thumbnail";
import { EditorCanvas } from "./EditorCanvas";

const RESOLUTIONS = Object.keys(RESOLUTION_PRESETS) as ResolutionPreset[];
const STORAGE_KEY = "osu-thumbnailer-editor-v1";

interface SavedState {
  url: string;
  resolution: ResolutionPreset;
  editor: EditorState;
}

function loadSaved(): SavedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SavedState;
  } catch {
    // ignore corrupt state
  }
  return {
    url: "",
    resolution: "1280x720",
    editor: { accent: "#B8B8B8", twitchVisible: true },
  };
}

const EMPTY_EDITOR: EditorState = { accent: "#B8B8B8", twitchVisible: true };

/** Main app: fetch a score, then edit every element and download the PNG. */
export function GeneratorPage() {
  const saved = useMemo(loadSaved, []);

  const [url, setUrl] = useState(saved.url);
  const [resolution, setResolution] = useState<ResolutionPreset>(saved.resolution);
  const [editor, setEditor] = useState<EditorState>(saved.editor ?? EMPTY_EDITOR);
  const [result, setResult] = useState<ThumbnailResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragLayer, setDragLayer] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editingLayer, setEditingLayer] = useState<string | null>(null);

  // History for undo/redo.
  const [history, setHistory] = useState<{ past: EditorState[]; future: EditorState[] }>({
    past: [],
    future: [],
  });
  const editorRef = useRef(editor);
  useEffect(() => {
    editorRef.current = editor;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ url, resolution, editor }));
  }, [url, resolution, editor]);

  /** Full replacement (reset, undo, redo) - never a partial merge. */
  const replaceEditor = (next: EditorState) => setEditor(next);

  /** Push the current state, then apply the patch. push=false for live updates. */
  const mutate = (patch: Partial<EditorState>, push = false) => {
    if (push) {
      setHistory((h) => ({ past: [...h.past.slice(-59), editorRef.current], future: [] }));
    }
    setEditor((prev) => ({ ...prev, ...patch }));
  };

  const undo = () =>
    setHistory(({ past, future }) => {
      if (past.length === 0) return { past, future };
      const prev = past[past.length - 1]!;
      queueMicrotask(() => replaceEditor(prev));
      return { past: past.slice(0, -1), future: [editorRef.current, ...future].slice(0, 60) };
    });

  const redo = () =>
    setHistory(({ past, future }) => {
      if (future.length === 0) return { past, future };
      const next = future[0]!;
      queueMicrotask(() => replaceEditor(next));
      return { past: [...past, editorRef.current], future: future.slice(1) };
    });

  // Keyboard shortcuts: ctrl/cmd+Z undo, ctrl+Y or ctrl+shift+Z redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const base = Object.values(templates)[0]!;
  const template = useMemo(() => applyOverrides(base, editor), [base, editor]);

  const set = (patch: Partial<EditorState>, push = false) => mutate(patch, push);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/thumbnail?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error(await res.text());
      setResult((await res.json()) as ThumbnailResult);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (!result) return;
    setBusy(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, resolution, edits: editor }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `osu-thumbnail-${result.data.beatmapId}-${resolution}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  const previewScale = 700 / template.canvas.width;

  /** Text commits: inline editing routes the bottom message separately. */
  const onTextCommit = (key: string, value: string) => {
    if (key === "__bottom__") {
      set({ bottomText: value });
    } else {
      set({ textOverrides: { ...editor.textOverrides, [key]: value } });
    }
  };

  const onResize = (layer: string, patch: Record<string, number>) =>
    set({ sizeOverrides: { ...editor.sizeOverrides, [layer]: patch } });

  const resetLayer = (layer: string) => {
    pushHistorySnapshot();
    const pos = { ...editor.positionOverrides };
    const size = { ...editor.sizeOverrides };
    const text = { ...editor.textOverrides };
    delete pos[layer];
    delete size[layer];
    delete text[layer];
    replaceEditor({ ...editor, positionOverrides: pos, sizeOverrides: size, textOverrides: text });
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#121013", color: "#e8e2e4", fontFamily: '"Montserrat", sans-serif' }}>
      {/* Left: controls */}
      <div
        style={{
          width: 340,
          flexShrink: 0,
          padding: "24px 20px",
          borderRight: "1px solid #2a2427",
          overflowY: "auto",
          maxHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <h1 style={{ fontFamily: '"Baloo 2", sans-serif', margin: 0, fontSize: 26 }}>osu! thumbnailer</h1>

        <section style={sectionStyle}>
          <h2 style={h2Style}>Score</h2>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://osu.ppy.sh/scores/123456789"
            style={inputStyle}
          />
          <button onClick={generate} disabled={busy || !url} style={{ ...buttonStyle, width: "100%", marginTop: 10 }}>
            {busy ? "Working..." : "Fetch score"}
          </button>
          {error ? <div style={{ color: "#f56", marginTop: 8, fontSize: 13 }}>{error}</div> : null}
          {result ? (
            <div style={{ color: "#9a8f93", marginTop: 8, fontSize: 12 }}>
              {result.mode} mode
              {result.warnings.length > 0 ? ` - ${result.warnings.join("; ")}` : ""}
            </div>
          ) : null}
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>Output</h2>
          <label style={labelStyle}>
            Resolution
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value as ResolutionPreset)}
              style={inputStyle}
            >
              {RESOLUTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label style={{ ...labelStyle, flexDirection: "row", alignItems: "center", gap: 8 }}>
            Accent
            <input
              type="color"
              value={editor.accent ?? "#B8B8B8"}
              onChange={(e) => set({ accent: e.target.value })}
              style={{ width: 46, height: 32, border: "none", background: "none", cursor: "pointer" }}
            />
          </label>
          <label style={{ ...labelStyle, flexDirection: "row", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={editor.twitchVisible ?? true}
              onChange={(e) => set({ twitchVisible: e.target.checked }, true)}
            />
            Twitch logo
          </label>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>Editor</h2>
          <div style={{ color: "#8a7f84", fontSize: 12, lineHeight: 1.6 }}>
            Click an element to select it. Drag to move, corner handles to resize.
            Double-click text to edit it in place. Select text in the bottom
            message and right-click to accent it.
          </div>
          {dragLayer ? (
            <div style={{ color: "#9a8f93", fontSize: 12 }}>Moving: {dragLayer}</div>
          ) : null}
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button onClick={undo} disabled={history.past.length === 0} style={{ ...buttonStyle, flex: 1, background: "#3a3236", padding: "8px 0", fontSize: 13 }} disabled-aria-label="undo">
              Undo (ctrl+Z)
            </button>
            <button onClick={redo} disabled={history.future.length === 0} style={{ ...buttonStyle, flex: 1, background: "#3a3236", padding: "8px 0", fontSize: 13 }}>
              Redo (ctrl+Y)
            </button>
          </div>
          {selected ? (
            <button onClick={() => resetLayer(selected)} style={{ ...buttonStyle, background: "#3a3236", padding: "8px 0", fontSize: 13 }}>
              Reset "{selected}" to default
            </button>
          ) : null}
        </section>

        <button
          onClick={() => {
            // Full replacement (not a merge) so every override is cleared.
            pushHistorySnapshot();
            replaceEditor({
              accent: editor.accent,
              twitchVisible: editor.twitchVisible,
            });
            setSelected(null);
            setEditingLayer(null);
          }}
          style={{ ...buttonStyle, background: "#3a3236", marginTop: "auto" }}
        >
          Reset all edits
        </button>
      </div>

      {/* Right: preview */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          gap: 18,
        }}
      >
        {result ? (
          <>
            <div style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.6)" }}>
              <EditorCanvas
                template={template}
                data={result.data}
                scale={previewScale}
                selected={selected}
                editing={editingLayer}
                onSelect={setSelected}
                onEditStart={(layer) => {
                  pushHistorySnapshot();
                  setEditingLayer(layer);
                }}
                onCancelEdit={() => setEditingLayer(null)}
                onDragStart={pushHistorySnapshot}
                onMove={(layer, x, y) =>
                  set({ positionOverrides: { ...editor.positionOverrides, [layer]: { x, y } } })
                }
                onResizeStart={pushHistorySnapshot}
                onResize={onResize}
                onTextChange={onTextCommit}
                onAccentSelection={(text) => set({ bottomAccent: text || undefined }, true)}
                onInteractEnd={() => setDragLayer(null)}
              />
            </div>
            <button onClick={download} disabled={busy} style={buttonStyle}>
              Download PNG ({resolution})
            </button>
          </>
        ) : (
          <div style={{ color: "#6a5f64" }}>
            Paste a score URL and fetch it to start editing.
          </div>
        )}
      </div>
    </div>
  );

  function pushHistorySnapshot() {
    setHistory((h) => ({ past: [...h.past.slice(-59), editorRef.current], future: [] }));
  }
}

const sectionStyle: React.CSSProperties = {
  background: "#1a1619",
  borderRadius: 12,
  padding: "14px 16px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const h2Style: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: "#a2949a",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 12,
  color: "#c9bfc3",
};

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #3a3236",
  background: "#141013",
  color: "#eee",
  fontFamily: "inherit",
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 22px",
  borderRadius: 8,
  border: "none",
  background: "#9146FF",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

import { useEffect, useMemo, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import "@fontsource/baloo-2/400.css";
import "@fontsource/baloo-2/700.css";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/600.css";
import "flag-icons/css/flag-icons.min.css";
import "../thumbnail/styles.css";
import { templates } from "../thumbnail/templates/registry";
import { applyDataOverrides, applyOverrides, type EditorState } from "../thumbnail/overrides";
import { computeTexts } from "../thumbnail/texts";
import { RESOLUTION_PRESETS, type ResolutionPreset } from "../thumbnail/types";
import type { ThumbnailResult } from "../shared/types/thumbnail";
import { EditorCanvas, getLayerTextStyle, isTextLayer, LAYER_NAMES } from "./EditorCanvas";
import { AccentPicker, ColorPicker } from "./AccentPicker";
import "./styles.css";

const RESOLUTIONS = Object.keys(RESOLUTION_PRESETS) as ResolutionPreset[];
const STORAGE_KEY = "osu-thumbnailer-editor-v1";
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

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

const EMPTY_EDITOR: EditorState = { accent: "#B8B8B8", twitchVisible: false };

/** Main app: fetch a score, then edit every element and download the PNG. */
export function GeneratorPage() {
  const saved = useMemo(loadSaved, []);

  const [url, setUrl] = useState(saved.url);
  const [resolution, setResolution] = useState<ResolutionPreset>(saved.resolution);
  const [editor, setEditor] = useState<EditorState>(saved.editor ?? EMPTY_EDITOR);
  const [result, setResult] = useState<ThumbnailResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editingLayer, setEditingLayer] = useState<string | null>(null);
  const [sliderBreakDraft, setSliderBreakDraft] = useState("0");
  const [missDraft, setMissDraft] = useState("0");
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    let unmounted = false;
    const fetchQueueStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/queue-status`);
        if (res.ok && !unmounted) {
          const data = (await res.json()) as { queuedCount?: number };
          setQueueCount(data.queuedCount ?? 0);
        }
      } catch {
        // Silently ignore queue status fetch errors
      }
    };

    fetchQueueStatus();
    const interval = setInterval(fetchQueueStatus, 5000);
    return () => {
      unmounted = true;
      clearInterval(interval);
    };
  }, []);

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

  // Keyboard shortcuts: ctrl/cmd+D deselect, Z undo, Y or shift+Z redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setEditingLayer(null);
        setSelected(null);
        return;
      }
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
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const base = Object.values(templates)[0]!;
  const template = useMemo(() => applyOverrides(base, editor), [base, editor]);
  const previewData = useMemo(
    () => result ? applyDataOverrides(result.data, editor) : null,
    [result, editor],
  );

  useEffect(() => {
    setSliderBreakDraft(String(editor.sliderBreakCount ?? result?.data.sbCount ?? 0));
    setMissDraft(String(editor.missCount ?? result?.data.missCount ?? 0));
  }, [result, editor.sliderBreakCount, editor.missCount]);

  const set = (patch: Partial<EditorState>, push = false) => mutate(patch, push);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/thumbnail?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Score request failed (${res.status})`);
      }
      setResult((await res.json()) as ThumbnailResult);
      replaceEditor(EMPTY_EDITOR);
      setHistory({ past: [], future: [] });
      setSelected(null);
      setEditingLayer(null);
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
      const root = document.getElementById("thumbnail-root");
      if (!root) throw new Error("Thumbnail preview is unavailable");
      await document.fonts.ready;
      await Promise.all(Array.from(root.querySelectorAll("img")).map((image) => image.decode().catch(() => undefined)));

      const preset = RESOLUTION_PRESETS[resolution];
      const blob = await toBlob(root, {
        backgroundColor: "#141414",
        cacheBust: true,
        pixelRatio: preset.width / template.canvas.width,
        skipAutoScale: true,
      });
      if (!blob) throw new Error("Browser could not create the PNG");

      const bitmap = await createImageBitmap(blob);
      const validSize = bitmap.width === preset.width && bitmap.height === preset.height;
      bitmap.close();
      if (!validSize) throw new Error("Generated PNG dimensions are incorrect");

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
  const selectedTextStyle = selected && isTextLayer(selected)
    ? getLayerTextStyle(selected, template, previewData)
    : null;

  /** Live text updates route the bottom message separately. */
  const onTextChange = (key: string, value: string) => {
    if (key.startsWith("custom-")) {
      set({ customTexts: editor.customTexts?.map((item) => item.id === key ? { ...item, text: value } : item) });
    } else if (key === "__bottom__") {
      set({ bottomText: value });
    } else if (key === "bottom-text") {
      set({ bottomText: value });
    } else {
      set({ textOverrides: { ...editor.textOverrides, [key]: value } });
    }
  };

  const onResize = (layer: string, patch: Record<string, number>) => {
    const { x, y, fontSize, ...size } = patch;
    set({
      positionOverrides: x === undefined || y === undefined
        ? editor.positionOverrides
        : { ...editor.positionOverrides, [layer]: { x, y } },
      sizeOverrides: Object.keys(size).length === 0
        ? editor.sizeOverrides
        : { ...editor.sizeOverrides, [layer]: size },
      fontSizeOverrides: fontSize === undefined
        ? editor.fontSizeOverrides
        : { ...editor.fontSizeOverrides, [layer]: fontSize },
    });
  };

  const onFontSizeChange = (layer: string, size: number) => {
    const validSize = Math.max(10, Math.min(500, Number(size) || 10));
    set({
      fontSizeOverrides: {
        ...editor.fontSizeOverrides,
        [layer]: validSize,
      },
    });
  };

  const onColorChange = (layer: string, color: string) => {
    set({
      colorOverrides: {
        ...editor.colorOverrides,
        [layer]: color,
      },
    });
  };

  const resetLayer = (layer: string) => {
    pushHistorySnapshot();
    const pos = { ...editor.positionOverrides };
    const size = { ...editor.sizeOverrides };
    const text = { ...editor.textOverrides };
    const colors = { ...editor.colorOverrides };
    const fontSizes = { ...editor.fontSizeOverrides };
    delete pos[layer];
    delete size[layer];
    delete colors[layer];
    delete fontSizes[layer];
    if (layer === "status-miss" || layer === "status") {
      delete pos["status"];
      delete pos["status-miss"];
      delete size["status"];
      delete size["status-miss"];
      delete text["status"];
      delete text["status-miss"];
      delete colors["status"];
      delete colors["status-miss"];
      delete fontSizes["status"];
      delete fontSizes["status-miss"];
    } else if (layer === "bottom-message" || layer === "bottom-text") {
      delete pos["bottom-message"];
      delete pos["bottom-text"];
      delete size["bottom-message"];
      delete size["bottom-text"];
      delete text["bottom-message"];
      delete text["bottom-text"];
      delete colors["bottom-message"];
      delete colors["bottom-text"];
      delete fontSizes["bottom-message"];
      delete fontSizes["bottom-text"];
    } else {
      delete text[layer];
    }
    replaceEditor({
      ...editor,
      ...(layer === "bottom-message" || layer === "bottom-text" ? { bottomText: undefined, bottomAccent: undefined } : {}),
      positionOverrides: pos,
      sizeOverrides: size,
      textOverrides: text,
      colorOverrides: colors,
      fontSizeOverrides: fontSizes,
    });
  };

  const addCustomText = () => {
    pushHistorySnapshot();
    const index = editor.customTexts?.length ?? 0;
    const id = `custom-${crypto.randomUUID()}`;
    set({
      customTexts: [...(editor.customTexts ?? []), {
        id,
        text: "Custom text",
        visible: true,
        x: 80,
        y: 350 + index * 64,
        fontFamily: '"Montserrat", sans-serif',
        fontSize: 54,
        fontWeight: 600,
        color: "#FFFFFF",
        glow: { blur: 10, layers: 2 },
      }],
    });
    setSelected(id);
  };

  const removeLayer = (layer: string) => {
    pushHistorySnapshot();
    const positions = { ...editor.positionOverrides };
    const sizes = { ...editor.sizeOverrides };
    const colors = { ...editor.colorOverrides };
    const fontSizes = { ...editor.fontSizeOverrides };
    delete positions[layer];
    delete sizes[layer];
    delete colors[layer];
    delete fontSizes[layer];
    set({
      customTexts: editor.customTexts?.filter((item) => item.id !== layer),
      positionOverrides: positions,
      sizeOverrides: sizes,
      colorOverrides: colors,
      fontSizeOverrides: fontSizes,
    });
    setSelected(null);
    setEditingLayer(null);
  };

  return (
    <div className="app-container">
      {/* Sidebar with Score input and collapsible feature dropdown bars */}
      <div className="app-sidebar">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
          <h1 style={{ fontFamily: '"Baloo 2", sans-serif', margin: 0, fontSize: 24, color: "#ffffff", letterSpacing: "-0.5px" }}>osu! thumbnailer</h1>
          <details style={{ position: "relative", zIndex: 80 }}>
            <summary aria-label="Score data limits" title="Score data limits" style={{ cursor: "pointer", listStyle: "none", width: 24, height: 24, border: "1px solid #444444", borderRadius: "50%", display: "grid", placeItems: "center", color: "#ffffff", fontWeight: 700, fontSize: 12 }}>i</summary>
            <div style={{ position: "absolute", right: 0, top: 32, width: 270, padding: 14, background: "#141414", border: "1px solid #333333", borderRadius: 8, fontSize: 12, lineHeight: 1.5, color: "#cccccc", boxShadow: "0 12px 30px rgba(0,0,0,.8)" }}>
              <strong style={{ color: "#ffffff" }}>Score data limits</strong>
              <p style={{ margin: "8px 0" }}>Classic scores do not provide slider-break counts. Enter the count only if you know it. Otherwise leave it at 0.</p>
              <p style={{ margin: "8px 0" }}>This editor does not calculate PP if FC. Calculate it elsewhere, then add it as custom text.</p>
              <div style={{ display: "grid", gap: 6 }}>
                <a href="https://osu.ppy.sh/docs/" target="_blank" rel="noreferrer" style={{ color: "#ffffff", textDecoration: "underline" }}>osu! API score data</a>
                <a href="https://github.com/MaxOhn/rosu-pp" target="_blank" rel="noreferrer" style={{ color: "#ffffff", textDecoration: "underline" }}>rosu-pp calculation library</a>
              </div>
            </div>
          </details>
        </div>

        {/* Score URL Input & Fetch */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
            <span style={{ fontSize: 13, color: "#888888", fontWeight: 600 }}>Score URL</span>
            <span style={{ fontSize: 12, color: "#888888" }}>Queue: {queueCount}</span>
          </div>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://osu.ppy.sh/scores/123456789"
            style={inputStyle}
          />
          <button onClick={generate} disabled={busy || !url} style={{ ...buttonStyle, width: "100%", marginTop: 8 }}>
            {busy ? "Fetching..." : "Fetch score"}
          </button>
          {error ? <div style={{ color: "#ff4d4d", marginTop: 8, fontSize: 13 }}>{error}</div> : null}
          {result && result.warnings.length > 0 ? (
            <div style={{ color: "#888888", marginTop: 8, fontSize: 12 }}>
              {result.warnings.join(" ")}
            </div>
          ) : null}
        </section>

        {/* Dropdown Bar 1: Play Status & PP */}
        {result ? (
          <details className="feature-dropdown" open>
            <summary>
              <span>Play Status & PP</span>
              <span className="feature-dropdown-arrow">▼</span>
            </summary>
            <div className="feature-dropdown-content">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#888888", fontWeight: 600 }}>Status Preset</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => {
                      pushHistorySnapshot();
                      setMissDraft("0");
                      setSliderBreakDraft("0");
                      set({ missCount: 0, sliderBreakCount: 0, statusKind: "fc" });
                      setSelected("status");
                    }}
                    style={{
                      ...secondaryButtonStyle,
                      background: (previewData?.status.kind === "fc" && (previewData?.sbCount ?? 0) === 0) ? "#ffffff" : "#141414",
                      color: (previewData?.status.kind === "fc" && (previewData?.sbCount ?? 0) === 0) ? "#000000" : "#ffffff",
                      borderColor: (previewData?.status.kind === "fc" && (previewData?.sbCount ?? 0) === 0) ? "#ffffff" : "#2a2a2a",
                      fontWeight: 700,
                      padding: "7px 0",
                    }}
                  >
                    FC
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      pushHistorySnapshot();
                      const nextMiss = Math.max(1, Number(missDraft) || 1);
                      setMissDraft(String(nextMiss));
                      set({ missCount: nextMiss, statusKind: "miss" });
                      setSelected("status-miss");
                    }}
                    style={{
                      ...secondaryButtonStyle,
                      background: (previewData?.status.kind === "miss") ? "#ffffff" : "#141414",
                      color: (previewData?.status.kind === "miss") ? "#000000" : "#ffffff",
                      borderColor: (previewData?.status.kind === "miss") ? "#ffffff" : "#2a2a2a",
                      fontWeight: 700,
                      padding: "7px 0",
                    }}
                  >
                    Miss
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      pushHistorySnapshot();
                      const nextSb = Math.max(1, Number(sliderBreakDraft) || 1);
                      setSliderBreakDraft(String(nextSb));
                      set({ sliderBreakCount: nextSb, statusKind: "unknown" });
                      setSelected("status-sb");
                    }}
                    style={{
                      ...secondaryButtonStyle,
                      background: (previewData?.sbCount ?? 0) > 0 && previewData?.status.kind !== "miss" ? "#ffffff" : "#141414",
                      color: (previewData?.sbCount ?? 0) > 0 && previewData?.status.kind !== "miss" ? "#000000" : "#ffffff",
                      borderColor: (previewData?.sbCount ?? 0) > 0 && previewData?.status.kind !== "miss" ? "#ffffff" : "#2a2a2a",
                      fontWeight: 700,
                      padding: "7px 0",
                    }}
                  >
                    SB
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={labelStyle}>
                  Miss count
                  <input
                    inputMode="numeric"
                    value={missDraft}
                    onFocus={(event) => { pushHistorySnapshot(); event.currentTarget.select(); setSelected("status-miss"); }}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (!/^\d*$/.test(value)) return;
                      setMissDraft(value);
                      if (value !== "") {
                        const num = Number(value);
                        set({ missCount: num, statusKind: num > 0 ? "miss" : undefined });
                      }
                    }}
                    onBlur={() => {
                      const value = String(Math.max(0, Number(missDraft) || 0));
                      setMissDraft(value);
                      const num = Number(value);
                      set({ missCount: num, statusKind: num > 0 ? "miss" : undefined });
                    }}
                    style={inputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  Slider breaks
                  <input
                    inputMode="numeric"
                    value={sliderBreakDraft}
                    onFocus={(event) => { pushHistorySnapshot(); event.currentTarget.select(); setSelected("status-sb"); }}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (!/^\d*$/.test(value)) return;
                      setSliderBreakDraft(value);
                      if (value !== "") {
                        const num = Number(value);
                        set({ sliderBreakCount: num, statusKind: num > 0 && (editor.missCount ?? result.data.missCount) === 0 ? "unknown" : undefined });
                      }
                    }}
                    onBlur={() => {
                      const value = String(Math.max(0, Number(sliderBreakDraft) || 0));
                      setSliderBreakDraft(value);
                      const num = Number(value);
                      set({ sliderBreakCount: num, statusKind: num > 0 && (editor.missCount ?? result.data.missCount) === 0 ? "unknown" : undefined });
                    }}
                    style={inputStyle}
                  />
                </label>
              </div>

              <label style={labelStyle}>
                PP value
                <input
                  placeholder={result.data.pp !== undefined ? `${Math.round(result.data.pp)}PP` : "?PP"}
                  value={editor.textOverrides?.pp ?? ""}
                  onFocus={() => { pushHistorySnapshot(); setSelected("pp"); }}
                  onChange={(event) => {
                    const val = event.target.value;
                    set({ textOverrides: { ...editor.textOverrides, pp: val } });
                  }}
                  style={inputStyle}
                />
              </label>
            </div>
          </details>
        ) : null}

        {/* Dropdown Bar 2: Custom Text & Layer Options */}
        <details className="feature-dropdown" open>
          <summary>
            <span>Custom Text & Layers</span>
            <span className="feature-dropdown-arrow">▼</span>
          </summary>
          <div className="feature-dropdown-content">
            <button onClick={addCustomText} disabled={!result} style={{ ...secondaryButtonStyle, width: "100%", padding: "8px 0" }}>
              + Add custom text
            </button>

            {editor.customTexts && editor.customTexts.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {editor.customTexts.map((item) => (
                  <div key={item.id} style={{ display: "flex", gap: 6 }}>
                    <input
                      value={item.text}
                      onFocus={() => {
                        pushHistorySnapshot();
                        setSelected(item.id);
                      }}
                      onChange={(event) =>
                        set({
                          customTexts: editor.customTexts?.map((current) =>
                            current.id === item.id ? { ...current, text: event.target.value } : current
                          ),
                        })
                      }
                      style={{
                        ...inputStyle,
                        minWidth: 0,
                        borderColor: selected === item.id ? "#ffffff" : undefined,
                      }}
                    />
                    <button
                      onClick={() => removeLayer(item.id)}
                      aria-label="Remove text"
                      style={{ ...secondaryButtonStyle, width: 36, padding: 0 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {selected && isTextLayer(selected) && selectedTextStyle ? (
              <div
                style={{
                  background: "#111111",
                  padding: "12px",
                  borderRadius: 8,
                  border: "1px solid #2a2a2a",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "#ffffff" }}>
                  <span>{LAYER_NAMES[selected] ?? "Custom Text"}</span>
                  <button
                    type="button"
                    onClick={() => (selected.startsWith("custom-") ? removeLayer(selected) : resetLayer(selected))}
                    style={{ background: "none", border: "none", color: "#888888", cursor: "pointer", fontSize: 12, padding: 0, textDecoration: "underline" }}
                  >
                    {selected.startsWith("custom-") ? "Delete" : "Reset"}
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "flex-end" }}>
                  <label style={{ ...labelStyle, margin: 0 }}>
                    <span>Font size (px)</span>
                    <input
                      type="number"
                      min={10}
                      max={500}
                      value={selectedTextStyle.fontSize}
                      onFocus={pushHistorySnapshot}
                      onChange={(e) => onFontSizeChange(selected, Number(e.target.value))}
                      style={{ ...inputStyle, width: "100%", padding: "6px 8px" }}
                    />
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#a0a0a0" }}>
                    <span>Color</span>
                    <ColorPicker
                      color={selectedTextStyle.color}
                      onChange={(color) => onColorChange(selected, color)}
                      label="Text color"
                      align="right"
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </details>

        {/* Dropdown Bar 3: Appearance & Settings */}
        <details className="feature-dropdown">
          <summary>
            <span>Appearance & Settings</span>
            <span className="feature-dropdown-arrow">▼</span>
          </summary>
          <div className="feature-dropdown-content">
            <label style={labelStyle}>
              Resolution
              <select
                className="app-select"
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

            <div role="group" aria-label="Accent" style={{ ...labelStyle, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <span>Accent Color</span>
              <AccentPicker color={editor.accent ?? "#B8B8B8"} onChange={(accent) => set({ accent })} align="right" />
            </div>

            <label style={{ ...labelStyle, flexDirection: "row", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={editor.twitchVisible ?? false}
                onChange={(e) => set({ twitchVisible: e.target.checked }, true)}
              />
              Twitch logo
            </label>

            <button
              onClick={() => {
                pushHistorySnapshot();
                replaceEditor(EMPTY_EDITOR);
                setSliderBreakDraft(String(result?.data.sbCount ?? 0));
                setSelected(null);
                setEditingLayer(null);
              }}
              style={{ ...secondaryButtonStyle, width: "100%", marginTop: 4 }}
            >
              Reset all edits
            </button>
          </div>
        </details>
      </div>

      {/* Right / Preview area (Top on mobile) */}
      <div className="app-preview">
        {result ? (
          <>
            <button
              onClick={download}
              disabled={busy}
              className="download-btn"
              style={{ ...buttonStyle, position: "absolute", top: 16, right: 16, zIndex: 10 }}
            >
              Download PNG ({resolution})
            </button>
            <div style={{ width: "100%", flex: 1, minHeight: 0 }}>
              <EditorCanvas
                template={template}
                data={previewData!}
                scale={previewScale}
                selected={selected}
                editing={editingLayer}
                onSelect={setSelected}
                onEditStart={(layer) => {
                  pushHistorySnapshot();
                  setEditingLayer(layer);
                }}
                onEditEnd={() => setEditingLayer(null)}
                onInteractStart={pushHistorySnapshot}
                onMove={(layer, x, y) =>
                  set({ positionOverrides: { ...editor.positionOverrides, [layer]: { x, y } } })
                }
                onResize={onResize}
                onTextChange={onTextChange}
                onAccentSelection={(text) => set({ bottomAccent: text || undefined }, true)}
                onResetLayer={resetLayer}
                onRemoveLayer={removeLayer}
              />
            </div>
          </>
        ) : (
          <div style={{ color: "#777777", padding: 24, textAlign: "center", fontSize: 14 }}>
            Paste a score URL and click "Fetch score" to edit.
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
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  fontSize: 12,
  color: "#a0a0a0",
};

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 7,
  border: "1px solid #2a2a2a",
  background: "#141414",
  color: "#ffffff",
  fontFamily: "inherit",
  fontSize: 13,
};

const buttonStyle: React.CSSProperties = {
  padding: "9px 18px",
  borderRadius: 7,
  border: "1px solid #ffffff",
  background: "#ffffff",
  color: "#000000",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 13,
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 7,
  border: "1px solid #2a2a2a",
  background: "#141414",
  color: "#ffffff",
  fontWeight: 500,
  cursor: "pointer",
  fontSize: 13,
};

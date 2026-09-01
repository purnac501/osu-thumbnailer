import { useEffect, useMemo, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { Button, ContextMenu, Flex, IconButton, Popover, SegmentedControl, Select, Switch, TextField } from "@radix-ui/themes";
import { DownloadIcon, InfoCircledIcon, PlusIcon, ResetIcon } from "@radix-ui/react-icons";
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
import { EditorCanvas, getLayerTextStyle, getTextKeyForLayer, isTextLayer, LAYER_NAMES } from "./EditorCanvas";
import { AccentPicker, ColorPicker } from "./AccentPicker";
import "./styles.css";

const RESOLUTIONS = Object.keys(RESOLUTION_PRESETS) as ResolutionPreset[];
const STORAGE_KEY = "osu-thumbnailer-editor-v1";
const CLIENT_ID_KEY = "osu-thumbnailer-client-id";
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

function getClientId(): string {
  const saved = localStorage.getItem(CLIENT_ID_KEY);
  if (saved) return saved;
  const id = crypto.randomUUID();
  localStorage.setItem(CLIENT_ID_KEY, id);
  return id;
}

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
  const [sidebarAccentText, setSidebarAccentText] = useState("");
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
      const res = await fetch(`${API_BASE}/api/thumbnail?url=${encodeURIComponent(url)}`, {
        headers: { "X-Client-Id": getClientId() },
      });
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
  const selectedTextKey = selected && isTextLayer(selected) ? getTextKeyForLayer(selected) : null;
  const selectedTextValue = selectedTextKey
    ? selectedTextKey.startsWith("custom-")
      ? editor.customTexts?.find((item) => item.id === selectedTextKey)?.text ?? ""
      : template.textOverrides?.[selectedTextKey]
        ?? (previewData ? computeTexts(previewData, template)[selectedTextKey] : "")
    : "";
  const isFcPreset = previewData?.status.kind === "fc" && (previewData.sbCount ?? 0) === 0;
  const isMissPreset = previewData?.status.kind === "miss";
  const isSbPreset = (previewData?.sbCount ?? 0) > 0 && previewData?.status.kind !== "miss";
  const statusPreset = isFcPreset ? "fc" : isMissPreset ? "miss" : isSbPreset ? "sb" : "";

  const setStatusPreset = (value: string) => {
    if (!value) return;
    pushHistorySnapshot();
    if (value === "fc") {
      setMissDraft("0");
      setSliderBreakDraft("0");
      set({ missCount: 0, sliderBreakCount: 0, statusKind: "fc" });
      setSelected("status");
    } else if (value === "miss") {
      const nextMiss = Math.max(1, Number(missDraft) || 1);
      setMissDraft(String(nextMiss));
      set({ missCount: nextMiss, statusKind: "miss" });
      setSelected("status-miss");
    } else {
      const nextSb = Math.max(1, Number(sliderBreakDraft) || 1);
      setSliderBreakDraft(String(nextSb));
      set({ sliderBreakCount: nextSb, statusKind: "unknown" });
      setSelected("status-sb");
    }
  };

  /** Live text updates route the bottom message separately. */
  const onTextChange = (key: string, value: string) => {
    if (key.startsWith("custom-")) {
      set({ customTexts: editor.customTexts?.map((item) => item.id === key ? { ...item, text: value } : item) });
    } else if (key === "pp") {
      set({ textOverrides: { ...editor.textOverrides, pp: value.match(/\d+(?:\.\d+)?/)?.[0] ?? "" } });
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
    setSelected(null);
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
      <header className="app-toolbar">
        <div className="toolbar-brand">
          <h1>osu! thumbnailer</h1>
          <Popover.Root>
            <Popover.Trigger>
              <IconButton className="help-trigger" aria-label="Score data limits" size="1" variant="soft" color="gray" radius="full">
                <InfoCircledIcon />
              </IconButton>
            </Popover.Trigger>
              <Popover.Content className="help-popover" sideOffset={8} align="start" size="1" width="280px">
              <strong>Score data limits</strong>
              <p>Classic scores do not provide slider-break counts. Enter the count only if you know it. Otherwise leave it at 0.</p>
              <p>This editor does not calculate PP if FC. Add a calculated value as custom text.</p>
              <div className="help-links">
                <a href="https://osu.ppy.sh/docs/" target="_blank" rel="noreferrer">osu! API score data</a>
                <a href="https://github.com/MaxOhn/rosu-pp" target="_blank" rel="noreferrer">rosu-pp calculation library</a>
              </div>
              </Popover.Content>
          </Popover.Root>
        </div>
        <Flex className="toolbar-actions" align="center" gap="2">
          <Select.Root size="2" value={resolution} onValueChange={(value) => setResolution(value as ResolutionPreset)}>
            <Select.Trigger className="toolbar-select" aria-label="Canvas resolution" />
            <Select.Content position="popper">
              {RESOLUTIONS.map((r) => <Select.Item key={r} value={r}>{r}</Select.Item>)}
            </Select.Content>
          </Select.Root>
          {result ? (
            <Button type="button" onClick={download} disabled={busy} className="toolbar-download" size="2" variant="solid" color="gray" highContrast aria-label={busy ? "Preparing PNG" : "Download PNG"}>
              <DownloadIcon />
              <span className="toolbar-download-label">{busy ? "Preparing..." : "Download PNG"}</span>
            </Button>
          ) : null}
        </Flex>
      </header>

      <aside className="app-sidebar" aria-label="Editor controls">

        <section className="sidebar-section score-section" aria-label="Score">
          <label className="field">
            <span className="field-label">Score URL</span>
            <TextField.Root
              className="editor-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://osu.ppy.sh/scores/123456789"
            />
          </label>
          <Button type="button" onClick={generate} disabled={busy || !url} className="fetch-button" size="2" color="gray" highContrast>
            {busy ? "Fetching score..." : "Fetch score"}
          </Button>
          {error ? <div className="error-message" role="alert">{error}</div> : null}
          {result && result.warnings.length > 0 ? (
            <div className="field-note" role="status">{result.warnings.join(" ")}</div>
          ) : null}
        </section>

        {result ? (
          <section className="sidebar-section" aria-label="Play status">
            <div className="field">
              <span className="field-label">Status preset</span>
              <SegmentedControl.Root className="segmented-control" aria-label="Status preset" value={statusPreset} onValueChange={setStatusPreset} size="2">
                <SegmentedControl.Item value="fc">FC</SegmentedControl.Item>
                <SegmentedControl.Item value="miss">Miss</SegmentedControl.Item>
                <SegmentedControl.Item value="sb">SB</SegmentedControl.Item>
              </SegmentedControl.Root>
              </div>

              <div className="field-grid">
                <label className="field">
                  <span className="field-label">Misses</span>
                  <TextField.Root
                    className="editor-input numeric-control"
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
                  />
                </label>
                <label className="field">
                  <span className="field-label">Slider breaks</span>
                  <TextField.Root
                    className="editor-input numeric-control"
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
                  />
                </label>
              </div>

              <label className="field">
                <span className="field-label">PP value</span>
                <TextField.Root
                  className="editor-input"
                  type="number"
                  min="0"
                  inputMode="decimal"
                  placeholder={result.data.pp !== undefined ? String(Math.round(result.data.pp)) : "?"}
                  value={editor.textOverrides?.pp?.replace(/pp$/i, "") ?? ""}
                  onFocus={() => { pushHistorySnapshot(); setSelected("pp"); }}
                  onChange={(event) => onTextChange("pp", event.target.value)}
                />
              </label>
          </section>
        ) : null}

        {result ? <section className="sidebar-section appearance-section" aria-label="Appearance">
          <div className="setting-row">
            <div className="setting-copy">
              <span className="setting-label">Accent color</span>
              <span className="setting-value">{(editor.accent ?? "#B8B8B8").toUpperCase()}</span>
            </div>
            <AccentPicker color={editor.accent ?? "#B8B8B8"} onChange={(accent) => set({ accent })} align="right" />
          </div>
          <div className="setting-row switch-setting">
            <span className="setting-label">Twitch logo</span>
            <Switch
              className="switch-control"
              size="2"
              radius="full"
              checked={editor.twitchVisible ?? false}
              onCheckedChange={(checked) => set({ twitchVisible: checked }, true)}
              aria-label="Twitch logo"
            />
          </div>
          <Button type="button" onClick={addCustomText} className="add-layer-button" size="2" variant="soft" color="gray">
            <PlusIcon /> Add text
          </Button>
          {selected && selectedTextKey && selectedTextStyle ? (
            <div className="layer-inspector">
              <div className="layer-inspector-header">
                <span>{LAYER_NAMES[selected] ?? "Custom text"}</span>
                <Button
                  type="button"
                  onClick={() => (selected.startsWith("custom-") ? removeLayer(selected) : resetLayer(selected))}
                  className="quiet-button" size="1" variant="ghost" color="gray"
                >
                  {selected.startsWith("custom-") ? "Delete" : "Reset"}
                </Button>
              </div>
              <label className="field">
                <span className="field-label">Content</span>
                <ContextMenu.Root>
                  <ContextMenu.Trigger disabled={selected !== "bottom-message" && selected !== "bottom-text"}>
                    <TextField.Root
                      className="editor-input"
                      value={selectedTextValue}
                      onFocus={pushHistorySnapshot}
                      onChange={(event) => onTextChange(selectedTextKey, event.target.value)}
                      onContextMenuCapture={(event) => {
                        const input = event.target as HTMLInputElement;
                        setSidebarAccentText(input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0));
                      }}
                    />
                  </ContextMenu.Trigger>
                  <ContextMenu.Content size="1" style={{ minWidth: 190 }}>
                    <ContextMenu.Item disabled={!sidebarAccentText} onSelect={() => set({ bottomAccent: sidebarAccentText || undefined }, true)}>
                      Apply accent color
                    </ContextMenu.Item>
                    <ContextMenu.Item onSelect={() => set({ bottomAccent: undefined }, true)}>
                      Clear accent color
                    </ContextMenu.Item>
                  </ContextMenu.Content>
                </ContextMenu.Root>
              </label>
              <label className="field">
                <span className="field-label">Font size (px)</span>
                <TextField.Root
                  className="editor-input numeric-control"
                  type="number"
                  min={10}
                  max={500}
                  value={selectedTextStyle.fontSize}
                  onFocus={pushHistorySnapshot}
                  onChange={(event) => onFontSizeChange(selected, Number(event.target.value))}
                />
              </label>
              <div className="setting-row">
                <span className="setting-label">Text color</span>
                <ColorPicker
                  color={selectedTextStyle.color}
                  onChange={(color) => onColorChange(selected, color)}
                  label="Text color"
                  align="right"
                />
              </div>
            </div>
          ) : null}
        </section> : null}

        {result ? <div className="sidebar-footer">
          <Button
            type="button"
            onClick={() => {
              pushHistorySnapshot();
              replaceEditor(EMPTY_EDITOR);
              setSliderBreakDraft(String(result?.data.sbCount ?? 0));
              setSelected(null);
              setEditingLayer(null);
            }}
            className="reset-button" size="2" variant="ghost" color="gray"
          >
            <ResetIcon />
            Reset all edits
          </Button>
        </div> : null}
      </aside>

      <main className="app-preview" aria-label="Thumbnail canvas">
        {result ? (
            <div className="canvas-stage">
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
        ) : (
          <div className="empty-state">
            <p>Paste a score URL and fetch it to start editing.</p>
          </div>
        )}
      </main>
    </div>
  );

  function pushHistorySnapshot() {
    setHistory((h) => ({ past: [...h.past.slice(-59), editorRef.current], future: [] }));
  }
}

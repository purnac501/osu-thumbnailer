import { useEffect, useState } from "react";
import { Thumbnail } from "../thumbnail/Thumbnail";
import { getTemplate } from "../thumbnail/templates/registry";
import { applyDataOverrides, applyOverrides, type EditorState } from "../thumbnail/overrides";
import type { ThumbnailData } from "../shared/types/thumbnail";
export function RenderPage() {
    const params = new URLSearchParams(window.location.search);
    const templateId = params.get("template") ?? "reference";
    const scale = Number(params.get("scale") ?? "1");
    const fixture = params.get("fixture");
    const url = params.get("url");
    let state: EditorState = {};
    const editsParam = params.get("edits");
    if (editsParam) {
        try {
            state = JSON.parse(editsParam) as EditorState;
        }
        catch {
            state = {};
        }
    }
    else {
        state = {
            accent: params.get("accent") ?? undefined,
            twitchVisible: params.has("twitch") ? params.get("twitch") === "true" : undefined,
            bottomText: params.get("bottomPrefix") ?? undefined,
            bottomAccent: params.get("bottomHighlight") ?? undefined,
        };
    }
    const template = applyOverrides(getTemplate(templateId), state);
    const [data, setData] = useState<ThumbnailData | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        const load = async () => {
            try {
                if (fixture) {
                    const res = await fetch(`/api/fixture/${fixture}`);
                    if (!res.ok)
                        throw new Error(await res.text());
                    const json = (await res.json()) as {
                        data: ThumbnailData;
                    };
                    setData(json.data);
                }
                else if (url) {
                    const res = await fetch(`/api/thumbnail?url=${encodeURIComponent(url)}`);
                    if (!res.ok)
                        throw new Error(await res.text());
                    const json = (await res.json()) as {
                        data: ThumbnailData;
                    };
                    setData(json.data);
                }
            }
            catch (err) {
                setError(String(err));
            }
        };
        void load();
    }, [fixture, url]);
    if (error) {
        return <div style={{ color: "#f55", padding: 20 }}>Render error: {error}</div>;
    }
    if (!data) {
        return <div style={{ padding: 20 }}>Loading data...</div>;
    }
    return <Thumbnail data={applyDataOverrides(data, state)} template={template} scale={scale} markReady/>;
}

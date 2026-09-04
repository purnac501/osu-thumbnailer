import type { ThumbnailTemplate } from "../types";
import { referenceTemplate } from "./reference/template";
import { cuteTemplate } from "./cute/template";
export const templates: Record<string, ThumbnailTemplate> = {
    reference: referenceTemplate,
    cute: cuteTemplate,
};
export function getTemplate(id: string): ThumbnailTemplate {
    const template = templates[id];
    if (!template) {
        throw new Error(`Unknown template: ${id}. Available: ${Object.keys(templates).join(", ")}`);
    }
    return template;
}

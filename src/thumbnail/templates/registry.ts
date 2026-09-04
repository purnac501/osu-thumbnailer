import type { ThumbnailTemplate } from "../types";
import { referenceTemplate } from "./reference/template";
import { cuteTemplate } from "./cute/template";
import { showcaseTemplate } from "./showcase/template";
import { adaptableTemplate } from "./adaptable/template";
export const templates: Record<string, ThumbnailTemplate> = {
    showcase: showcaseTemplate,
    adaptable: adaptableTemplate,
    cute: cuteTemplate,
    reference: referenceTemplate,
};
export function getTemplate(id: string): ThumbnailTemplate {
    const template = templates[id];
    if (!template) {
        throw new Error(`Unknown template: ${id}. Available: ${Object.keys(templates).join(", ")}`);
    }
    return template;
}

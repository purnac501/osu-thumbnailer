import type { ThumbnailTemplate } from "../types";
import { referenceTemplate } from "./reference/template";

/** Template registry. Add new templates here; nothing else needs to change. */
export const templates: Record<string, ThumbnailTemplate> = {
  reference: referenceTemplate,
};

export function getTemplate(id: string): ThumbnailTemplate {
  const template = templates[id];
  if (!template) {
    throw new Error(`Unknown template: ${id}. Available: ${Object.keys(templates).join(", ")}`);
  }
  return template;
}

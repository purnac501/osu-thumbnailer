import { describe, expect, it } from "vitest";
import {
  getLayerTextStyle,
  getTextKeyForLayer,
  isTextLayer,
} from "../src/client/EditorCanvas";
import { referenceFixtureThumbnail } from "../src/server/data/fixtures";
import { referenceTemplate } from "../src/thumbnail/templates/reference/template";

describe("getLayerTextStyle", () => {
  it("falls back for missing and unknown layers", () => {
    expect(getLayerTextStyle(null, referenceTemplate)).toEqual({ fontSize: 48, color: "#FFFFFF" });
    expect(getLayerTextStyle("nope", referenceTemplate)).toEqual({ fontSize: 48, color: "#FFFFFF" });
  });

  it("reads sizes and colors from the matching component", () => {
    expect(getLayerTextStyle("pp", referenceTemplate)).toEqual({
      fontSize: referenceTemplate.components.pp.fontSize,
      color: referenceTemplate.components.pp.color,
    });
    expect(getLayerTextStyle("status-sb", referenceTemplate)).toEqual({
      fontSize: referenceTemplate.components.statusSB.fontSize,
      color: referenceTemplate.components.statusSB.color,
    });
    expect(getLayerTextStyle("username", referenceTemplate)).toEqual({
      fontSize: referenceTemplate.components.usernamePanel.fontSize,
      color: referenceTemplate.components.usernamePanel.color,
    });
    expect(getLayerTextStyle("bottom-message", referenceTemplate)).toEqual({
      fontSize: referenceTemplate.components.bottomMessage.fontSize,
      color: referenceTemplate.components.bottomMessage.prefixColor,
    });
  });

  it("switches the status style when the play is not FC", () => {
    expect(getLayerTextStyle("status", referenceTemplate, referenceFixtureThumbnail)).toEqual({
      fontSize: referenceTemplate.components.status.fontSize,
      color: referenceTemplate.components.status.color,
    });
    const missed = { ...referenceFixtureThumbnail, status: { kind: "miss", count: 2 } as const };
    expect(getLayerTextStyle("status", referenceTemplate, missed)).toEqual({
      fontSize: referenceTemplate.components.statusMiss.fontSize,
      color: referenceTemplate.components.statusMiss.color,
    });
  });
});

describe("layer text keys", () => {
  it("maps layers to text keys and detects text layers", () => {
    expect(getTextKeyForLayer("status-miss")).toBe("status");
    expect(getTextKeyForLayer("pp")).toBe("pp");
    expect(isTextLayer("pp")).toBe(true);
    expect(isTextLayer("custom-1")).toBe(true);
    expect(isTextLayer("avatar")).toBe(false);
    expect(isTextLayer(null)).toBe(false);
  });
});

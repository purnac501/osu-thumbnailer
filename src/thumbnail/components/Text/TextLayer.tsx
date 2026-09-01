import type { CSSProperties } from "react";
import type { TextLayerConfig } from "../../types";
import { fitFontSize } from "./fit";
import { softGlow, TEXT_SHADOW_3D } from "../../../shared/formatting/color";

/** Configurable text element: position, font, color, shadow/glow, alignment. */
export function TextLayer({
  config,
  children,
  testId,
}: {
  config: TextLayerConfig;
  children: string;
  testId?: string;
}) {
  if (!config.visible || children === "") return null;

  const fontSize =
    config.maxWidth !== undefined
      ? fitFontSize(children, config, config.maxWidth)
      : config.fontSize;

  // Glow defaults to the text color and fades out with distance.
  const glow = config.glow
    ? softGlow(config.glow.color ?? config.color, config.glow.blur, config.glow.layers ?? 3)
    : undefined;

  const shadow = config.shadow
    ? `${config.shadow.offsetX}px ${config.shadow.offsetY}px ${config.shadow.blur}px ${config.shadow.color}`
    : TEXT_SHADOW_3D;

  const style: CSSProperties = {
    position: "absolute",
    left: config.x,
    top: config.y,
    width: config.width,
    height: config.height,
    fontFamily: config.fontFamily,
    fontSize,
    fontWeight: config.fontWeight,
    letterSpacing: config.letterSpacing,
    lineHeight: config.lineHeight ?? 1.1,
    color: config.color,
    textAlign: config.align ?? "left",
    textTransform: config.textTransform ?? "none",
    textShadow: [shadow, glow].filter(Boolean).join(", ") || undefined,
    whiteSpace: "pre",
    ...(config.valign === "center" && config.height
      ? { display: "flex", alignItems: "center", justifyContent: config.align === "center" ? "center" : config.align === "right" ? "flex-end" : "flex-start" }
      : {}),
  };

  return (
    <div style={style} data-layer={testId}>
      {children}
    </div>
  );
}

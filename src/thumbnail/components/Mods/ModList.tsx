import { useState } from "react";
import type { NormalizedMod } from "../../../shared/types/thumbnail";
import { modAssetPath } from "../../../shared/mods/mods";
import type { ModListConfig } from "../../types";

/**
 * Mod tile colors, taken from the official osu! web palette (mod categories,
 * hsl(<hue>,100%,70%)). See docs/ASSETS.md for provenance.
 */
export const MOD_CATEGORY_COLORS: Record<string, { bg: string; fg: "dark" | "light" }> = {
  // DifficultyReduction (lime)
  EZ: { bg: "#99FF4D", fg: "dark" },
  NF: { bg: "#99FF4D", fg: "dark" },
  HT: { bg: "#99FF4D", fg: "dark" },
  DC: { bg: "#99FF4D", fg: "dark" },
  // DifficultyIncrease (red)
  HR: { bg: "#FF4D4D", fg: "light" },
  SD: { bg: "#FF4D4D", fg: "light" },
  PF: { bg: "#FF4D4D", fg: "light" },
  DT: { bg: "#FF4D4D", fg: "light" },
  NC: { bg: "#FF4D4D", fg: "light" },
  FL: { bg: "#FF4D4D", fg: "light" },
  HD: { bg: "#FF4D4D", fg: "light" },
  // Automation (blue)
  RX: { bg: "#4DC3FF", fg: "light" },
  AP: { bg: "#4DC3FF", fg: "light" },
  // Conversion (purple)
  MR: { bg: "#8C5CFF", fg: "light" },
  V2: { bg: "#8C5CFF", fg: "light" },
  // Fun (pink)
  FI: { bg: "#FF4D9A", fg: "light" },
};

const FALLBACK_COLOR = { bg: "#8C5CFF", fg: "light" } as const;

function resolveColor(
  acronym: string,
  overrides: ModListConfig["modColors"],
): { bg: string; fg: "dark" | "light" } {
  return (
    overrides?.[acronym.toUpperCase()] ??
    MOD_CATEGORY_COLORS[acronym.toUpperCase()] ??
    FALLBACK_COLOR
  );
}

/**
 * A single graphical mod badge using the official osu! web SVG glyphs
 * (white artwork) on a colored tile. Unknown acronyms fall back to a
 * text badge so nothing disappears.
 */
export function ModIcon({
  mod,
  size,
  radius,
  glow,
  allowFallback,
  colorOverrides,
}: {
  mod: NormalizedMod;
  size: number;
  radius: number;
  glow?: { color: string; blur: number };
  allowFallback: boolean;
  colorOverrides?: ModListConfig["modColors"];
}) {
  const asset = modAssetPath(mod.acronym);
  const color = resolveColor(mod.acronym, colorOverrides);
  // White glyph artwork; darken the glyph only, never the tile.
  const imgFilter = color.fg === "dark" ? "brightness(0.15)" : undefined;
  const tileFilter = glow ? `drop-shadow(0 0 ${glow.blur}px ${glow.color})` : undefined;

  if (asset) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          background: color.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          filter: tileFilter,
        }}
        title={mod.name ?? mod.acronym}
      >
        {/* Glyph fills the tile; the SVG's own internal margins provide spacing. */}
        <img
          src={asset}
          alt={mod.acronym}
          style={{ width: "100%", height: "100%", objectFit: "cover", filter: imgFilter }}
        />
      </div>
    );
  }

  if (!allowFallback) return null;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: color.bg,
        color: color.fg === "dark" ? "#221510" : "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
        fontWeight: 700,
        fontSize: size * 0.34,
        filter: tileFilter,
      }}
      title={mod.acronym}
    >
      {mod.acronym}
    </div>
  );
}

/** Horizontal list of mod icons; spacing/size/glow come from template config. */
export function ModList({
  mods,
  config,
}: {
  mods: NormalizedMod[];
  config: ModListConfig;
}) {
  if (!config.visible || mods.length === 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: config.x,
        top: config.y,
        display: "flex",
        opacity: config.opacity ?? 1,
      }}
      data-layer="mod-list"
    >
      {mods.map((mod, i) => (
        <div key={`${mod.acronym}-${i}`} style={{ marginLeft: i > 0 ? config.gap : 0, zIndex: i }}>
          <ModIcon
            mod={mod}
            size={config.iconSize}
            radius={config.radius}
            glow={config.glow}
            allowFallback={config.fallbackAcronyms}
            colorOverrides={config.modColors}
          />
        </div>
      ))}
    </div>
  );
}

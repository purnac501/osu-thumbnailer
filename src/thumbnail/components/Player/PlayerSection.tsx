import type { AvatarConfig, CountryFlagConfig, BadgeLayerConfig } from "../../types";
import { BadgeLayer } from "../Panels/Panels";
import { layerStyle } from "../Layer";

/** Player avatar as its own component; flag is a separate overlapping layer. */
export function Avatar({
  url,
  config,
}: {
  url?: string;
  config: AvatarConfig;
}) {
  if (!config.visible) return null;
  return (
    <div
      style={layerStyle(config, {
        width: config.width,
        height: config.height,
        borderRadius: config.radius,
        border: config.border ? `${config.border.width}px solid ${config.border.color}` : undefined,
        boxShadow: config.shadow
          ? `${config.shadow.x}px ${config.shadow.y}px ${config.shadow.blur}px ${config.shadow.color}`
          : undefined,
        overflow: "hidden",
        background: "rgba(255,255,255,0.06)",
      })}
      data-layer="avatar"
    >
      {url ? (
        <img
          src={url}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: config.objectFit }}
        />
      ) : null}
    </div>
  );
}

/**
 * Country flag rendered from the flag-icons dataset (local CSS, bundled SVGs).
 * Sized/positioned independently so it can overlap the avatar bottom.
 */
export function CountryFlag({
  countryCode,
  config,
}: {
  countryCode?: string;
  config: CountryFlagConfig;
}) {
  if (!config.visible || !countryCode) return null;
  return (
    <div
      style={layerStyle(config, {
        width: config.width,
        height: config.height,
        borderRadius: config.radius,
        border: config.border ? `${config.border.width}px solid ${config.border.color}` : undefined,
        overflow: "hidden",
        boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
      })}
      data-layer="country-flag"
    >
      <span
        className={`fi fi-${countryCode.toLowerCase()}`}
        style={{ display: "block", width: "100%", height: "100%", backgroundSize: "cover" }}
      />
    </div>
  );
}

/** Username panel: a badge with left-aligned text. */
export function UsernamePanel({
  username,
  config,
}: {
  username: string;
  config: BadgeLayerConfig;
}) {
  return (
    <BadgeLayer config={config} testId="username">
      {username}
    </BadgeLayer>
  );
}

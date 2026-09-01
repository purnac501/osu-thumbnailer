import { useEffect, useState } from "react";
import { IconButton, Popover, TextField } from "@radix-ui/themes";
import { HexColorPicker } from "react-colorful";

export function ColorPicker({
  color,
  onChange,
  label = "Color",
  align = "left",
}: {
  color: string;
  onChange: (color: string) => void;
  label?: string;
  align?: "left" | "right";
}) {
  const [hexDraft, setHexDraft] = useState(color.replace(/^#/, "").toUpperCase());

  useEffect(() => {
    setHexDraft(color.replace(/^#/, "").toUpperCase());
  }, [color]);

  return (
    <Popover.Root>
      <Popover.Trigger>
        <IconButton type="button" variant="ghost" color="gray" size="2" aria-label={`${label} ${color}`}>
          <span className="accent-swatch" style={{ backgroundColor: color }} />
        </IconButton>
      </Popover.Trigger>
      <Popover.Content className="accent-popover" size="2" width="220px" align={align === "right" ? "end" : "start"} sideOffset={6}>
          <HexColorPicker color={color} onChange={onChange} />
          <TextField.Root
            className="accent-hex-field"
            size="2"
            aria-label={`${label} hex color`}
            value={hexDraft}
            maxLength={6}
            onChange={(event) => {
              const value = event.target.value.replace(/[^0-9a-f]/gi, "").toUpperCase();
              setHexDraft(value);
              if (value.length === 6) onChange(`#${value}`);
            }}
            onBlur={() => setHexDraft(color.replace(/^#/, "").toUpperCase())}
          >
            <TextField.Slot>#</TextField.Slot>
          </TextField.Root>
      </Popover.Content>
    </Popover.Root>
  );
}

export const AccentPicker = ColorPicker;

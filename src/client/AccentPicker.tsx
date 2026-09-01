import { useEffect, useRef, useState } from "react";
import { HexColorInput, HexColorPicker } from "react-colorful";

export function AccentPicker({
  color,
  onChange,
}: {
  color: string;
  onChange: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div className="accent-picker" ref={root}>
      <button
        type="button"
        className="accent-swatch"
        style={{ backgroundColor: color }}
        aria-label={`Accent color ${color}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      />
      {open ? (
        <div className="accent-popover">
          <HexColorPicker color={color} onChange={onChange} />
          <div className="accent-hex-row">
            <span>#</span>
            <HexColorInput color={color} onChange={onChange} aria-label="Accent hex color" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

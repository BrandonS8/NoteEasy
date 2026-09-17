import { useState } from "react";

const FONTS = [
  "Consolas",
  "Cascadia Mono",
  "Courier New",
  "Lucida Console",
  "Segoe UI",
  "Arial",
  "Times New Roman",
];

const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 36, 48, 72];

export default function FontDialog({ fontFamily, fontSize, onCancel, onApply }) {
  const [family, setFamily] = useState(fontFamily);
  const [size, setSize] = useState(fontSize);

  return (
    <div className="font-dialog-backdrop" onClick={onCancel}>
      <div
        className="font-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Font"
      >
        <label>
          Font
          <select value={family} onChange={(e) => setFamily(e.target.value)}>
            {FONTS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label>
          Size
          <select
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <div className="font-dialog-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" onClick={() => onApply({ family, size })}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

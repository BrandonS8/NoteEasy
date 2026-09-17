import { useEffect, useRef, useState } from "react";
import StylePicker from "./StylePicker.jsx";

const MAIN_HIGHLIGHTS = [
  { id: "yellow", color: "#ffeb3b", title: "Yellow" },
  { id: "green", color: "#c8e6c9", title: "Green" },
  { id: "pink", color: "#ffcdd2", title: "Pink" },
];

const MORE_HIGHLIGHTS = [
  { id: "blue", color: "#bbdefb", title: "Blue" },
  { id: "orange", color: "#ffe0b2", title: "Orange" },
  { id: "purple", color: "#e1bee7", title: "Purple" },
  { id: "gray", color: "#e0e0e0", title: "Gray" },
];

const TEXT_COLORS = [
  { id: "black", color: "#000000", title: "Black" },
  { id: "gray", color: "#616161", title: "Gray" },
  { id: "red", color: "#c62828", title: "Red" },
  { id: "orange", color: "#ef6c00", title: "Orange" },
  { id: "green", color: "#2e7d32", title: "Green" },
  { id: "blue", color: "#1565c0", title: "Blue" },
  { id: "purple", color: "#6a1b9a", title: "Purple" },
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 36, 48, 72];

function sameColor(a, b) {
  if (!a || !b) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

function toHex(color) {
  if (!color || typeof color !== "string") return "#000000";
  const c = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(c)) {
    return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`.toLowerCase();
  }
  return "#000000";
}

/** Compact Notepad-style format toolbar — formats the selection. */
export default function FormatToolbar({
  onAction,
  active,
  selectionFontSize,
  baseFontSize = 14,
}) {
  const a = active || {};
  const size = selectionFontSize || baseFontSize;
  const [openMenu, setOpenMenu] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpenMenu(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function toggle(menu) {
    setOpenMenu((cur) => (cur === menu ? null : menu));
  }

  function pick(action, payload) {
    onAction(action, payload);
    setOpenMenu(null);
  }

  const textColor = a.textColor || "#000000";
  const highlightColor = a.highlightColor;

  return (
    <div className="format-toolbar-row" ref={rootRef}>
      <div className="format-toolbar" role="toolbar" aria-label="Formatting">
        <StylePicker
          value={a.docStyle || "body"}
          onChange={(id) => onAction("setDocStyle", id)}
        />

        <div className="format-sep" />

        <select
          className="font-size-select"
          title="Font size"
          value={size}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => onAction("setFontSize", Number(e.target.value))}
        >
          {!FONT_SIZES.includes(size) && <option value={size}>{size}</option>}
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <div className="format-sep" />

        {/* Lists dropdown */}
        <div className="tb-dropdown">
          <button
            type="button"
            className={`fmt-btn split-btn${a.bulletList || a.orderedList ? " active" : ""}`}
            title="Lists"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggle("list")}
          >
            <ListIcon />
            <Chevron />
          </button>
          {openMenu === "list" && (
            <div className="tb-menu">
              <button
                type="button"
                className={`tb-menu-item${a.bulletList ? " active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick("bulletList")}
              >
                Bulleted list
              </button>
              <button
                type="button"
                className={`tb-menu-item${a.orderedList ? " active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick("orderedList")}
              >
                Numbered list
              </button>
            </div>
          )}
        </div>

        <div className="format-sep" />

        <button
          type="button"
          className={`fmt-btn${a.bold ? " active" : ""}`}
          title="Bold"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAction("bold")}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={`fmt-btn${a.italic ? " active" : ""}`}
          title="Italic"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAction("italic")}
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className={`fmt-btn${a.strike ? " active" : ""}`}
          title="Strikethrough"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAction("strike")}
        >
          <span className="strike-label">S</span>
        </button>

        <div className="format-sep" />

        {/* Text color: one chip + more */}
        <div className="tb-dropdown">
          <button
            type="button"
            className="fmt-btn color-chip-btn"
            title="Font color"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggle("color")}
          >
            <span className="color-chip" style={{ background: textColor }} />
            <Chevron />
          </button>
          {openMenu === "color" && (
            <div className="tb-menu color-menu">
              <div className="tb-menu-grid">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`swatch-btn${sameColor(textColor, c.color) ? " active" : ""}`}
                    title={c.title}
                    style={{ background: c.color }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick("setTextColor", c.color)}
                  />
                ))}
              </div>
              <label className="tb-menu-item custom-row">
                Custom…
                <input
                  type="color"
                  value={toHex(textColor)}
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) => pick("setTextColor", e.target.value)}
                />
              </label>
              <button
                type="button"
                className="tb-menu-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick("clearTextColor")}
              >
                Automatic
              </button>
            </div>
          )}
        </div>

        <div className="format-sep" />

        {/* 3 highlights + more */}
        {MAIN_HIGHLIGHTS.map((h) => (
          <button
            key={h.id}
            type="button"
            className={`fmt-btn highlight-swatch${
              a.highlight && sameColor(highlightColor, h.color) ? " active" : ""
            }`}
            title={h.title}
            style={{ "--swatch": h.color }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onAction("highlight", h.color)}
          >
            <span className="swatch" />
          </button>
        ))}

        <div className="tb-dropdown">
          <button
            type="button"
            className="fmt-btn split-btn"
            title="More highlight colors"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggle("highlight")}
          >
            <span
              className="swatch mini"
              style={{
                background:
                  highlightColor &&
                  !MAIN_HIGHLIGHTS.some((h) => sameColor(highlightColor, h.color))
                    ? highlightColor
                    : "conic-gradient(#ffeb3b, #c8e6c9, #bbdefb, #ffcdd2)",
              }}
            />
            <Chevron />
          </button>
          {openMenu === "highlight" && (
            <div className="tb-menu color-menu">
              <div className="tb-menu-grid">
                {MORE_HIGHLIGHTS.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    className={`swatch-btn${
                      a.highlight && sameColor(highlightColor, h.color)
                        ? " active"
                        : ""
                    }`}
                    title={h.title}
                    style={{ background: h.color }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick("highlight", h.color)}
                  />
                ))}
              </div>
              <label className="tb-menu-item custom-row">
                Custom…
                <input
                  type="color"
                  value={toHex(highlightColor || "#ffeb3b")}
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) => pick("highlight", e.target.value)}
                />
              </label>
              <button
                type="button"
                className="tb-menu-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick("clearHighlight")}
              >
                No highlight
              </button>
            </div>
          )}
        </div>

        <div className="format-sep" />

        <button
          type="button"
          className="fmt-btn"
          title="Clear formatting"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAction("clearFormatting")}
        >
          <ClearFormatIcon />
        </button>
      </div>
    </div>
  );
}

function Chevron() {
  return (
    <svg className="chevron" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
      <path d="M1.5 2.5 L4 5.5 L6.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="3" cy="4" r="1.15" fill="currentColor" />
      <rect x="6" y="3.2" width="8" height="1.5" rx="0.4" fill="currentColor" />
      <circle cx="3" cy="8" r="1.15" fill="currentColor" />
      <rect x="6" y="7.2" width="8" height="1.5" rx="0.4" fill="currentColor" />
      <circle cx="3" cy="12" r="1.15" fill="currentColor" />
      <rect x="6" y="11.2" width="8" height="1.5" rx="0.4" fill="currentColor" />
    </svg>
  );
}

function ClearFormatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <text x="1" y="11" fontSize="11" fontFamily="Segoe UI, sans-serif" fontWeight="700" fill="currentColor">
        A
      </text>
      <text x="7" y="12" fontSize="9" fontFamily="Segoe UI, sans-serif" fill="currentColor">
        b
      </text>
      <path d="M10 3 L14 7 L12.5 8.5 L8.5 4.5 Z" fill="#888" />
      <path d="M8 13 H15" stroke="#c62828" strokeWidth="1.4" />
    </svg>
  );
}

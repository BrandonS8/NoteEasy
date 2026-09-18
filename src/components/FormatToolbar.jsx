import { useEffect, useRef, useState } from "react";
import StylePicker from "./StylePicker.jsx";

const MAIN_HIGHLIGHTS = [
  { id: "yellow", color: "#ffeb3b", title: "Yellow" },
  { id: "blue", color: "#bbdefb", title: "Blue" },
  { id: "pink", color: "#ffcdd2", title: "Pink" },
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

export const CTX_HIGHLIGHTS = MAIN_HIGHLIGHTS;

export function sameColor(a, b) {
  if (!a || !b) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

export function toHex(color, fallback = "#000000") {
  if (!color || typeof color !== "string") return fallback;
  const c = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(c)) {
    return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`.toLowerCase();
  }
  return fallback;
}

function isPresetHighlight(color) {
  return MAIN_HIGHLIGHTS.some((h) => sameColor(h.color, color));
}

function isPresetTextColor(color) {
  return TEXT_COLORS.some((c) => sameColor(c.color, color));
}

function zoomToFactor(zoom) {
  const n = Number(zoom);
  if (!Number.isFinite(n)) return "1.0x";
  const factor = n / 100;
  return `${factor.toFixed(1)}x`;
}

function parseZoomDraft(draft) {
  const raw = String(draft).trim().replace(/x$/i, "").replace(/%$/, "");
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Allow typing percent (e.g. 110) or factor (e.g. 1.1)
  if (n > 10) return Math.round(n);
  return Math.round(n * 100);
}

/** Open the native color picker anchored to a toolbar/menu control. */
export function openNativeColorPicker(input, anchorEl, hex) {
  if (!input) return;
  input.value = toHex(hex, input.value || "#000000");
  const r =
    anchorEl?.getBoundingClientRect?.() ||
    ({ left: 8, top: 8, width: 28, height: 28 });
  input.classList.add("is-open");
  Object.assign(input.style, {
    left: `${Math.round(r.left)}px`,
    top: `${Math.round(r.top)}px`,
    width: `${Math.max(Math.round(r.width), 28)}px`,
    height: `${Math.max(Math.round(r.height), 28)}px`,
  });
  const open = () => {
    try {
      if (typeof input.showPicker === "function") input.showPicker();
      else input.click();
    } catch {
      input.click();
    }
  };
  requestAnimationFrame(open);
  const done = () => {
    input.classList.remove("is-open");
    input.removeEventListener("blur", done);
    input.removeEventListener("change", done);
  };
  input.addEventListener("blur", done);
  input.addEventListener("change", done);
}

/** Main toolbar: file actions, formatting, find, zoom, dark mode. */
export default function FormatToolbar({
  onAction,
  active,
  selectionFontSize,
  baseFontSize = 14,
  lastCustomHighlight = "#c8e6c9",
  lastCustomTextColor = "#00897b",
  darkMode = false,
  zoom = 100,
  findOpen = false,
  textColorInputRef,
  highlightColorInputRef,
}) {
  const a = active || {};
  const size = selectionFontSize || baseFontSize;
  const [openMenu, setOpenMenu] = useState(null);
  // Local highlight UI so clicks update instantly (editor format sync can lag).
  const [hlUi, setHlUi] = useState(null); // null = follow props; { on, color }
  const [markUi, setMarkUi] = useState(null); // null = follow props; { bold?, italic?, strike? }
  const [zoomDraft, setZoomDraft] = useState(() => zoomToFactor(zoom));
  const rootRef = useRef(null);
  const customTextSwatchRef = useRef(null);
  const customHighlightPickRef = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (e.target?.closest?.(".sr-color-input")) return;
      if (!rootRef.current?.contains(e.target)) setOpenMenu(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Drop local override once parent formats match what we clicked
  useEffect(() => {
    if (!hlUi) return;
    const matches = hlUi.on
      ? a.highlight && sameColor(a.highlightColor, hlUi.color)
      : !a.highlight;
    if (matches) setHlUi(null);
  }, [a.highlight, a.highlightColor, hlUi]);

  useEffect(() => {
    if (!markUi) return;
    const keys = Object.keys(markUi);
    const matches = keys.every((k) => !!a[k] === !!markUi[k]);
    if (matches) setMarkUi(null);
  }, [a.bold, a.italic, a.strike, markUi]);

  useEffect(() => {
    setZoomDraft(zoomToFactor(zoom));
  }, [zoom]);

  function toggleMark(action) {
    setMarkUi((prev) => {
      const base = {
        bold: !!a.bold,
        italic: !!a.italic,
        strike: !!a.strike,
        ...(prev || {}),
      };
      return { ...base, [action]: !base[action] };
    });
    onAction(action);
  }

  function toggle(menu) {
    setOpenMenu((cur) => (cur === menu ? null : menu));
  }

  function pick(action, payload) {
    onAction(action, payload);
    setOpenMenu(null);
  }

  function applyHighlight(color) {
    setHlUi({ on: true, color });
    onAction("highlight", color);
  }

  function clearHighlight() {
    setHlUi({ on: false, color: null });
    onAction("clearHighlight");
  }

  function openCustomHighlightPicker(e) {
    openNativeColorPicker(
      highlightColorInputRef?.current,
      e?.currentTarget || customHighlightPickRef.current,
      lastCustomHighlight,
    );
    setOpenMenu(null);
  }

  function openCustomTextColorPicker(e) {
    openNativeColorPicker(
      textColorInputRef?.current,
      e?.currentTarget || customTextSwatchRef.current,
      lastCustomTextColor,
    );
  }

  function commitZoom() {
    const percent = parseZoomDraft(zoomDraft);
    if (percent == null) {
      setZoomDraft(zoomToFactor(zoom));
      return;
    }
    onAction("setZoom", percent);
  }

  const textColor = a.textColor || "#000000";
  const displayColor =
    a.textColor || (darkMode ? "#e8e8e8" : "#000000");
  const highlightOn = hlUi ? hlUi.on : !!a.highlight;
  const highlightColor = hlUi ? hlUi.color : a.highlightColor;
  const boldOn = markUi && "bold" in markUi ? !!markUi.bold : !!a.bold;
  const italicOn =
    markUi && "italic" in markUi ? !!markUi.italic : !!a.italic;
  const strikeOn =
    markUi && "strike" in markUi ? !!markUi.strike : !!a.strike;
  const customHighlightActive =
    highlightOn &&
    highlightColor &&
    sameColor(highlightColor, lastCustomHighlight) &&
    !isPresetHighlight(highlightColor);
  const customTextActive =
    a.textColor &&
    sameColor(a.textColor, lastCustomTextColor) &&
    !isPresetTextColor(lastCustomTextColor);

  return (
    <div className="format-toolbar-row" ref={rootRef}>
      <div className="toolbar-side toolbar-left">
        <button
          type="button"
          className="fmt-btn"
          title="Open"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAction("open")}
        >
          <OpenIcon />
        </button>

        <div className="tb-dropdown">
          <div className="custom-highlight-box save-split">
            <button
              type="button"
              className="fmt-btn custom-main save-main"
              title="Save"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onAction("save")}
            >
              <SaveIcon />
            </button>
            <button
              type="button"
              className="fmt-btn custom-pick"
              title="Save options"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggle("save")}
            >
              <Chevron />
            </button>
          </div>
          {openMenu === "save" && (
            <div className="tb-menu save-menu">
              <button
                type="button"
                className="tb-menu-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick("save")}
              >
                Save
              </button>
              <button
                type="button"
                className="tb-menu-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick("saveAs")}
              >
                Save As…
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="format-toolbar" role="toolbar" aria-label="Formatting">
        <StylePicker
          value={a.docStyle || "body"}
          onChange={(id) => onAction("setDocStyle", id)}
        />

        <div className="format-sep" />

        <div className="font-size-group">
          <select
            className="font-size-select"
            title="Font size"
            value={size}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => onAction("setFontSize", Number(e.target.value))}
          >
            {!FONT_SIZES.includes(size) && (
              <option value={size}>{size}</option>
            )}
            {FONT_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div className="stepper-stack">
            <button
              type="button"
              className="fmt-btn step-btn"
              title="Increase font size"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onAction("nudgeFontSize", 1)}
            >
              +
            </button>
            <button
              type="button"
              className="fmt-btn step-btn"
              title="Decrease font size"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onAction("nudgeFontSize", -1)}
            >
              −
            </button>
          </div>
        </div>

        <div className="format-sep" />

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

        <div className="fmt-cluster">
          <button
            type="button"
            className={`fmt-btn${boldOn ? " active" : ""}`}
            title="Bold"
            aria-pressed={boldOn}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleMark("bold")}
          >
            <span className="fmt-letter fmt-bold">B</span>
          </button>
          <button
            type="button"
            className={`fmt-btn${italicOn ? " active" : ""}`}
            title="Italic"
            aria-pressed={italicOn}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleMark("italic")}
          >
            <span className="fmt-letter fmt-italic">I</span>
          </button>
          <button
            type="button"
            className={`fmt-btn${strikeOn ? " active" : ""}`}
            title="Strikethrough"
            aria-pressed={strikeOn}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleMark("strike")}
          >
            <span className="fmt-letter fmt-strike">S</span>
          </button>
        </div>

        <div className="format-sep" />

        <div className="tb-dropdown text-color-box">
          <div className="custom-highlight-box text-color-split">
            <button
              type="button"
              className="fmt-btn custom-main color-letter-btn"
              title={
                a.textColor
                  ? `Font color (${a.textColor})`
                  : `Font color (${lastCustomTextColor})`
              }
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                onAction(
                  "setTextColor",
                  a.textColor || lastCustomTextColor,
                )
              }
            >
              <span
                className="color-letter-swatch"
                style={{ color: displayColor }}
              >
                A
              </span>
            </button>
            <button
              type="button"
              className="fmt-btn custom-pick"
              title="More font colors"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggle("color")}
            >
              <Chevron />
            </button>
          </div>
          {openMenu === "color" && (
            <div className="tb-menu color-menu">
              <div className="tb-menu-grid">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`swatch-btn${
                      sameColor(textColor, c.color) ? " active" : ""
                    }`}
                    title={c.title}
                    style={{ background: c.color }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick("setTextColor", c.color)}
                  />
                ))}
                <button
                  ref={customTextSwatchRef}
                  type="button"
                  className={`swatch-btn swatch-custom${
                    customTextActive ? " active" : ""
                  }`}
                  title={`Custom (${lastCustomTextColor}) — click to apply, right-click to change`}
                  style={{ background: lastCustomTextColor }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick("setTextColor", lastCustomTextColor)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    openCustomTextColorPicker(e);
                  }}
                />
              </div>
              <button
                type="button"
                className="tb-menu-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  openCustomTextColorPicker(e);
                }}
              >
                Custom color…
              </button>
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

        <div className="fmt-cluster highlight-cluster">
          {MAIN_HIGHLIGHTS.map((h) => (
            <button
              key={h.id}
              type="button"
              className={`fmt-btn highlight-swatch${
                highlightOn && sameColor(highlightColor, h.color)
                  ? " active"
                  : ""
              }`}
              title={h.title}
              style={{ "--swatch": h.color }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyHighlight(h.color)}
            >
              <span className="swatch" />
            </button>
          ))}

          <button
            type="button"
            className={`fmt-btn${highlightOn ? "" : " active"}`}
            title="No highlight"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clearHighlight}
          >
            <NoHighlightIcon />
          </button>

          <div
            className={`custom-highlight-box${customHighlightActive ? " is-active" : ""}`}
          >
            <button
              type="button"
              className={`fmt-btn highlight-swatch custom-main${customHighlightActive ? " active" : ""}`}
              title={`Custom highlight (${lastCustomHighlight}) — click to apply`}
              style={{ "--swatch": lastCustomHighlight }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyHighlight(lastCustomHighlight)}
            >
              <span className="swatch" />
            </button>
            <button
              ref={customHighlightPickRef}
              type="button"
              className="fmt-btn custom-pick"
              title="Choose custom highlight color"
              onMouseDown={(e) => e.preventDefault()}
              onClick={openCustomHighlightPicker}
            >
              <Chevron />
            </button>
          </div>
        </div>

        <div className="format-sep" />

        <button
          type="button"
          className="fmt-btn"
          title="Clear formatting"
          aria-label="Clear formatting"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAction("clearFormatting")}
        >
          <ClearFormatIcon />
        </button>

        <button
          type="button"
          className={`fmt-btn${findOpen ? " active" : ""}`}
          title={findOpen ? "Hide find" : "Find"}
          aria-label={findOpen ? "Hide find" : "Find"}
          aria-pressed={findOpen}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAction("find")}
        >
          <SearchIcon />
        </button>
      </div>

      <div className="toolbar-side toolbar-right">
        <div className="zoom-group font-size-group" title="Page zoom">
          <ZoomIcon />
          <input
            className="zoom-input"
            title="Zoom (e.g. 1.0x or 100%)"
            aria-label="Zoom"
            value={zoomDraft}
            onMouseDown={(e) => e.stopPropagation()}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setZoomDraft(e.target.value)}
            onBlur={commitZoom}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitZoom();
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                setZoomDraft(zoomToFactor(zoom));
                e.currentTarget.blur();
              }
            }}
          />
          <div className="stepper-stack">
            <button
              type="button"
              className="fmt-btn step-btn"
              title="Zoom in"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onAction("zoomIn")}
            >
              +
            </button>
            <button
              type="button"
              className="fmt-btn step-btn"
              title="Zoom out"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onAction("zoomOut")}
            >
              −
            </button>
          </div>
        </div>

        <button
          type="button"
          className="fmt-btn theme-btn"
          title="Dark mode"
          aria-pressed={darkMode}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAction("darkMode")}
        >
          <MoonIcon filled={darkMode} />
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

function OpenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M1.5 3.5h5l1.2 1.5H14.5v8H1.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M1.5 6.5h13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3 2.5h8.5L13.5 5v8.5H3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <rect x="5" y="2.5" width="5" height="3.5" fill="currentColor" opacity="0.35" />
      <rect x="4.5" y="9" width="7" height="4.5" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="7" cy="7" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.2 10.2 L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ZoomIcon() {
  return (
    <svg
      className="zoom-icon"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <circle cx="6.5" cy="6.5" r="4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M9.4 9.4 L13 13"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M6.5 4.6 v3.8 M4.6 6.5 h3.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon({ filled = false }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M11.5 2.2A6.2 6.2 0 1 0 13.8 11 5.2 5.2 0 0 1 11.5 2.2z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="3" cy="4" r="1.15" fill="currentColor" />
      <rect x="6" y="3.2" width="8" height="1.5" rx="0.4" fill="currentColor" />
      <circle cx="3" cy="8" r="1.15" fill="currentColor" />
      <rect x="6" y="7.2" width="8" height="1.5" rx="0.4" fill="currentColor" />
      <circle cx="3" cy="12" r="1.15" fill="currentColor" />
      <rect x="6" y="11.2" width="8" height="1.5" rx="0.4" fill="currentColor" />
    </svg>
  );
}

function NoHighlightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <rect
        x="2"
        y="3"
        width="12"
        height="10"
        rx="1"
        fill="currentColor"
        opacity="0.12"
        stroke="currentColor"
        strokeWidth="1"
      />
      <line x1="3" y1="13" x2="13" y2="3" stroke="#c62828" strokeWidth="1.5" />
    </svg>
  );
}

function ClearFormatIcon() {
  return (
    <svg
      className="clear-format-icon"
      width="18"
      height="18"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      {/* Eraser body */}
      <path
        d="M3.2 9.2 L8.4 4 12 7.6 6.8 12.8 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      {/* Band across eraser */}
      <path
        d="M5.1 7.3 L8.7 10.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      {/* Paper / wipe line */}
      <path
        d="M2 13.4 H14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

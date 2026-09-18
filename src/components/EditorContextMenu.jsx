import { STYLE_IDS, STYLE_LABELS } from "../state/docStyles.js";
import { useLayoutEffect, useRef, useState } from "react";
import { CTX_HIGHLIGHTS, sameColor } from "./FormatToolbar.jsx";

/**
 * Minimal right-click menu anchored to the click point (viewport-fixed).
 */
export default function EditorContextMenu({
  x,
  y,
  currentStyle = "body",
  active = {},
  onAction,
  onClose,
  onCustomHighlight,
  selectionFrom,
  selectionTo,
}) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    setPos({ left, top });
  }, [x, y]);

  if (x == null || y == null) return null;

  const label = STYLE_LABELS[currentStyle] || "Body";
  const highlightColor = active.highlightColor;

  function go(action, payload) {
    if (action === "updateStyleToMatch") {
      onAction(action, {
        styleId: payload || currentStyle,
        from: selectionFrom,
        to: selectionTo,
      });
    } else {
      // Restore range before format actions so they hit the right text
      if (selectionFrom != null && selectionTo != null) {
        onAction("restoreSelection", {
          from: selectionFrom,
          to: selectionTo,
        });
      }
      onAction(action, payload);
    }
    onClose();
  }

  // Keep editor selection when clicking menu items
  function keep(e) {
    e.preventDefault();
  }

  return (
    <>
      <div
        className="ctx-backdrop"
        onMouseDown={onClose}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        ref={menuRef}
        className="ctx-menu"
        style={{ left: pos.left, top: pos.top }}
        role="menu"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={`ctx-item${active.bold ? " active" : ""}`}
          onMouseDown={keep}
          onClick={() => go("bold")}
        >
          Bold
        </button>
        <button
          type="button"
          className={`ctx-item${active.italic ? " active" : ""}`}
          onMouseDown={keep}
          onClick={() => go("italic")}
        >
          Italic
        </button>
        <button
          type="button"
          className={`ctx-item${active.strike ? " active" : ""}`}
          onMouseDown={keep}
          onClick={() => go("strike")}
        >
          Strikethrough
        </button>

        <div className="menu-sep" />

        <div className="ctx-label">Highlight</div>
        <div className="ctx-swatch-row">
          {CTX_HIGHLIGHTS.map((h) => (
            <button
              key={h.id}
              type="button"
              className={`swatch-btn${
                active.highlight && sameColor(highlightColor, h.color)
                  ? " active"
                  : ""
              }`}
              title={h.title}
              style={{ background: h.color }}
              onMouseDown={keep}
              onClick={() => go("highlight", h.color)}
            />
          ))}
          <button
            type="button"
            className="ctx-item-inline"
            onMouseDown={keep}
            onClick={(e) => {
              onCustomHighlight?.(e.currentTarget);
              onClose();
            }}
          >
            Custom…
          </button>
        </div>
        <button
          type="button"
          className="ctx-item"
          onMouseDown={keep}
          onClick={() => go("clearHighlight")}
        >
          Clear highlight
        </button>

        <div className="menu-sep" />

        <div className="ctx-label">Style</div>
        {STYLE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={`ctx-item${currentStyle === id ? " active" : ""}`}
            onMouseDown={keep}
            onClick={() => go("setDocStyle", id)}
          >
            {STYLE_LABELS[id]}
          </button>
        ))}

        <div className="menu-sep" />

        <button
          type="button"
          className="ctx-item"
          title="Save this look as the style for this document"
          onMouseDown={keep}
          onClick={() => go("updateStyleToMatch", currentStyle)}
        >
          Update “{label}” to match
        </button>
      </div>
    </>
  );
}

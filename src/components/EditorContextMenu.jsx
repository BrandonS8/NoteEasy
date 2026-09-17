import { STYLE_IDS, STYLE_LABELS } from "../state/docStyles.js";
import { useLayoutEffect, useRef, useState } from "react";

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

  function go(action, payload) {
    onAction(action, payload);
    onClose();
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
          onClick={() => go("bold")}
        >
          Bold
        </button>
        <button
          type="button"
          className={`ctx-item${active.italic ? " active" : ""}`}
          onClick={() => go("italic")}
        >
          Italic
        </button>
        <button
          type="button"
          className={`ctx-item${active.strike ? " active" : ""}`}
          onClick={() => go("strike")}
        >
          Strikethrough
        </button>
        <button
          type="button"
          className="ctx-item"
          onClick={() => go("highlight", "#ffeb3b")}
        >
          Highlight
        </button>
        <button
          type="button"
          className="ctx-item"
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
            onClick={() => go("setDocStyle", id)}
          >
            {STYLE_LABELS[id]}
          </button>
        ))}

        <div className="menu-sep" />

        <button
          type="button"
          className="ctx-item"
          disabled={currentStyle === "body"}
          title="Save this look as the style for this document"
          onClick={() => go("updateStyleToMatch")}
        >
          Update “{label}” to match
        </button>
      </div>
    </>
  );
}

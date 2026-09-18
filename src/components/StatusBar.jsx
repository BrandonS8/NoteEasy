import { useEffect, useRef, useState } from "react";

const ZOOM_PRESETS = [50, 75, 100, 125, 150, 175, 200, 300, 400, 500];

export default function StatusBar({
  line,
  column,
  zoom,
  encoding,
  visible,
  characters = 0,
  words = 0,
  onZoomChange,
}) {
  const [zoomOpen, setZoomOpen] = useState(false);
  const zoomRef = useRef(null);

  useEffect(() => {
    if (!zoomOpen) return;
    function onDoc(e) {
      if (zoomRef.current?.contains(e.target)) return;
      setZoomOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [zoomOpen]);

  if (!visible) return null;

  return (
    <div className="status-bar">
      <span className="status-left">
        {words.toLocaleString()} word{words === 1 ? "" : "s"}
        <span className="status-sep">·</span>
        {characters.toLocaleString()} character{characters === 1 ? "" : "s"}
      </span>
      <span>
        Ln {line}, Col {column}
      </span>
      <div className="status-zoom" ref={zoomRef}>
        <button
          type="button"
          className="status-zoom-btn"
          title="Zoom"
          aria-haspopup="listbox"
          aria-expanded={zoomOpen}
          onClick={() => setZoomOpen((v) => !v)}
        >
          {zoom}%
        </button>
        {zoomOpen && (
          <div className="status-zoom-menu" role="listbox">
            {ZOOM_PRESETS.map((z) => (
              <button
                key={z}
                type="button"
                role="option"
                aria-selected={z === zoom}
                className={`status-zoom-item${z === zoom ? " active" : ""}`}
                onClick={() => {
                  onZoomChange?.(z);
                  setZoomOpen(false);
                }}
              >
                {z}%
              </button>
            ))}
          </div>
        )}
      </div>
      <span>{encoding}</span>
    </div>
  );
}

/** Count words/characters from plain editor text. */
export function countTextStats(text) {
  const raw = String(text ?? "");
  const characters = raw.length;
  const trimmed = raw.trim();
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  return { characters, words };
}

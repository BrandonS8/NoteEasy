import { useEffect, useRef } from "react";

export default function FindBar({
  mode,
  query,
  replaceWith,
  onQueryChange,
  onReplaceChange,
  onFindNext,
  onFindPrev,
  onReplace,
  onReplaceAll,
  onClose,
  status,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [mode]);

  if (!mode) return null;

  return (
    <div className="find-bar">
      <input
        ref={inputRef}
        value={query}
        placeholder="Find"
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) onFindPrev();
            else onFindNext();
          } else if (e.key === "Escape") {
            onClose();
          }
        }}
      />
      <input
        value={replaceWith}
        placeholder="Replace"
        onChange={(e) => onReplaceChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onReplace();
          } else if (e.key === "Escape") {
            onClose();
          }
        }}
      />
      <button type="button" onClick={onFindPrev}>
        Previous
      </button>
      <button type="button" onClick={onFindNext}>
        Next
      </button>
      <button type="button" onClick={onReplace}>
        Replace
      </button>
      <button type="button" onClick={onReplaceAll}>
        Replace All
      </button>
      <span className="find-meta">{status}</span>
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

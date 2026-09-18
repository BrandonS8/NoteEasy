export default function StatusBar({
  line,
  column,
  zoom,
  encoding,
  visible,
  characters = 0,
  words = 0,
}) {
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
      <span>{zoom}%</span>
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

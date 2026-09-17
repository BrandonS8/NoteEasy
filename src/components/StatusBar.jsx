export default function StatusBar({ line, column, zoom, encoding, visible }) {
  if (!visible) return null;
  return (
    <div className="status-bar">
      <span className="status-left">NoteEasy</span>
      <span>
        Ln {line}, Col {column}
      </span>
      <span>{zoom}%</span>
      <span>{encoding}</span>
      <span>Windows (CRLF)</span>
    </div>
  );
}

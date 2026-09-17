import { STYLE_IDS, STYLE_LABELS } from "../state/docStyles.js";

const SHORT = {
  title: "Title",
  subtitle: "Subtitle",
  heading1: "H1",
  heading2: "H2",
  heading3: "H3",
  heading4: "H4",
  heading5: "H5",
  body: "Body",
};

/** Compact style control like Notepad's H1 dropdown. */
export default function StylePicker({ value = "body", onChange }) {
  return (
    <select
      className="style-picker"
      title="Paragraph style"
      value={value || "body"}
      onMouseDown={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
    >
      {STYLE_IDS.map((id) => (
        <option key={id} value={id}>
          {SHORT[id] || STYLE_LABELS[id]}
        </option>
      ))}
    </select>
  );
}

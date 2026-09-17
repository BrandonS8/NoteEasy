export const STYLE_IDS = [
  "title",
  "subtitle",
  "heading1",
  "heading2",
  "heading3",
  "heading4",
  "heading5",
  "body",
];

export const STYLE_LABELS = {
  title: "Title",
  subtitle: "Subtitle",
  heading1: "Heading 1",
  heading2: "Heading 2",
  heading3: "Heading 3",
  heading4: "Heading 4",
  heading5: "Heading 5",
  body: "Body",
};

/** Default document styles (Body inherits the app font size when fontSize is null). */
export function createDefaultDocStyles() {
  return {
    title: { fontSize: 28, bold: true, italic: false },
    subtitle: { fontSize: 18, bold: false, italic: true },
    heading1: { fontSize: 22, bold: true, italic: false },
    heading2: { fontSize: 18, bold: true, italic: false },
    heading3: { fontSize: 16, bold: true, italic: false },
    heading4: { fontSize: 14, bold: true, italic: false },
    heading5: { fontSize: 12, bold: true, italic: false },
    body: { fontSize: null, bold: false, italic: false },
  };
}

export function mergeDocStyles(partial) {
  const base = createDefaultDocStyles();
  if (!partial || typeof partial !== "object") return base;
  for (const id of STYLE_IDS) {
    if (partial[id] && typeof partial[id] === "object") {
      base[id] = { ...base[id], ...partial[id] };
    }
  }
  return base;
}

export function styleToCss(styleId, def, bodyFontSize) {
  if (!def) return "";
  const size =
    def.fontSize == null
      ? styleId === "body"
        ? bodyFontSize
        : bodyFontSize
      : def.fontSize;
  const parts = [];
  if (size) parts.push(`font-size: ${size}px`);
  parts.push(`font-weight: ${def.bold ? 700 : 400}`);
  parts.push(`font-style: ${def.italic ? "italic" : "normal"}`);
  return parts.join("; ");
}

/** Build a <style> block for the editor from document style definitions. */
export function buildDocStylesCss(docStyles, bodyFontSize, scope = ".notepad-editor") {
  const styles = mergeDocStyles(docStyles);
  return STYLE_IDS.map((id) => {
    const css = styleToCss(id, styles[id], bodyFontSize);
    if (id === "body") {
      return `${scope} p:not([data-doc-style]), ${scope} p[data-doc-style="body"] { ${css}; }`;
    }
    return `${scope} p[data-doc-style="${id}"] { ${css}; }`;
  }).join("\n");
}

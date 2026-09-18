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

/** Empty formatting extras shared by defaults. */
const STYLE_EXTRAS = {
  strike: false,
  color: null,
  highlight: null,
};

/** Default document styles (Body inherits the app font size when fontSize is null). */
export function createDefaultDocStyles() {
  return {
    title: { fontSize: 36, bold: true, italic: false, ...STYLE_EXTRAS },
    subtitle: { fontSize: 22, bold: false, italic: true, ...STYLE_EXTRAS },
    heading1: { fontSize: 28, bold: true, italic: false, ...STYLE_EXTRAS },
    heading2: { fontSize: 24, bold: true, italic: false, ...STYLE_EXTRAS },
    heading3: { fontSize: 20, bold: true, italic: false, ...STYLE_EXTRAS },
    heading4: { fontSize: 18, bold: true, italic: false, ...STYLE_EXTRAS },
    heading5: { fontSize: 16, bold: true, italic: false, ...STYLE_EXTRAS },
    body: { fontSize: null, bold: false, italic: false, ...STYLE_EXTRAS },
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
  // Only font-size lives in CSS as a soft default. Bold/italic/color/highlight
  // are marks so individual paragraphs can still be edited until
  // “Update style to match” reapplies them.
  const size = def.fontSize == null ? bodyFontSize : def.fontSize;
  if (!size) return "";
  return `font-size: ${size}px`;
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

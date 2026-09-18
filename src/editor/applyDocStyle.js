/**
 * Sample / apply full named-style definitions (size, bold, italic, strike,
 * text color, highlight) across matching paragraphs.
 */

function isBoldWeight(weight) {
  if (!weight) return false;
  if (weight === "bold" || weight === "bolder") return true;
  const n = parseInt(weight, 10);
  return Number.isFinite(n) && n >= 600;
}

function cssColorToHex(color) {
  if (!color || typeof color !== "string") return null;
  const c = color.trim().toLowerCase();
  if (c === "transparent" || c === "rgba(0, 0, 0, 0)") return null;
  if (/^#[0-9a-f]{6}$/.test(c)) return c;
  if (/^#[0-9a-f]{3}$/.test(c)) {
    return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
  }
  const m = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return null;
  const hex = [m[1], m[2], m[3]]
    .map((n) => Number(n).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`;
}

/** Null means inherit from the editor (Body default). */
export function resolveStyleFontSize(def) {
  if (!def) return null;
  if (def.fontSize == null) return null;
  return def.fontSize;
}

/** Normalize a style def so missing keys are explicit. */
export function normalizeStyleDef(def = {}) {
  return {
    fontSize: def.fontSize == null ? null : def.fontSize,
    bold: !!def.bold,
    italic: !!def.italic,
    strike: !!def.strike,
    color: def.color || null,
    highlight: def.highlight || null,
  };
}

/** Sample full formatting from the current selection. */
export function sampleStyleFromEditor(editor, bodyFontSize) {
  if (!editor) return null;
  const { from } = editor.state.selection;
  const textStyle = editor.getAttributes("textStyle") || {};
  const highlightAttrs = editor.getAttributes("highlight") || {};

  let markSize =
    typeof textStyle.fontSize === "number" ? textStyle.fontSize : null;
  if (markSize == null) {
    const marks = editor.state.selection.$from.marks();
    const ts = marks.find((m) => m.type.name === "textStyle");
    if (typeof ts?.attrs?.fontSize === "number") markSize = ts.attrs.fontSize;
  }

  const dom = editor.view.domAtPos(from).node;
  const textEl =
    dom.nodeType === 3
      ? dom.parentElement
      : dom.nodeType === 1
        ? dom.closest?.("span, strong, em, s, mark, p") || dom
        : dom.parentElement;
  const computed = textEl ? window.getComputedStyle(textEl) : null;
  const computedSize = computed ? parseInt(computed.fontSize, 10) : null;

  const size =
    markSize ||
    (Number.isFinite(computedSize) ? computedSize : null) ||
    bodyFontSize;

  let color = textStyle.color || null;
  if (!color && computed) {
    const hex = cssColorToHex(computed.color);
    // Treat near-black as “automatic” so Body doesn’t bake in #000
    if (hex && hex !== "#000000") color = hex;
  }

  let highlight = null;
  if (editor.isActive("highlight")) {
    highlight = highlightAttrs.color || "#ffeb3b";
  } else if (textEl) {
    const markEl = textEl.closest?.("mark") || (textEl.tagName === "MARK" ? textEl : null);
    if (markEl) {
      highlight =
        markEl.getAttribute("data-color") ||
        cssColorToHex(window.getComputedStyle(markEl).backgroundColor) ||
        "#ffeb3b";
    }
  }

  return normalizeStyleDef({
    fontSize: size,
    bold: !!(editor.isActive("bold") || isBoldWeight(computed?.fontWeight)),
    italic: !!(editor.isActive("italic") || computed?.fontStyle === "italic"),
    strike: !!(
      editor.isActive("strike") ||
      (computed &&
        (computed.textDecorationLine || "").includes("line-through"))
    ),
    color,
    highlight,
  });
}

function applyMarksToParagraph(tr, schema, node, pos, def) {
  const boldMark = schema.marks.bold;
  const italicMark = schema.marks.italic;
  const strikeMark = schema.marks.strike;
  const textStyleMark = schema.marks.textStyle;
  const highlightMark = schema.marks.highlight;
  const size = resolveStyleFontSize(def);

  node.forEach((child, offset) => {
    if (!child.isText) return;
    const from = pos + 1 + offset;
    const to = from + child.nodeSize;

    if (boldMark) tr.removeMark(from, to, boldMark);
    if (italicMark) tr.removeMark(from, to, italicMark);
    if (strikeMark) tr.removeMark(from, to, strikeMark);
    if (highlightMark) tr.removeMark(from, to, highlightMark);
    if (textStyleMark) tr.removeMark(from, to, textStyleMark);

    if (def.bold && boldMark) tr.addMark(from, to, boldMark.create());
    if (def.italic && italicMark) tr.addMark(from, to, italicMark.create());
    if (def.strike && strikeMark) tr.addMark(from, to, strikeMark.create());

    if (textStyleMark && (size || def.color)) {
      tr.addMark(
        from,
        to,
        textStyleMark.create({
          fontSize: size || null,
          color: def.color || null,
        }),
      );
    }

    if (def.highlight && highlightMark) {
      tr.addMark(
        from,
        to,
        highlightMark.create({ color: def.highlight }),
      );
    }
  });
}

/**
 * Apply a full style definition to paragraphs with docStyle === styleId.
 * If onlySelection is true, only paragraphs intersecting the selection.
 */
export function applyStyleDefToParagraphs(
  editor,
  styleId,
  def,
  _bodyFontSize,
  { onlySelection = false } = {},
) {
  if (!editor || !styleId || !def) return false;
  const style = normalizeStyleDef(def);
  const { schema, doc, selection } = editor.state;
  const tr = editor.state.tr;
  const targets = [];

  if (onlySelection) {
    const seen = new Set();
    doc.nodesBetween(selection.from, selection.to, (node, pos) => {
      if (node.type.name !== "paragraph") return;
      if ((node.attrs.docStyle || "body") !== styleId) return;
      if (seen.has(pos)) return;
      seen.add(pos);
      targets.push({ node, pos });
    });
    if (targets.length === 0) {
      const $from = selection.$from;
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (
          node.type.name === "paragraph" &&
          (node.attrs.docStyle || "body") === styleId
        ) {
          targets.push({ node, pos: $from.before(d) });
          break;
        }
      }
    }
  } else {
    doc.descendants((node, pos) => {
      if (node.type.name !== "paragraph") return;
      if ((node.attrs.docStyle || "body") !== styleId) return;
      targets.push({ node, pos });
    });
  }

  for (const { node, pos } of targets) {
    applyMarksToParagraph(tr, schema, node, pos, style);
  }

  // Empty caret: set stored marks so new typing matches the style
  if (selection.empty && targets.length > 0) {
    const marks = [];
    if (style.bold && schema.marks.bold) marks.push(schema.marks.bold.create());
    if (style.italic && schema.marks.italic)
      marks.push(schema.marks.italic.create());
    if (style.strike && schema.marks.strike)
      marks.push(schema.marks.strike.create());
    const size = resolveStyleFontSize(style);
    if (schema.marks.textStyle && (size || style.color)) {
      marks.push(
        schema.marks.textStyle.create({
          fontSize: size || null,
          color: style.color || null,
        }),
      );
    }
    if (style.highlight && schema.marks.highlight) {
      marks.push(schema.marks.highlight.create({ color: style.highlight }));
    }
    tr.setStoredMarks(marks);
  }

  editor.view.dispatch(tr);
  return true;
}

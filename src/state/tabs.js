import { createDefaultDocStyles, mergeDocStyles } from "./docStyles.js";

let tabSeq = 1;

export function createTab(partial = {}) {
  const id = partial.id ?? `tab-${Date.now()}-${tabSeq++}`;
  return {
    id,
    title: partial.title ?? "Untitled",
    path: partial.path ?? null,
    contentHtml: partial.contentHtml ?? "<p></p>",
    dirty: partial.dirty ?? false,
    encoding: partial.encoding ?? "UTF-8",
    docStyles: mergeDocStyles(partial.docStyles || createDefaultDocStyles()),
  };
}

export function titleFromPath(filePath) {
  if (!filePath) return "Untitled";
  const parts = filePath.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || "Untitled";
}

/** Sanitize a string for use as a Windows file name (no extension). */
export function sanitizeFileStem(raw, { maxLen = 80 } = {}) {
  let name = String(raw ?? "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!name) return "";
  // Avoid reserved device names
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name)) {
    name = `${name}_note`;
  }
  if (name.length > maxLen) name = name.slice(0, maxLen).trim();
  return name.replace(/[. ]+$/g, "");
}

/** Prefer first non-empty line of text as save default (Untitled → first line). */
export function suggestedSaveName(tab, plainText) {
  if (tab?.path) return tab.path;
  const text = String(plainText ?? "");
  const firstLine =
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean) || "";
  const stem =
    sanitizeFileStem(firstLine) ||
    sanitizeFileStem(tab?.title) ||
    "Untitled";
  if (/\.(txt|nte|text|log)$/i.test(stem)) return stem;
  return `${stem}.txt`;
}

export function htmlToPlainText(html) {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const blocks = [...doc.body.querySelectorAll("p")];
  if (blocks.length === 0) {
    return doc.body.textContent || "";
  }
  return blocks.map((p) => p.textContent ?? "").join("\n");
}

export function plainTextToHtml(text) {
  const lines = String(text ?? "").replace(/\r\n/g, "\n").split("\n");
  if (lines.length === 0) return "<p></p>";
  return lines
    .map((line) => {
      const escaped = line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<p>${escaped || "<br>"}</p>`;
    })
    .join("");
}

export function isRichNotePath(filePath) {
  return /\.nte$/i.test(filePath || "");
}

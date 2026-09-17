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

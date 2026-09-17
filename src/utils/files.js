import { open, save, ask, message } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import {
  htmlToPlainText,
  isRichNotePath,
  plainTextToHtml,
  titleFromPath,
} from "../state/tabs.js";

const FILTERS = [
  { name: "Text / NoteEasy", extensions: ["txt", "nte", "text", "log"] },
  { name: "All Files", extensions: ["*"] },
];

export async function pickOpenPath() {
  return open({
    multiple: false,
    directory: false,
    filters: FILTERS,
  });
}

export async function pickSavePath(defaultPath) {
  return save({
    defaultPath: defaultPath || undefined,
    filters: FILTERS,
  });
}

export async function readDocument(filePath) {
  const raw = await readTextFile(filePath);
  if (isRichNotePath(filePath)) {
    const trimmed = raw.trim();
    if (trimmed.startsWith("{")) {
      const parsed = JSON.parse(trimmed);
      return {
        contentHtml: parsed.contentHtml || plainTextToHtml(parsed.text || ""),
        docStyles: parsed.docStyles || null,
        encoding: "UTF-8",
      };
    }
    return { contentHtml: trimmed || "<p></p>", docStyles: null, encoding: "UTF-8" };
  }
  return { contentHtml: plainTextToHtml(raw), docStyles: null, encoding: "UTF-8" };
}

export async function writeDocument(filePath, contentHtml, docStyles = null) {
  if (isRichNotePath(filePath)) {
    const payload = JSON.stringify(
      {
        version: 1,
        contentHtml,
        text: htmlToPlainText(contentHtml),
        docStyles: docStyles || undefined,
      },
      null,
      2,
    );
    await writeTextFile(filePath, payload);
  } else {
    await writeTextFile(filePath, htmlToPlainText(contentHtml));
  }
  return titleFromPath(filePath);
}

export async function confirmDiscard(title) {
  return ask(`Do you want to save changes to ${title}?`, {
    title: "NoteEasy",
    kind: "warning",
    okLabel: "Save",
    cancelLabel: "Don't Save",
  });
}

export async function showInfo(text) {
  await message(text, { title: "NoteEasy", kind: "info" });
}

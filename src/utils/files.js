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

/** Force a visible arrow cursor before native OS dialogs (WebView I-beam often vanishes on them). */
export async function prepareForNativeDialog() {
  try {
    document.documentElement.classList.add("native-dialog-open");
    document.body.style.cursor = "default";
    document.documentElement.style.cursor = "default";
    if (document.activeElement?.blur) document.activeElement.blur();
    // Let the browser apply the arrow before the OS dialog opens
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 40));
  } catch {
    /* ignore */
  }
}

export function restoreAfterNativeDialog() {
  try {
    document.documentElement.classList.remove("native-dialog-open");
    document.body.style.cursor = "";
    document.documentElement.style.cursor = "";
  } catch {
    /* ignore */
  }
}

export async function pickOpenPath() {
  await prepareForNativeDialog();
  try {
    return await open({
      multiple: false,
      directory: false,
      filters: FILTERS,
    });
  } finally {
    restoreAfterNativeDialog();
  }
}

export async function pickSavePath(defaultPath) {
  await prepareForNativeDialog();
  try {
    return await save({
      defaultPath: defaultPath || undefined,
      filters: FILTERS,
    });
  } finally {
    restoreAfterNativeDialog();
  }
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
  await prepareForNativeDialog();
  try {
    return await ask(`Do you want to save changes to ${title}?`, {
      title: "NoteEasy",
      kind: "warning",
      okLabel: "Save",
      cancelLabel: "Don't Save",
    });
  } finally {
    restoreAfterNativeDialog();
  }
}

export async function showInfo(text) {
  await prepareForNativeDialog();
  try {
    await message(text, { title: "NoteEasy", kind: "info" });
  } finally {
    restoreAfterNativeDialog();
  }
}

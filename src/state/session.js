import { Store } from "@tauri-apps/plugin-store";
import { getCurrentWindow } from "@tauri-apps/api/window";

const STORE_FILE = "session.json";

let storePromise = null;

function getStore() {
  if (!storePromise) {
    storePromise = Store.load(STORE_FILE);
  }
  return storePromise;
}

export async function loadSession() {
  try {
    const store = await getStore();
    const session = await store.get("session");
    return session ?? null;
  } catch {
    return null;
  }
}

export async function saveSession(session) {
  try {
    const store = await getStore();
    await store.set("session", session);
    await store.save();
  } catch (err) {
    console.error("Failed to save session", err);
  }
}

export async function captureWindowState() {
  try {
    const win = getCurrentWindow();
    const position = await win.outerPosition();
    const size = await win.outerSize();
    const maximized = await win.isMaximized();
    return {
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      maximized,
    };
  } catch {
    return null;
  }
}

export async function restoreWindowState(windowState) {
  if (!windowState) return;
  try {
    const win = getCurrentWindow();
    const { LogicalPosition, LogicalSize } = await import(
      "@tauri-apps/api/dpi"
    );
    if (
      typeof windowState.x === "number" &&
      typeof windowState.y === "number"
    ) {
      await win.setPosition(
        new LogicalPosition(windowState.x, windowState.y),
      );
    }
    if (
      typeof windowState.width === "number" &&
      typeof windowState.height === "number"
    ) {
      await win.setSize(
        new LogicalSize(windowState.width, windowState.height),
      );
    }
    if (windowState.maximized) {
      await win.maximize();
    }
  } catch (err) {
    console.error("Failed to restore window", err);
  }
}

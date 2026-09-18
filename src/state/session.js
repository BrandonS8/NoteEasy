import { Store } from "@tauri-apps/plugin-store";
import { getCurrentWindow } from "@tauri-apps/api/window";

const STORE_FILE = "session.json";
const MIN_W = 480;
const MIN_H = 320;
const DEFAULT_W = 900;
const DEFAULT_H = 640;

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

function isSaneWindowState(state) {
  if (!state || typeof state !== "object") return false;
  const { x, y, width, height } = state;
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    width < MIN_W ||
    height < MIN_H
  ) {
    return false;
  }
  // Windows parks minimized windows around -32000
  if (typeof x === "number" && typeof y === "number") {
    if (x < -10000 || y < -10000) return false;
  }
  return true;
}

export async function captureWindowState() {
  try {
    const win = getCurrentWindow();
    if (await win.isMinimized()) return null;
    const position = await win.outerPosition();
    const size = await win.outerSize();
    const maximized = await win.isMaximized();
    const state = {
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      maximized,
    };
    return isSaneWindowState(state) ? state : null;
  } catch {
    return null;
  }
}

export async function restoreWindowState(windowState) {
  if (!isSaneWindowState(windowState)) return;
  try {
    const win = getCurrentWindow();
    const { LogicalPosition, LogicalSize } = await import(
      "@tauri-apps/api/dpi"
    );
    const width = Math.max(MIN_W, windowState.width || DEFAULT_W);
    const height = Math.max(MIN_H, windowState.height || DEFAULT_H);
    let x = windowState.x;
    let y = windowState.y;
    if (typeof x !== "number" || typeof y !== "number" || x < -10000 || y < -10000) {
      x = 80;
      y = 80;
    }

    await win.unminimize();
    await win.setSize(new LogicalSize(width, height));
    await win.setPosition(new LogicalPosition(x, y));
    if (windowState.maximized) {
      await win.maximize();
    }
    await win.setFocus();
  } catch (err) {
    console.error("Failed to restore window", err);
  }
}

/** Bring the window back if it ended up minimized / off-screen / tiny. */
export async function ensureWindowVisible() {
  try {
    const win = getCurrentWindow();
    const { LogicalPosition, LogicalSize } = await import(
      "@tauri-apps/api/dpi"
    );
    if (await win.isMinimized()) {
      await win.unminimize();
    }
    const size = await win.outerSize();
    const position = await win.outerPosition();
    if (size.width < MIN_W || size.height < MIN_H) {
      await win.setSize(new LogicalSize(DEFAULT_W, DEFAULT_H));
    }
    if (position.x < -10000 || position.y < -10000) {
      await win.setPosition(new LogicalPosition(80, 80));
    }
    await win.setFocus();
  } catch (err) {
    console.error("Failed to show window", err);
  }
}

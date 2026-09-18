import { Store } from "@tauri-apps/plugin-store";
import { getCurrentWindow } from "@tauri-apps/api/window";

const STORE_FILE = "session.json";
const MIN_W = 403;
const MIN_H = 180;
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

/** Physical → logical using the window scale factor. */
function toLogical(physical, factor) {
  const f = factor > 0 ? factor : 1;
  return {
    x: physical.x / f,
    y: physical.y / f,
    width: physical.width / f,
    height: physical.height / f,
  };
}

export async function captureWindowState() {
  try {
    const win = getCurrentWindow();
    if (await win.isMinimized()) return null;
    const factor = await win.scaleFactor();
    const position = await win.outerPosition();
    const size = await win.outerSize();
    const maximized = await win.isMaximized();
    const logical = toLogical(
      {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
      },
      factor,
    );
    const state = {
      ...logical,
      maximized,
      // Mark so we don't double-convert older sessions incorrectly later
      unit: "logical",
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
    const factor = await win.scaleFactor();
    const monitor = await win.currentMonitor();
    const maxLogicalW = monitor
      ? monitor.size.width / (monitor.scaleFactor || factor)
      : 1920;
    const maxLogicalH = monitor
      ? monitor.size.height / (monitor.scaleFactor || factor)
      : 1080;

    // Older sessions saved physical outerSize as if it were logical — shrink
    // those back so the window stops growing on every refresh.
    let width = windowState.width || DEFAULT_W;
    let height = windowState.height || DEFAULT_H;
    let x = windowState.x;
    let y = windowState.y;
    if (windowState.unit !== "logical" && factor > 1.01) {
      if (width > maxLogicalW * 1.05 || height > maxLogicalH * 1.05) {
        width /= factor;
        height /= factor;
        if (typeof x === "number") x /= factor;
        if (typeof y === "number") y /= factor;
      }
    }

    width = Math.min(Math.max(MIN_W, width), maxLogicalW);
    height = Math.min(Math.max(MIN_H, height), maxLogicalH);

    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      x < -10000 ||
      y < -10000
    ) {
      x = 80;
      y = 80;
    }

    await win.unminimize();
    await win.setSize(new LogicalSize(Math.round(width), Math.round(height)));
    await win.setPosition(new LogicalPosition(Math.round(x), Math.round(y)));
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
    const factor = await win.scaleFactor();
    const size = await win.outerSize();
    const position = await win.outerPosition();
    const logicalW = size.width / factor;
    const logicalH = size.height / factor;
    if (logicalW < MIN_W || logicalH < MIN_H) {
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

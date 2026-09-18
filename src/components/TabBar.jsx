import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "../utils/tauri.js";

/**
 * Notepad-style title bar: tabs + window controls (frameless).
 */
export default function TabBar({
  tabs,
  activeId,
  onSelect,
  onClose,
  onCloseOthers,
  onCloseLeft,
  onCloseRight,
  onCloseAll,
  onNew,
}) {
  const [menu, setMenu] = useState(null);
  const [maximized, setMaximized] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten;
    try {
      const win = getCurrentWindow();
      win.isMaximized()
        .then(setMaximized)
        .catch(() => {});
      win
        .onResized(() => {
          win.isMaximized()
            .then(setMaximized)
            .catch(() => {});
        })
        .then((fn) => {
          unlisten = fn;
        })
        .catch(() => {});
    } catch {
      /* browser preview */
    }
    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!menu) return;
    function onDoc(e) {
      if (menuRef.current?.contains(e.target)) return;
      setMenu(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menu]);

  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const pad = 8;
    let left = menu.x;
    let top = menu.y;
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    if (left !== menu.x || top !== menu.y) {
      setMenu((m) => (m ? { ...m, x: left, y: top } : m));
    }
  }, [menu]);

  const idx = menu ? tabs.findIndex((t) => t.id === menu.tabId) : -1;
  const canLeft = idx > 0;
  const canRight = idx >= 0 && idx < tabs.length - 1;
  const canOthers = tabs.length > 1;

  function run(action) {
    const tabId = menu?.tabId;
    setMenu(null);
    if (!tabId) return;
    action(tabId);
  }

  async function minimize() {
    if (!isTauri()) return;
    try {
      await getCurrentWindow().minimize();
    } catch {
      /* ignore */
    }
  }

  async function toggleMaximize() {
    if (!isTauri()) return;
    try {
      await getCurrentWindow().toggleMaximize();
    } catch {
      /* ignore */
    }
  }

  async function closeWindow() {
    if (!isTauri()) return;
    try {
      await getCurrentWindow().close();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="titlebar tab-bar" role="tablist" data-tauri-drag-region>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab${tab.id === activeId ? " active" : ""}`}
          role="tab"
          aria-selected={tab.id === activeId}
          onClick={() => onSelect(tab.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
          }}
          onMouseDown={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              onClose(tab.id);
            }
          }}
        >
          <span className="tab-title">
            {tab.dirty ? "*" : ""}
            {tab.title}
          </span>
          <button
            type="button"
            className="tab-close"
            title="Close tab"
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="tab-new" title="New tab" onClick={onNew}>
        +
      </button>

      <div className="titlebar-spacer" data-tauri-drag-region />

      <div className="window-controls">
        <button
          type="button"
          className="win-btn"
          title="Minimize"
          onClick={minimize}
        >
          <MinIcon />
        </button>
        <button
          type="button"
          className="win-btn"
          title={maximized ? "Restore" : "Maximize"}
          onClick={toggleMaximize}
        >
          {maximized ? <RestoreIcon /> : <MaxIcon />}
        </button>
        <button
          type="button"
          className="win-btn win-close"
          title="Close"
          onClick={closeWindow}
        >
          <CloseIcon />
        </button>
      </div>

      {menu && (
        <>
          <div className="ctx-backdrop" onMouseDown={() => setMenu(null)} />
          <div
            ref={menuRef}
            className="ctx-menu tab-ctx-menu"
            style={{ left: menu.x, top: menu.y }}
            role="menu"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="ctx-item"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run(onClose)}
            >
              Close tab
            </button>
            <button
              type="button"
              className="ctx-item"
              disabled={!canLeft}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run(onCloseLeft)}
            >
              Close tabs to the left
            </button>
            <button
              type="button"
              className="ctx-item"
              disabled={!canRight}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run(onCloseRight)}
            >
              Close tabs to the right
            </button>
            <button
              type="button"
              className="ctx-item"
              disabled={!canOthers}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run(onCloseOthers)}
            >
              Close other tabs
            </button>
            <div className="menu-sep" />
            <button
              type="button"
              className="ctx-item"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setMenu(null);
                onCloseAll?.();
              }}
            >
              Close all tabs
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MinIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M1 5h8" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function MaxIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect
        x="1.5"
        y="1.5"
        width="7"
        height="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path
        d="M3 3.5h4.5V8H3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="M4.5 2H8.5v4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path
        d="M2 2l6 6M8 2L2 8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

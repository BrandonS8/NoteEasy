import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import MenuBar from "./components/MenuBar.jsx";
import TabBar from "./components/TabBar.jsx";
import StatusBar from "./components/StatusBar.jsx";
import FindBar from "./components/FindBar.jsx";
import FontDialog from "./components/FontDialog.jsx";
import NotepadEditor from "./editor/NotepadEditor.jsx";
import { createTab, titleFromPath } from "./state/tabs.js";
import {
  captureWindowState,
  loadSession,
  restoreWindowState,
  saveSession,
} from "./state/session.js";
import {
  confirmDiscard,
  pickOpenPath,
  pickSavePath,
  readDocument,
  showInfo,
  writeDocument,
} from "./utils/files.js";
import { isTauri } from "./utils/tauri.js";

export default function App() {
  const initialTab = useRef(null);
  if (!initialTab.current) initialTab.current = createTab();
  const [tabs, setTabs] = useState(() => [initialTab.current]);
  const [activeId, setActiveId] = useState(() => initialTab.current.id);
  const [ready, setReady] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const [statusBar, setStatusBar] = useState(true);
  const [fontFamily, setFontFamily] = useState("Consolas");
  const [fontSize, setFontSize] = useState(14);
  const [zoom, setZoom] = useState(100);
  const [line, setLine] = useState(1);
  const [column, setColumn] = useState(1);
  const [findMode, setFindMode] = useState(null);
  const [findQuery, setFindQuery] = useState("");
  const [replaceWith, setReplaceWith] = useState("");
  const [findStatus, setFindStatus] = useState("");
  const [fontOpen, setFontOpen] = useState(false);

  const editorRef = useRef(null);
  const tabsRef = useRef(tabs);
  const activeIdRef = useRef(activeId);
  const settingsRef = useRef({});

  tabsRef.current = tabs;
  activeIdRef.current = activeId;
  settingsRef.current = {
    wordWrap,
    statusBar,
    fontFamily,
    fontSize,
    zoom,
  };

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const displayFontSize = Math.max(8, Math.round((fontSize * zoom) / 100));

  const updateTab = useCallback((id, patch) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
  }, []);

  const persistSession = useCallback(async () => {
    const windowState = await captureWindowState();
    const s = settingsRef.current;
    await saveSession({
      tabs: tabsRef.current.map((t) => ({
        id: t.id,
        title: t.title,
        path: t.path,
        contentHtml: t.contentHtml,
        dirty: t.dirty,
        encoding: t.encoding,
      })),
      activeId: activeIdRef.current,
      wordWrap: s.wordWrap,
      statusBar: s.statusBar,
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      zoom: s.zoom,
      window: windowState,
    });
  }, []);

  // Restore session once on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await Promise.race([
          loadSession(),
          new Promise((resolve) => setTimeout(() => resolve(null), 2000)),
        ]);
        if (cancelled) return;
        if (session?.tabs?.length) {
          setTabs(session.tabs.map((t) => createTab(t)));
          setActiveId(session.activeId || session.tabs[0].id);
          if (typeof session.wordWrap === "boolean")
            setWordWrap(session.wordWrap);
          if (typeof session.statusBar === "boolean")
            setStatusBar(session.statusBar);
          if (session.fontFamily) setFontFamily(session.fontFamily);
          if (session.fontSize) setFontSize(session.fontSize);
          if (session.zoom) setZoom(session.zoom);
          if (isTauri()) await restoreWindowState(session.window);
        }
      } catch (err) {
        console.error("Session restore failed", err);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced autosave
  useEffect(() => {
    if (!ready || !isTauri()) return;
    const timer = setTimeout(() => {
      persistSession();
    }, 400);
    return () => clearTimeout(timer);
  }, [
    tabs,
    activeId,
    wordWrap,
    statusBar,
    fontFamily,
    fontSize,
    zoom,
    ready,
    persistSession,
  ]);

  // Save on close
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten = null;
    const win = getCurrentWindow();
    win
      .onCloseRequested(async (event) => {
        event.preventDefault();
        await persistSession();
        await win.destroy();
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((err) => console.error(err));
    return () => {
      unlisten?.();
    };
  }, [persistSession]);

  // Window title
  useEffect(() => {
    if (!activeTab || !isTauri()) return;
    const title = `${activeTab.dirty ? "*" : ""}${activeTab.title} - NoteEasy`;
    getCurrentWindow().setTitle(title).catch(() => {});
  }, [activeTab]);

  const newTab = useCallback(() => {
    const tab = createTab();
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
  }, []);

  const flushActiveHtml = useCallback(() => {
    const html = editorRef.current?.getHTML?.();
    if (html != null && activeIdRef.current) {
      updateTab(activeIdRef.current, { contentHtml: html });
      return html;
    }
    return tabsRef.current.find((t) => t.id === activeIdRef.current)
      ?.contentHtml;
  }, [updateTab]);

  const saveTab = useCallback(
    async (tabId, { saveAs = false } = {}) => {
      flushActiveHtml();
      const tab = tabsRef.current.find((t) => t.id === tabId);
      if (!tab) return false;

      let filePath = tab.path;
      if (saveAs || !filePath) {
        filePath = await pickSavePath(filePath || `${tab.title}.txt`);
        if (!filePath) return false;
      }

      const html =
        tabId === activeIdRef.current
          ? editorRef.current?.getHTML?.() ?? tab.contentHtml
          : tab.contentHtml;

      await writeDocument(filePath, html);
      updateTab(tabId, {
        path: filePath,
        title: titleFromPath(filePath),
        contentHtml: html,
        dirty: false,
      });
      return true;
    },
    [flushActiveHtml, updateTab],
  );

  const closeTab = useCallback(
    async (tabId) => {
      const tab = tabsRef.current.find((t) => t.id === tabId);
      if (!tab) return;

      if (tab.dirty) {
        const shouldSave = await confirmDiscard(tab.title);
        // ask() returns true for OK (Save), false for cancel (Don't Save)
        // But we also need a Cancel that aborts — plugin ask is binary.
        // Treat true = Save, false = Don't Save. Use a third path via message if needed.
        if (shouldSave) {
          const ok = await saveTab(tabId);
          if (!ok) return;
        }
      }

      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== tabId);
        if (next.length === 0) {
          const fresh = createTab();
          setActiveId(fresh.id);
          return [fresh];
        }
        if (activeIdRef.current === tabId) {
          const idx = prev.findIndex((t) => t.id === tabId);
          const fallback = next[Math.max(0, idx - 1)] ?? next[0];
          setActiveId(fallback.id);
        }
        return next;
      });
    },
    [saveTab],
  );

  const openFile = useCallback(async () => {
    const filePath = await pickOpenPath();
    if (!filePath) return;
    const existing = tabsRef.current.find((t) => t.path === filePath);
    if (existing) {
      setActiveId(existing.id);
      return;
    }
    const doc = await readDocument(filePath);
    const tab = createTab({
      title: titleFromPath(filePath),
      path: filePath,
      contentHtml: doc.contentHtml,
      dirty: false,
      encoding: doc.encoding,
    });
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
  }, []);

  const onEditorUpdate = useCallback(
    (html) => {
      updateTab(activeIdRef.current, { contentHtml: html, dirty: true });
    },
    [updateTab],
  );

  const handleAction = useCallback(
    async (action) => {
      const ed = editorRef.current;
      switch (action) {
        case "new":
          newTab();
          break;
        case "open":
          await openFile();
          break;
        case "save":
          await saveTab(activeIdRef.current);
          break;
        case "saveAs":
          await saveTab(activeIdRef.current, { saveAs: true });
          break;
        case "exit":
          await persistSession();
          await getCurrentWindow().close();
          break;
        case "undo":
          ed?.undo();
          break;
        case "redo":
          ed?.redo();
          break;
        case "cut":
          document.execCommand("cut");
          break;
        case "copy":
          document.execCommand("copy");
          break;
        case "paste":
          document.execCommand("paste");
          break;
        case "selectAll":
          ed?.selectAll();
          break;
        case "find":
          setFindMode("find");
          break;
        case "replace":
          setFindMode("replace");
          break;
        case "wordWrap":
          setWordWrap((v) => !v);
          break;
        case "font":
          setFontOpen(true);
          break;
        case "highlight":
        case "highlightYellow":
          ed?.highlight("#ffeb3b");
          break;
        case "highlightRed":
          ed?.highlight("#ffcdd2");
          break;
        case "highlightGreen":
          ed?.highlight("#c8e6c9");
          break;
        case "highlightBlue":
          ed?.highlight("#bbdefb");
          break;
        case "clearHighlight":
          ed?.clearHighlight();
          break;
        case "zoomIn":
          setZoom((z) => Math.min(500, z + 10));
          break;
        case "zoomOut":
          setZoom((z) => Math.max(10, z - 10));
          break;
        case "zoomReset":
          setZoom(100);
          break;
        case "statusBar":
          setStatusBar((v) => !v);
          break;
        case "about":
          await showInfo(
            "NoteEasy\nA lightweight Notepad with inline text highlighting.\nBuilt with Tauri 2.",
          );
          break;
        default:
          break;
      }
    },
    [newTab, openFile, persistSession, saveTab],
  );

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e) {
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (ctrl && key === "n") {
        e.preventDefault();
        handleAction("new");
      } else if (ctrl && key === "o") {
        e.preventDefault();
        handleAction("open");
      } else if (ctrl && e.shiftKey && key === "s") {
        e.preventDefault();
        handleAction("saveAs");
      } else if (ctrl && key === "s") {
        e.preventDefault();
        handleAction("save");
      } else if (ctrl && key === "f") {
        e.preventDefault();
        handleAction("find");
      } else if (ctrl && key === "h") {
        e.preventDefault();
        handleAction("replace");
      } else if (ctrl && e.shiftKey && key === "h") {
        e.preventDefault();
        handleAction("highlight");
      } else if (ctrl && (key === "=" || key === "+")) {
        e.preventDefault();
        handleAction("zoomIn");
      } else if (ctrl && key === "-") {
        e.preventDefault();
        handleAction("zoomOut");
      } else if (ctrl && key === "0") {
        e.preventDefault();
        handleAction("zoomReset");
      } else if (ctrl && key === "w") {
        e.preventDefault();
        closeTab(activeIdRef.current);
      } else if (e.key === "F3") {
        e.preventDefault();
        if (e.shiftKey) {
          const ok = editorRef.current?.findPrev(findQuery);
          setFindStatus(ok ? "" : "Not found");
        } else {
          const ok = editorRef.current?.findNext(findQuery);
          setFindStatus(ok ? "" : "Not found");
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeTab, findQuery, handleAction]);

  if (!ready || !activeTab) {
    return <div className="app" />;
  }

  return (
    <div className="app">
      <MenuBar
        onAction={handleAction}
        wordWrap={wordWrap}
        statusBar={statusBar}
      />
      <TabBar
        tabs={tabs}
        activeId={activeTab.id}
        onSelect={(id) => {
          flushActiveHtml();
          setActiveId(id);
        }}
        onClose={closeTab}
        onNew={newTab}
      />
      <FindBar
        mode={findMode}
        query={findQuery}
        replaceWith={replaceWith}
        onQueryChange={setFindQuery}
        onReplaceChange={setReplaceWith}
        onFindNext={() => {
          const ok = editorRef.current?.findNext(findQuery);
          setFindStatus(ok ? "" : "Not found");
        }}
        onFindPrev={() => {
          const ok = editorRef.current?.findPrev(findQuery);
          setFindStatus(ok ? "" : "Not found");
        }}
        onReplace={() => {
          editorRef.current?.replaceCurrent(findQuery, replaceWith);
        }}
        onReplaceAll={() => {
          editorRef.current?.replaceAll(findQuery, replaceWith);
        }}
        onClose={() => {
          setFindMode(null);
          setFindStatus("");
          editorRef.current?.focus();
        }}
        status={findStatus}
      />
      <NotepadEditor
        key={activeTab.id}
        ref={editorRef}
        contentHtml={activeTab.contentHtml}
        fontFamily={fontFamily}
        fontSize={displayFontSize}
        wordWrap={wordWrap}
        onUpdate={onEditorUpdate}
        onSelectionChange={({ line: ln, column: col }) => {
          setLine(ln);
          setColumn(col);
        }}
      />
      <StatusBar
        line={line}
        column={column}
        zoom={zoom}
        encoding={activeTab.encoding}
        visible={statusBar}
      />
      {fontOpen && (
        <FontDialog
          fontFamily={fontFamily}
          fontSize={fontSize}
          onCancel={() => setFontOpen(false)}
          onApply={({ family, size }) => {
            setFontFamily(family);
            setFontSize(size);
            setFontOpen(false);
          }}
        />
      )}
    </div>
  );
}

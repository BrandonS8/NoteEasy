import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import TabBar from "./components/TabBar.jsx";
import StatusBar, { countTextStats } from "./components/StatusBar.jsx";
import FindBar from "./components/FindBar.jsx";
import FontDialog from "./components/FontDialog.jsx";
import FormatToolbar, {
  openNativeColorPicker,
} from "./components/FormatToolbar.jsx";
import EditorContextMenu from "./components/EditorContextMenu.jsx";
import NotepadEditor from "./editor/NotepadEditor.jsx";
import { createTab, titleFromPath, suggestedSaveName, htmlToPlainText } from "./state/tabs.js";
import { mergeDocStyles, STYLE_IDS } from "./state/docStyles.js";
import {
  captureWindowState,
  loadSession,
  restoreWindowState,
  ensureWindowVisible,
  saveSession,
} from "./state/session.js";
import {
  confirmDiscard,
  pickOpenPath,
  pickSavePath,
  readDocument,
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
  const [darkMode, setDarkMode] = useState(false);
  const [fontFamily, setFontFamily] = useState("Consolas");
  const [fontSize, setFontSize] = useState(14);
  const [zoom, setZoom] = useState(100);
  const [line, setLine] = useState(1);
  const [column, setColumn] = useState(1);
  const [words, setWords] = useState(0);
  const [characters, setCharacters] = useState(0);
  const [findMode, setFindMode] = useState(null);
  const [findQuery, setFindQuery] = useState("");
  const [replaceWith, setReplaceWith] = useState("");
  const [findStatus, setFindStatus] = useState("");
  const [fontOpen, setFontOpen] = useState(false);
  const [activeFormats, setActiveFormats] = useState({});
  const [ctxMenu, setCtxMenu] = useState(null);
  const [lastCustomHighlight, setLastCustomHighlight] = useState("#c8e6c9");
  const [lastCustomTextColor, setLastCustomTextColor] = useState("#00897b");

  const editorRef = useRef(null);
  const textColorInputRef = useRef(null);
  const highlightColorInputRef = useRef(null);
  /** Keeps toolbar highlight active state in sync on click (editor events can lag/overwrite). */
  const highlightUiLockRef = useRef(null);
  const tabsRef = useRef(tabs);
  const activeIdRef = useRef(activeId);
  const settingsRef = useRef({});

  tabsRef.current = tabs;
  activeIdRef.current = activeId;

  const lockHighlightUi = useCallback((highlight, highlightColor) => {
    highlightUiLockRef.current = {
      highlight,
      highlightColor,
      until: Date.now() + 600,
    };
    setActiveFormats((prev) => ({
      ...prev,
      highlight,
      highlightColor,
    }));
  }, []);

  const onActiveFormatsChange = useCallback((formats) => {
    const lock = highlightUiLockRef.current;
    if (lock && Date.now() < lock.until) {
      setActiveFormats({
        ...formats,
        highlight: lock.highlight,
        highlightColor: lock.highlightColor,
      });
      return;
    }
    highlightUiLockRef.current = null;
    setActiveFormats(formats);
  }, []);
  settingsRef.current = {
    wordWrap,
    statusBar,
    darkMode,
    fontFamily,
    fontSize,
    zoom,
    lastCustomHighlight,
    lastCustomTextColor,
  };

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const displayFontSize = Math.max(8, Math.round((fontSize * zoom) / 100));

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
  }, [darkMode]);

  const updateTab = useCallback((id, patch) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
  }, []);

  const persistSession = useCallback(async () => {
    const windowState = await captureWindowState();
    const s = settingsRef.current;
    // Keep last good window geometry if capture skips (minimized / insane)
    let window = windowState;
    if (!window) {
      try {
        const prev = await loadSession();
        window = prev?.window || undefined;
      } catch {
        window = undefined;
      }
    }
    await saveSession({
      tabs: tabsRef.current.map((t) => ({
        id: t.id,
        title: t.title,
        path: t.path,
        contentHtml: t.contentHtml,
        dirty: t.dirty,
        encoding: t.encoding,
        docStyles: t.docStyles,
      })),
      activeId: activeIdRef.current,
      wordWrap: s.wordWrap,
      statusBar: s.statusBar,
      darkMode: s.darkMode,
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      zoom: s.zoom,
      lastCustomHighlight: s.lastCustomHighlight,
      lastCustomTextColor: s.lastCustomTextColor,
      window,
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
        if (session) {
          if (session.tabs?.length) {
            setTabs(session.tabs.map((t) => createTab(t)));
            setActiveId(session.activeId || session.tabs[0].id);
          }
          if (typeof session.wordWrap === "boolean")
            setWordWrap(session.wordWrap);
          if (typeof session.statusBar === "boolean")
            setStatusBar(session.statusBar);
          if (typeof session.darkMode === "boolean")
            setDarkMode(session.darkMode);
          if (session.fontFamily) setFontFamily(session.fontFamily);
          if (session.fontSize) setFontSize(session.fontSize);
          if (session.zoom) setZoom(session.zoom);
          if (session.lastCustomHighlight)
            setLastCustomHighlight(session.lastCustomHighlight);
          if (session.lastCustomTextColor)
            setLastCustomTextColor(session.lastCustomTextColor);
          if (isTauri()) await restoreWindowState(session.window);
        }
        if (isTauri()) await ensureWindowVisible();
      } catch (err) {
        console.error("Session restore failed", err);
        if (isTauri()) await ensureWindowVisible();
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
    darkMode,
    fontFamily,
    fontSize,
    zoom,
    lastCustomHighlight,
    lastCustomTextColor,
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
        const plain =
          tabId === activeIdRef.current
            ? editorRef.current?.getText?.() ??
              htmlToPlainText(tab.contentHtml)
            : htmlToPlainText(tab.contentHtml);
        const defaultName = suggestedSaveName(tab, plain);
        filePath = await pickSavePath(defaultName);
        if (!filePath) return false;
      }

      const html =
        tabId === activeIdRef.current
          ? editorRef.current?.getHTML?.() ?? tab.contentHtml
          : tab.contentHtml;

      await writeDocument(filePath, html, tab.docStyles);
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

  const closeTabsWhere = useCallback(
    async (predicate) => {
      const ids = tabsRef.current.filter(predicate).map((t) => t.id);
      for (const id of ids) {
        await closeTab(id);
      }
    },
    [closeTab],
  );

  const closeTabsLeft = useCallback(
    (tabId) => {
      const idx = tabsRef.current.findIndex((t) => t.id === tabId);
      if (idx <= 0) return;
      return closeTabsWhere((_, i) => i < idx);
    },
    [closeTabsWhere],
  );

  const closeTabsRight = useCallback(
    (tabId) => {
      const idx = tabsRef.current.findIndex((t) => t.id === tabId);
      if (idx < 0) return;
      return closeTabsWhere((_, i) => i > idx);
    },
    [closeTabsWhere],
  );

  const closeOtherTabs = useCallback(
    (tabId) => closeTabsWhere((t) => t.id !== tabId),
    [closeTabsWhere],
  );

  const closeAllTabs = useCallback(async () => {
    flushActiveHtml();
    const snapshot = [...tabsRef.current];
    for (const tab of snapshot) {
      if (!tab.dirty) continue;
      const shouldSave = await confirmDiscard(tab.title);
      if (shouldSave) {
        const ok = await saveTab(tab.id);
        if (!ok) return;
      }
    }
    const fresh = createTab();
    setTabs([fresh]);
    setActiveId(fresh.id);
    setCtxMenu(null);
    setFindMode(null);
  }, [flushActiveHtml, saveTab]);

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
      docStyles: doc.docStyles || undefined,
    });
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
  }, []);

  const onEditorUpdate = useCallback(
    (html) => {
      updateTab(activeIdRef.current, { contentHtml: html, dirty: true });
      const text = editorRef.current?.getText?.() ?? "";
      const stats = countTextStats(text);
      setWords(stats.words);
      setCharacters(stats.characters);
    },
    [updateTab],
  );

  // Refresh counts when switching tabs
  useEffect(() => {
    if (!ready || !activeTab) return;
    // Prefer live editor text; fall back to stripping HTML roughly via editor after mount
    const t = setTimeout(() => {
      const text = editorRef.current?.getText?.();
      if (text != null) {
        const stats = countTextStats(text);
        setWords(stats.words);
        setCharacters(stats.characters);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [ready, activeTab?.id]);

  const handleAction = useCallback(
    async (action, payload) => {
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
          setFindMode((m) => (m ? null : "find"));
          break;
        case "replace":
          setFindMode("find");
          break;
        case "wordWrap":
          setWordWrap((v) => !v);
          break;
        case "font":
          setFontOpen(true);
          break;
        case "setFontSize":
          if (typeof payload === "number" && payload > 0) {
            ed?.setFontSize(payload);
          }
          break;
        case "nudgeFontSize":
          if (typeof payload === "number" && payload !== 0) {
            ed?.nudgeFontSize?.(payload);
          }
          break;
        case "setTextColor":
          if (payload) ed?.setTextColor(payload);
          break;
        case "clearTextColor":
          ed?.clearTextColor();
          break;
        case "restoreSelection":
          if (payload?.from != null && payload?.to != null) {
            ed?.restoreSelection?.(payload.from, payload.to);
          }
          break;
        case "setDocStyle":
          ed?.setDocStyle(payload || "body");
          break;
        case "updateStyleToMatch": {
          const styleId = payload?.styleId || payload || ed?.getDocStyle?.() || "body";
          if (payload?.from != null && payload?.to != null) {
            ed?.restoreSelection?.(payload.from, payload.to);
          }
          if (!STYLE_IDS.includes(styleId)) break;
          const sample = ed?.sampleStyleFromSelection?.();
          if (!sample) break;
          const tab = tabsRef.current.find((t) => t.id === activeIdRef.current);
          if (!tab) break;
          // Replace the style wholesale so cleared attrs (no color/highlight) stick
          const nextStyles = {
            ...mergeDocStyles(tab.docStyles),
            [styleId]: { ...sample },
          };
          // Push marks + CSS onto every matching paragraph first (visible now)
          ed?.applyStyleToMatching?.(styleId, sample);
          updateTab(activeIdRef.current, {
            docStyles: nextStyles,
            contentHtml: ed?.getHTML?.() ?? tab.contentHtml,
            dirty: true,
          });
          break;
        }
        case "bold":
          ed?.bold();
          break;
        case "italic":
          ed?.italic();
          break;
        case "strike":
          ed?.strike();
          break;
        case "bulletList":
          ed?.bulletList();
          break;
        case "orderedList":
          ed?.orderedList();
          break;
        case "highlight":
        case "highlightYellow": {
          const color = payload || "#ffeb3b";
          lockHighlightUi(true, color);
          ed?.highlight(color);
          break;
        }
        case "highlightRed":
          lockHighlightUi(true, "#ffcdd2");
          ed?.highlight("#ffcdd2");
          break;
        case "highlightGreen":
          lockHighlightUi(true, "#c8e6c9");
          ed?.highlight("#c8e6c9");
          break;
        case "highlightBlue":
          lockHighlightUi(true, "#bbdefb");
          ed?.highlight("#bbdefb");
          break;
        case "clearHighlight":
          lockHighlightUi(false, null);
          ed?.clearHighlight();
          break;
        case "clearFormatting":
          ed?.clearFormatting();
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
        case "setZoom":
          if (typeof payload === "number" && Number.isFinite(payload)) {
            setZoom(Math.min(500, Math.max(10, Math.round(payload))));
          }
          break;
        case "statusBar":
          setStatusBar((v) => !v);
          break;
        case "darkMode":
          setDarkMode((v) => !v);
          break;
        default:
          break;
      }
    },
    [newTab, openFile, persistSession, saveTab, updateTab, lockHighlightUi],
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
      } else if (ctrl && key === "b") {
        e.preventDefault();
        handleAction("bold");
      } else if (ctrl && key === "i") {
        e.preventDefault();
        handleAction("italic");
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
    return <div className={`app${darkMode ? " dark" : ""}`} />;
  }

  return (
    <div className={`app${darkMode ? " dark" : ""}`}>
      <TabBar
        tabs={tabs}
        activeId={activeTab.id}
        onSelect={(id) => {
          flushActiveHtml();
          setActiveId(id);
          setCtxMenu(null);
        }}
        onClose={closeTab}
        onCloseLeft={closeTabsLeft}
        onCloseRight={closeTabsRight}
        onCloseOthers={closeOtherTabs}
        onCloseAll={closeAllTabs}
        onNew={newTab}
      />
      <FormatToolbar
        onAction={handleAction}
        active={activeFormats}
        selectionFontSize={activeFormats.fontSize}
        baseFontSize={fontSize}
        lastCustomHighlight={lastCustomHighlight}
        lastCustomTextColor={lastCustomTextColor}
        darkMode={darkMode}
        zoom={zoom}
        findOpen={!!findMode}
        textColorInputRef={textColorInputRef}
        highlightColorInputRef={highlightColorInputRef}
      />
      <input
        ref={textColorInputRef}
        type="color"
        className="sr-color-input"
        defaultValue="#00897b"
        onChange={(e) => {
          const color = e.target.value;
          setLastCustomTextColor(color);
          handleAction("setTextColor", color);
        }}
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        ref={highlightColorInputRef}
        type="color"
        className="sr-color-input"
        defaultValue="#c8e6c9"
        onChange={(e) => {
          const color = e.target.value;
          setLastCustomHighlight(color);
          handleAction("highlight", color);
        }}
        tabIndex={-1}
        aria-hidden="true"
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
        baseFontSize={displayFontSize}
        wordWrap={wordWrap}
        docStyles={activeTab.docStyles}
        onUpdate={onEditorUpdate}
        onSelectionChange={({ line: ln, column: col }) => {
          setLine(ln);
          setColumn(col);
        }}
        onActiveFormatsChange={onActiveFormatsChange}
        onContextMenu={(pos) => setCtxMenu(pos)}
      />
      <StatusBar
        line={line}
        column={column}
        zoom={zoom}
        encoding={activeTab.encoding}
        visible={statusBar}
        words={words}
        characters={characters}
      />
      {ctxMenu && (
        <EditorContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          currentStyle={ctxMenu.docStyle || activeFormats.docStyle || "body"}
          active={activeFormats}
          selectionFrom={ctxMenu.selectionFrom}
          selectionTo={ctxMenu.selectionTo}
          onAction={handleAction}
          onClose={() => setCtxMenu(null)}
          onCustomHighlight={(anchorEl) => {
            openNativeColorPicker(
              highlightColorInputRef.current,
              anchorEl || document.querySelector(".ctx-menu"),
              lastCustomHighlight || "#c8e6c9",
            );
          }}
        />
      )}
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

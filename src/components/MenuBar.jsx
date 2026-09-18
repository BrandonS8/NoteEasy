import { useEffect, useRef, useState } from "react";

const MENUS = [
  {
    id: "file",
    label: "File",
    items: [
      { id: "new", label: "New Tab", accel: "Ctrl+N" },
      { id: "open", label: "Open...", accel: "Ctrl+O" },
      { id: "save", label: "Save", accel: "Ctrl+S" },
      { id: "saveAs", label: "Save As...", accel: "Ctrl+Shift+S" },
      { sep: true },
      { id: "exit", label: "Exit", accel: "Alt+F4" },
    ],
  },
  {
    id: "edit",
    label: "Edit",
    items: [
      { id: "undo", label: "Undo", accel: "Ctrl+Z" },
      { id: "redo", label: "Redo", accel: "Ctrl+Y" },
      { sep: true },
      { id: "cut", label: "Cut", accel: "Ctrl+X" },
      { id: "copy", label: "Copy", accel: "Ctrl+C" },
      { id: "paste", label: "Paste", accel: "Ctrl+V" },
      { id: "selectAll", label: "Select All", accel: "Ctrl+A" },
      { sep: true },
      { id: "find", label: "Find", accel: "Ctrl+F" },
      { id: "replace", label: "Replace", accel: "Ctrl+H" },
    ],
  },
  {
    id: "format",
    label: "Format",
    items: [
      { id: "wordWrap", label: "Word Wrap", check: true },
      { id: "font", label: "Font..." },
      { sep: true },
      { id: "bold", label: "Bold", accel: "Ctrl+B" },
      { id: "italic", label: "Italic", accel: "Ctrl+I" },
      { id: "strike", label: "Strikethrough" },
      { id: "bulletList", label: "Bulleted List" },
      { id: "orderedList", label: "Numbered List" },
      { sep: true },
      { id: "highlight", label: "Highlight", accel: "Ctrl+Shift+H" },
      { id: "highlightYellow", label: "Highlight Yellow" },
      { id: "highlightRed", label: "Highlight Red" },
      { id: "highlightGreen", label: "Highlight Green" },
      { id: "highlightBlue", label: "Highlight Blue" },
      { id: "clearHighlight", label: "Clear Highlight" },
    ],
  },
  {
    id: "view",
    label: "View",
    items: [
      { id: "zoomIn", label: "Zoom In", accel: "Ctrl+Plus" },
      { id: "zoomOut", label: "Zoom Out", accel: "Ctrl+Minus" },
      { id: "zoomReset", label: "Restore Default Zoom", accel: "Ctrl+0" },
      { sep: true },
      { id: "darkMode", label: "Dark Mode", check: true },
      { id: "statusBar", label: "Status Bar", check: true },
    ],
  },
];

export default function MenuBar({ onAction, wordWrap, statusBar, darkMode }) {
  const [openId, setOpenId] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!rootRef.current?.contains(e.target)) setOpenId(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="menu-bar" ref={rootRef} role="menubar">
      {MENUS.map((menu) => (
        <div className="menu-item" key={menu.id}>
          <button
            type="button"
            className={`menu-button${openId === menu.id ? " open" : ""}`}
            onClick={() =>
              setOpenId((cur) => (cur === menu.id ? null : menu.id))
            }
            onMouseEnter={() => {
              if (openId) setOpenId(menu.id);
            }}
          >
            {menu.label}
          </button>
          {openId === menu.id && (
            <div className="menu-dropdown" role="menu">
              {menu.items.map((item, idx) =>
                item.sep ? (
                  <div className="menu-sep" key={`sep-${idx}`} />
                ) : (
                  <button
                    type="button"
                    className="menu-row"
                    key={item.id}
                    onClick={() => {
                      setOpenId(null);
                      onAction(item.id);
                    }}
                  >
                    <span>
                      {item.check ? (
                        <span className="menu-check">
                          {(item.id === "wordWrap" && wordWrap) ||
                          (item.id === "statusBar" && statusBar) ||
                          (item.id === "darkMode" && darkMode)
                            ? "✓"
                            : ""}
                        </span>
                      ) : null}
                      {item.label}
                    </span>
                    {item.accel ? (
                      <span className="accel">{item.accel}</span>
                    ) : null}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

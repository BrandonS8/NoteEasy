import { useEditor, EditorContent } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";
import History from "@tiptap/extension-history";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Strike from "@tiptap/extension-strike";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import {
  useEffect,
  useImperativeHandle,
  forwardRef,
  useRef,
} from "react";
import { TextSelection } from "@tiptap/pm/state";
import { StyledParagraph } from "./StyledParagraph.js";
import { FontSize } from "./FontSize.js";
import { buildDocStylesCss, mergeDocStyles } from "../state/docStyles.js";
import {
  applyStyleDefToParagraphs,
  sampleStyleFromEditor,
} from "./applyDocStyle.js";

const NotepadEditor = forwardRef(function NotepadEditor(
  {
    contentHtml,
    fontFamily,
    baseFontSize,
    wordWrap,
    docStyles,
    onUpdate,
    onSelectionChange,
    onActiveFormatsChange,
    onContextMenu,
    editable = true,
  },
  ref,
) {
  const applyingExternal = useRef(false);
  const shellRef = useRef(null);
  const styleTagRef = useRef(null);
  const onContextMenuRef = useRef(onContextMenu);
  onContextMenuRef.current = onContextMenu;
  const onActiveFormatsChangeRef = useRef(onActiveFormatsChange);
  onActiveFormatsChangeRef.current = onActiveFormatsChange;
  /** When true, caret typing has highlight forced off until a highlight is chosen or the caret moves. */
  const highlightTypingOffRef = useRef(false);
  const lastSelRef = useRef({ from: 0, to: 0 });
  const docStylesRef = useRef(docStyles);
  docStylesRef.current = docStyles;
  const baseFontSizeRef = useRef(baseFontSize);
  baseFontSizeRef.current = baseFontSize;

  const editor = useEditor({
    extensions: [
      Document,
      StyledParagraph,
      Text,
      History,
      Bold,
      Italic,
      Strike,
      BulletList,
      OrderedList,
      ListItem,
      TextStyle,
      FontSize.configure({
        getInheritedSize: (styleId) => {
          const def = mergeDocStyles(docStylesRef.current)[styleId];
          if (typeof def?.fontSize === "number") return def.fontSize;
          return baseFontSizeRef.current;
        },
        fallbackSize: 16,
      }),
      Color,
      Highlight.configure({
        multicolor: true,
        HTMLAttributes: { class: "nte-highlight" },
      }),
    ],
    content: contentHtml || "<p></p>",
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "notepad-editor",
        spellcheck: "false",
      },
      handleDOMEvents: {
        contextmenu: (view, event) => {
          event.preventDefault();
          // Snapshot first — browsers / our own code used to collapse the range
          // on right-click, which broke “Update style to match”.
          const { from, to } = view.state.selection;
          const coords = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });

          let style =
            view.state.selection.$from.parent.attrs?.docStyle || "body";
          // With a range selection, the style to update is the selection's —
          // don't switch the menu label to a different paragraph under the click.
          if (view.state.selection.empty && coords) {
            const $pos = view.state.doc.resolve(coords.pos);
            for (let d = $pos.depth; d > 0; d--) {
              const node = $pos.node(d);
              if (node.type.name === "paragraph") {
                style = node.attrs.docStyle || "body";
                break;
              }
            }
          }

          // Restore if something already collapsed the ProseMirror selection
          if (
            from !== to &&
            (view.state.selection.from !== from ||
              view.state.selection.to !== to)
          ) {
            view.dispatch(
              view.state.tr.setSelection(
                TextSelection.create(view.state.doc, from, to),
              ),
            );
          }

          onContextMenuRef.current?.({
            x: event.clientX,
            y: event.clientY,
            docStyle: style,
            selectionFrom: from,
            selectionTo: to,
          });
          return true;
        },
      },
      transformPastedHTML(html) {
        const doc = new DOMParser().parseFromString(html, "text/html");
        doc
          .querySelectorAll("script, style, meta, link")
          .forEach((n) => n.remove());
        const allowed = new Set([
          "P",
          "BR",
          "STRONG",
          "B",
          "EM",
          "I",
          "S",
          "STRIKE",
          "DEL",
          "MARK",
          "UL",
          "OL",
          "LI",
          "SPAN",
        ]);
        doc.body.querySelectorAll("*").forEach((el) => {
          if (!allowed.has(el.tagName)) el.replaceWith(...el.childNodes);
        });
        return doc.body.innerHTML || "<p></p>";
      },
      handleKeyDown(_view, event) {
        if (
          event.ctrlKey &&
          event.key.toLowerCase() === "h" &&
          !event.shiftKey
        ) {
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (applyingExternal.current) return;
      onUpdate?.(ed.getHTML());
      onActiveFormatsChangeRef.current?.(
        readFormats(ed, highlightTypingOffRef.current),
      );
    },
    onSelectionUpdate: ({ editor: ed }) => {
      const { from, to } = ed.state.selection;
      const prev = lastSelRef.current;
      if (from !== prev.from || to !== prev.to) {
        highlightTypingOffRef.current = false;
        lastSelRef.current = { from, to };
      }
      onSelectionChange?.(getLineCol(ed));
      onActiveFormatsChangeRef.current?.(
        readFormats(ed, highlightTypingOffRef.current),
      );
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (contentHtml == null) return;
    if (contentHtml === editor.getHTML()) return;
    applyingExternal.current = true;
    editor.commands.setContent(contentHtml, { emitUpdate: false });
    applyingExternal.current = false;
  }, [contentHtml, editor]);

  useEffect(() => {
    if (!editor) return;
    const el = editor.view.dom;
    el.style.fontFamily = fontFamily;
    el.style.fontSize = `${baseFontSize}px`;
  }, [editor, fontFamily, baseFontSize]);

  useEffect(() => {
    if (!styleTagRef.current) {
      styleTagRef.current = document.createElement("style");
      styleTagRef.current.setAttribute("data-noteeasy-doc-styles", "1");
      document.head.appendChild(styleTagRef.current);
    }
    styleTagRef.current.textContent = buildDocStylesCss(
      docStyles,
      baseFontSize,
    );
  }, [docStyles, baseFontSize]);

  useEffect(() => {
    return () => {
      styleTagRef.current?.remove();
      styleTagRef.current = null;
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => editor?.commands.focus(),
      getHTML: () => editor?.getHTML() ?? "<p></p>",
      getText: () => editor?.getText({ blockSeparator: "\n" }) ?? "",
      undo: () => editor?.chain().focus().undo().run(),
      redo: () => editor?.chain().focus().redo().run(),
      selectAll: () => editor?.chain().focus().selectAll().run(),
      bold: () => {
        if (!editor) return false;
        const ok = editor.chain().focus().toggleBold().run();
        onActiveFormatsChangeRef.current?.(
          readFormats(editor, highlightTypingOffRef.current),
        );
        return ok;
      },
      italic: () => {
        if (!editor) return false;
        const ok = editor.chain().focus().toggleItalic().run();
        onActiveFormatsChangeRef.current?.(
          readFormats(editor, highlightTypingOffRef.current),
        );
        return ok;
      },
      strike: () => {
        if (!editor) return false;
        const ok = editor.chain().focus().toggleStrike().run();
        onActiveFormatsChangeRef.current?.(
          readFormats(editor, highlightTypingOffRef.current),
        );
        return ok;
      },
      bulletList: () => editor?.chain().focus().toggleBulletList().run(),
      orderedList: () => editor?.chain().focus().toggleOrderedList().run(),
      highlight: (color = "#ffeb3b") => {
        if (!editor) return false;
        highlightTypingOffRef.current = false;
        lastSelRef.current = {
          from: editor.state.selection.from,
          to: editor.state.selection.to,
        };
        editor.chain().focus().setHighlight({ color }).run();
        onActiveFormatsChangeRef.current?.(
          readFormats(editor, highlightTypingOffRef.current),
        );
        return true;
      },
      clearHighlight: () => {
        if (!editor) return false;
        const highlightType = editor.state.schema.marks.highlight;
        if (!highlightType) return false;

        highlightTypingOffRef.current = true;
        lastSelRef.current = {
          from: editor.state.selection.from,
          to: editor.state.selection.to,
        };

        function applyClear(state) {
          let tr = state.tr;
          if (!state.selection.empty) {
            tr = tr.removeMark(
              state.selection.from,
              state.selection.to,
              highlightType,
            );
            // Cleared a range — off-flag is only for caret typing
            highlightTypingOffRef.current = state.selection.empty;
          }
          const baseMarks = state.storedMarks || state.selection.$from.marks();
          const nextMarks = baseMarks.filter((m) => m.type !== highlightType);
          return tr.setStoredMarks(nextMarks);
        }

        editor.view.dispatch(applyClear(editor.state));
        if (!editor.view.hasFocus()) editor.view.focus();

        queueMicrotask(() => {
          if (editor.isDestroyed) return;
          if (
            editor.state.selection.empty &&
            highlightTypingOffRef.current
          ) {
            const sm = editor.state.storedMarks;
            const lost =
              sm == null || sm.some((m) => m.type === highlightType);
            if (lost) editor.view.dispatch(applyClear(editor.state));
          }
          onActiveFormatsChangeRef.current?.(
            readFormats(editor, highlightTypingOffRef.current),
          );
        });

        onActiveFormatsChangeRef.current?.(
          readFormats(editor, highlightTypingOffRef.current),
        );
        return true;
      },
      clearFormatting: () => {
        if (!editor) return false;
        const { empty, $from } = editor.state.selection;

        // Empty caret → select current block so marks/styles actually clear
        if (empty) {
          editor
            .chain()
            .focus()
            .setTextSelection({ from: $from.start(), to: $from.end() })
            .run();
        }

        editor
          .chain()
          .focus()
          .unsetAllMarks()
          .unsetHighlight()
          .unsetColor()
          .unsetFontSize()
          .clearNodes()
          .run();

        // Reset named paragraph styles in the current selection
        const { from, to } = editor.state.selection;
        const tr = editor.state.tr;
        editor.state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type.name === "paragraph" && node.attrs.docStyle !== "body") {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              docStyle: "body",
            });
          }
        });
        if (tr.docChanged) {
          editor.view.dispatch(tr);
        }
        return true;
      },
      setFontSize: (size) => {
        if (!editor) return false;
        const ok = editor.chain().focus().setFontSize(size).run();
        onActiveFormatsChangeRef.current?.(
          readFormats(editor, highlightTypingOffRef.current),
        );
        return ok;
      },
      nudgeFontSize: (delta) => {
        if (!editor) return false;
        const ok = editor.chain().focus().nudgeFontSize(delta).run();
        onActiveFormatsChangeRef.current?.(
          readFormats(editor, highlightTypingOffRef.current),
        );
        return ok;
      },
      setTextColor: (color) => {
        if (!editor) return false;
        const ok = editor.chain().focus().setColor(color).run();
        onActiveFormatsChangeRef.current?.(
          readFormats(editor, highlightTypingOffRef.current),
        );
        return ok;
      },
      clearTextColor: () => {
        if (!editor) return false;
        const ok = editor.chain().focus().unsetColor().run();
        onActiveFormatsChangeRef.current?.(
          readFormats(editor, highlightTypingOffRef.current),
        );
        return ok;
      },
      setDocStyle: (styleId) => {
        if (!editor) return false;
        const id = styleId || "body";
        editor
          .chain()
          .focus()
          .updateAttributes("paragraph", { docStyle: id })
          .run();
        const def = mergeDocStyles(docStylesRef.current)[id];
        return applyStyleDefToParagraphs(editor, id, def, baseFontSize, {
          onlySelection: true,
        });
      },
      getDocStyle: () =>
        editor?.state.selection.$from.parent.attrs?.docStyle || "body",
      sampleStyleFromSelection: () =>
        sampleStyleFromEditor(editor, baseFontSize),
      restoreSelection: (from, to) => {
        if (!editor || from == null || to == null) return false;
        try {
          return editor
            .chain()
            .setTextSelection({ from, to })
            .run();
        } catch {
          return false;
        }
      },
      /** Re-apply a style definition to every paragraph using that style. */
      applyStyleToMatching: (styleId, def) => {
        if (!editor || !styleId || !def) return false;
        // Sync CSS immediately so paint matches marks even before React commits
        if (styleTagRef.current) {
          const next = mergeDocStyles({
            ...docStylesRef.current,
            [styleId]: def,
          });
          styleTagRef.current.textContent = buildDocStylesCss(
            next,
            baseFontSize,
          );
        }
        return applyStyleDefToParagraphs(editor, styleId, def, baseFontSize);
      },
      findNext: (query, fromStart = false) =>
        findInEditor(editor, query, true, fromStart),
      findPrev: (query) => findInEditor(editor, query, false, false),
      replaceCurrent: (query, replacement) =>
        replaceInEditor(editor, query, replacement, false),
      replaceAll: (query, replacement) =>
        replaceInEditor(editor, query, replacement, true),
      getLineCol: () => getLineCol(editor),
    }),
    [editor, baseFontSize, docStyles],
  );

  function focusEditor(e) {
    if (
      e.target === shellRef.current ||
      e.target.classList?.contains("tiptap")
    ) {
      editor?.commands.focus("end");
    }
  }

  return (
    <div
      ref={shellRef}
      className={`editor-shell${wordWrap ? "" : " no-wrap"}`}
      onMouseDown={focusEditor}
    >
      <EditorContent editor={editor} />
    </div>
  );
});

function readFormats(editor, highlightTypingOff = false) {
  if (!editor) {
    return {
      bold: false,
      italic: false,
      strike: false,
      bulletList: false,
      orderedList: false,
      highlight: false,
      highlightColor: null,
      textColor: null,
      fontSize: null,
      docStyle: "body",
    };
  }
  const textStyle = editor.getAttributes("textStyle");
  const highlightAttrs = editor.getAttributes("highlight");
  const { selection, storedMarks } = editor.state;
  const typingMarks =
    selection.empty && storedMarks != null ? storedMarks : null;

  function markOn(name) {
    if (typingMarks != null) {
      return typingMarks.some((m) => m.type.name === name);
    }
    return editor.isActive(name);
  }

  const typingHighlight =
    typingMarks != null
      ? typingMarks.find((m) => m.type.name === "highlight")
      : null;

  let highlight;
  let highlightColor;
  if (highlightTypingOff) {
    highlight = false;
    highlightColor = null;
  } else if (typingMarks != null) {
    highlight = !!typingHighlight;
    highlightColor = typingHighlight?.attrs?.color || null;
  } else {
    highlight = editor.isActive("highlight");
    highlightColor = highlightAttrs?.color || null;
  }

  let textColor = textStyle?.color || null;
  let fontSize = textStyle?.fontSize || null;
  if (typingMarks != null) {
    const ts = typingMarks.find((m) => m.type.name === "textStyle");
    if (ts) {
      if (ts.attrs?.color != null) textColor = ts.attrs.color;
      if (ts.attrs?.fontSize != null) fontSize = ts.attrs.fontSize;
    } else {
      // Explicit empty stored marks → don't inherit neighbor color/size for UI
      textColor = null;
      fontSize = null;
    }
  }

  return {
    bold: markOn("bold"),
    italic: markOn("italic"),
    strike: markOn("strike"),
    bulletList: editor.isActive("bulletList"),
    orderedList: editor.isActive("orderedList"),
    highlight,
    highlightColor,
    textColor,
    fontSize,
    docStyle: editor.state.selection.$from.parent.attrs?.docStyle || "body",
  };
}

function getLineCol(editor) {
  if (!editor) return { line: 1, column: 1 };
  const { from } = editor.state.selection;
  const text = editor.state.doc.textBetween(0, from, "\n", "\n");
  const lines = text.split("\n");
  return {
    line: lines.length,
    column: (lines[lines.length - 1]?.length ?? 0) + 1,
  };
}

function findInEditor(editor, query, forward, fromStart) {
  if (!editor || !query) return false;
  const haystack = editor.state.doc.textBetween(
    0,
    editor.state.doc.content.size,
    "\n",
    "\n",
  );
  const q = query.toLowerCase();
  const lower = haystack.toLowerCase();
  const sel = editor.state.selection;
  let startIndex = fromStart
    ? 0
    : forward
      ? textPosToIndex(editor, sel.to)
      : Math.max(0, textPosToIndex(editor, sel.from) - 1);

  let found = -1;
  if (forward) {
    found = lower.indexOf(q, startIndex);
    if (found < 0 && !fromStart) found = lower.indexOf(q, 0);
  } else {
    found = lower.slice(0, startIndex).lastIndexOf(q);
    if (found < 0) found = lower.lastIndexOf(q);
  }
  if (found < 0) return false;
  const from = indexToPos(editor, found);
  const to = indexToPos(editor, found + query.length);
  editor.chain().focus().setTextSelection({ from, to }).run();
  return true;
}

function replaceInEditor(editor, query, replacement, all) {
  if (!editor || !query) return 0;
  if (all) {
    const text = editor.getText({ blockSeparator: "\n" });
    if (!text.toLowerCase().includes(query.toLowerCase())) return 0;
    const re = new RegExp(escapeRegExp(query), "gi");
    const next = text.replace(re, replacement);
    const html = next
      .split("\n")
      .map((line) => {
        const escaped = line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        return `<p>${escaped || "<br>"}</p>`;
      })
      .join("");
    editor.commands.setContent(html, { emitUpdate: true });
    return 1;
  }
  const { from, to } = editor.state.selection;
  const selected = editor.state.doc.textBetween(from, to, "\n", "\n");
  if (selected.toLowerCase() === query.toLowerCase()) {
    editor.chain().focus().insertContentAt({ from, to }, replacement).run();
    findInEditor(editor, query, true, false);
    return 1;
  }
  if (findInEditor(editor, query, true, false)) {
    return replaceInEditor(editor, query, replacement, false);
  }
  return 0;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textPosToIndex(editor, pmPos) {
  return editor.state.doc.textBetween(0, pmPos, "\n", "\n").length;
}

function indexToPos(editor, index) {
  const total = editor.state.doc.content.size;
  let lo = 1;
  let hi = total;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const len = editor.state.doc.textBetween(0, mid, "\n", "\n").length;
    if (len < index) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export default NotepadEditor;

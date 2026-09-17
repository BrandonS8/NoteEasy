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
import { StyledParagraph } from "./StyledParagraph.js";
import { FontSize } from "./FontSize.js";
import { buildDocStylesCss } from "../state/docStyles.js";

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
      FontSize,
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
          const style =
            view.state.selection.$from.parent.attrs?.docStyle || "body";
          onContextMenu?.({
            x: event.clientX,
            y: event.clientY,
            docStyle: style,
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
      onActiveFormatsChange?.(readFormats(ed));
    },
    onSelectionUpdate: ({ editor: ed }) => {
      onSelectionChange?.(getLineCol(ed));
      onActiveFormatsChange?.(readFormats(ed));
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
      bold: () => editor?.chain().focus().toggleBold().run(),
      italic: () => editor?.chain().focus().toggleItalic().run(),
      strike: () => editor?.chain().focus().toggleStrike().run(),
      bulletList: () => editor?.chain().focus().toggleBulletList().run(),
      orderedList: () => editor?.chain().focus().toggleOrderedList().run(),
      highlight: (color = "#ffeb3b") =>
        editor?.chain().focus().toggleHighlight({ color }).run(),
      clearHighlight: () => editor?.chain().focus().unsetHighlight().run(),
      clearFormatting: () =>
        editor
          ?.chain()
          .focus()
          .unsetAllMarks()
          .updateAttributes("paragraph", { docStyle: "body" })
          .run(),
      setFontSize: (size) => editor?.chain().focus().setFontSize(size).run(),
      setTextColor: (color) => editor?.chain().focus().setColor(color).run(),
      clearTextColor: () => editor?.chain().focus().unsetColor().run(),
      setDocStyle: (styleId) =>
        editor
          ?.chain()
          .focus()
          .updateAttributes("paragraph", { docStyle: styleId || "body" })
          .run(),
      getDocStyle: () =>
        editor?.state.selection.$from.parent.attrs?.docStyle || "body",
      sampleStyleFromSelection: () => {
        if (!editor) return null;
        const { from } = editor.state.selection;
        const dom = editor.view.domAtPos(from).node;
        const el =
          dom.nodeType === 1
            ? dom.closest?.("p") || dom
            : dom.parentElement?.closest?.("p");
        const computed = el ? window.getComputedStyle(el) : null;
        const size = computed ? parseInt(computed.fontSize, 10) : baseFontSize;
        return {
          fontSize: size || baseFontSize,
          bold:
            editor.isActive("bold") ||
            (computed && parseInt(computed.fontWeight, 10) >= 600),
          italic:
            editor.isActive("italic") || computed?.fontStyle === "italic",
        };
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
    [editor, baseFontSize],
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

function readFormats(editor) {
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
  return {
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    strike: editor.isActive("strike"),
    bulletList: editor.isActive("bulletList"),
    orderedList: editor.isActive("orderedList"),
    highlight: editor.isActive("highlight"),
    highlightColor: highlightAttrs?.color || null,
    textColor: textStyle?.color || null,
    fontSize: textStyle?.fontSize || null,
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

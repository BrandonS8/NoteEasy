import { useEditor, EditorContent } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import History from "@tiptap/extension-history";
import Highlight from "@tiptap/extension-highlight";
import { useEffect, useImperativeHandle, forwardRef } from "react";

/**
 * Notepad-style editor: flush paragraphs (inline line flow) + highlight marks only.
 */
const NotepadEditor = forwardRef(function NotepadEditor(
  {
    contentHtml,
    fontFamily,
    fontSize,
    wordWrap,
    onUpdate,
    onSelectionChange,
    editable = true,
  },
  ref,
) {
  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      History,
      Highlight.configure({
        multicolor: true,
        HTMLAttributes: {
          class: "nte-highlight",
        },
      }),
    ],
    content: contentHtml || "<p></p>",
    editable,
    editorProps: {
      attributes: {
        class: "notepad-editor",
        spellcheck: "false",
        style: `font-family: ${fontFamily}; font-size: ${fontSize}px;`,
      },
      // Keep paste feeling like Notepad: plain text lines, no foreign blocks
      transformPastedHTML(html) {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const text = doc.body.innerText || doc.body.textContent || "";
        const lines = text.replace(/\r\n/g, "\n").split("\n");
        return lines
          .map((line) => {
            const escaped = line
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;");
            return `<p>${escaped || "<br>"}</p>`;
          })
          .join("");
      },
      handleKeyDown(view, event) {
        // Ctrl+H is replace in Notepad; don't let browser open history
        if (event.ctrlKey && event.key.toLowerCase() === "h") {
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      onUpdate?.(ed.getHTML());
    },
    onSelectionUpdate: ({ editor: ed }) => {
      onSelectionChange?.(getLineCol(ed));
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (contentHtml != null && contentHtml !== current) {
      editor.commands.setContent(contentHtml, false);
    }
  }, [contentHtml, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        attributes: {
          ...editor.options.editorProps.attributes,
          style: `font-family: ${fontFamily}; font-size: ${fontSize}px;`,
        },
      },
    });
  }, [editor, fontFamily, fontSize]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => editor?.commands.focus(),
      getHTML: () => editor?.getHTML() ?? "<p></p>",
      getText: () => editor?.getText({ blockSeparator: "\n" }) ?? "",
      undo: () => editor?.chain().focus().undo().run(),
      redo: () => editor?.chain().focus().redo().run(),
      selectAll: () =>
        editor?.chain().focus().selectAll().run(),
      highlight: (color = "#ffeb3b") =>
        editor?.chain().focus().toggleHighlight({ color }).run(),
      clearHighlight: () =>
        editor?.chain().focus().unsetHighlight().run(),
      findNext: (query, fromStart = false) => findInEditor(editor, query, true, fromStart),
      findPrev: (query) => findInEditor(editor, query, false, false),
      replaceCurrent: (query, replacement) =>
        replaceInEditor(editor, query, replacement, false),
      replaceAll: (query, replacement) =>
        replaceInEditor(editor, query, replacement, true),
      getLineCol: () => getLineCol(editor),
    }),
    [editor],
  );

  return (
    <div className={`editor-shell${wordWrap ? "" : " no-wrap"}`}>
      <EditorContent editor={editor} />
    </div>
  );
});

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
  let startIndex;

  if (fromStart) {
    startIndex = 0;
  } else if (forward) {
    startIndex = sel.to;
  } else {
    startIndex = Math.max(0, sel.from - 1);
  }

  let found = -1;
  if (forward) {
    found = lower.indexOf(q, textPosToIndex(editor, startIndex));
    if (found < 0 && !fromStart) found = lower.indexOf(q, 0);
  } else {
    const before = lower.slice(0, textPosToIndex(editor, startIndex));
    found = before.lastIndexOf(q);
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
    // Rebuild as plain paragraphs after global replace (highlights lost on replace-all — acceptable)
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
    editor.commands.setContent(html);
    return 1;
  }

  const { from, to } = editor.state.selection;
  const selected = editor.state.doc.textBetween(from, to, "\n", "\n");
  if (selected.toLowerCase() === query.toLowerCase()) {
    editor
      .chain()
      .focus()
      .insertContentAt({ from, to }, replacement)
      .run();
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

/** Map plain-text index (with \\n between blocks) to ProseMirror position — approximate via scan */
function textPosToIndex(editor, pmPos) {
  return editor.state.doc.textBetween(0, pmPos, "\n", "\n").length;
}

function indexToPos(editor, index) {
  let remaining = index;
  let found = 1;
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) {
      if (node.isBlock && pos > 0) {
        // account for newline between blocks already in textBetween
      }
      return true;
    }
    const len = node.text.length;
    if (remaining <= len) {
      found = pos + remaining;
      return false;
    }
    remaining -= len;
    return true;
  });

  // Prefer scanning with textBetween mapping
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

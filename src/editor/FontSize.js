import { Extension } from "@tiptap/core";

/** Adds fontSize to TextStyle marks (selection-scoped). */
export const FontSize = Extension.create({
  name: "fontSize",

  addOptions() {
    return { types: ["textStyle"] };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => {
              const size = element.style.fontSize;
              if (!size) return null;
              const n = parseInt(size, 10);
              return Number.isFinite(n) ? n : null;
            },
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}px` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain()
            .setMark("textStyle", { fontSize: null })
            .removeEmptyTextStyle()
            .run(),
      /** Bump each selected text run by delta px from its own current size. */
      nudgeFontSize:
        (delta) =>
        ({ state, tr, dispatch }) => {
          if (!delta) return false;
          const textStyle = state.schema.marks.textStyle;
          if (!textStyle) return false;

          let { from, to } = state.selection;
          if (from === to) {
            const $from = state.selection.$from;
            from = $from.start();
            to = $from.end();
          }

          let changed = false;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (!node.isText || !node.text) return;
            const start = Math.max(from, pos);
            const end = Math.min(to, pos + node.nodeSize);
            if (start >= end) return;

            const existing = node.marks.find((m) => m.type === textStyle);
            let current =
              typeof existing?.attrs?.fontSize === "number"
                ? existing.attrs.fontSize
                : null;

            if (current == null) {
              // Inherit from paragraph named style or fall back later in caller
              const $pos = state.doc.resolve(pos);
              for (let d = $pos.depth; d > 0; d--) {
                const parent = $pos.node(d);
                if (parent.type.name === "paragraph") {
                  const styleId = parent.attrs.docStyle || "body";
                  const inherited = this.options.getInheritedSize?.(styleId);
                  if (typeof inherited === "number") current = inherited;
                  break;
                }
              }
            }
            if (current == null) {
              current = this.options.fallbackSize || 14;
            }

            const next = Math.max(8, Math.min(200, current + delta));
            if (next === existing?.attrs?.fontSize) return;

            const color = existing?.attrs?.color || null;
            tr.removeMark(start, end, textStyle);
            tr.addMark(
              start,
              end,
              textStyle.create({ fontSize: next, color }),
            );
            changed = true;
          });

          if (changed && dispatch) dispatch(tr.scrollIntoView());
          return changed;
        },
    };
  },
});

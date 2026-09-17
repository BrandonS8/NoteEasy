import Paragraph from "@tiptap/extension-paragraph";

/**
 * Paragraph with a named document style (title, subtitle, heading1–5, body).
 */
export const StyledParagraph = Paragraph.extend({
  name: "paragraph",

  addAttributes() {
    return {
      ...this.parent?.(),
      docStyle: {
        default: "body",
        parseHTML: (element) =>
          element.getAttribute("data-doc-style") || "body",
        renderHTML: (attributes) => {
          const style = attributes.docStyle || "body";
          if (style === "body") return {};
          return { "data-doc-style": style };
        },
      },
    };
  },
});

export default StyledParagraph;

import { defineMdastPlugin } from "satteri";

const lessonSourcePattern = /^(?:\.\/)?(\d{2}|08[AB])-[^#]+\.md(#[^\s]*)?$/u;

export const lessonLinksPlugin = defineMdastPlugin({
  name: "lesson-links",
  link(node, context) {
    const match = lessonSourcePattern.exec(node.url);

    if (!match) {
      return;
    }

    const [, lessonId, hash = ""] = match;
    context.setProperty(node, "url", `/lessons/${lessonId.toLowerCase()}${hash}`);
  },
});

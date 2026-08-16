import { defineConfig } from "astro/config";
import { satteri } from "@astrojs/markdown-satteri";

import { lessonLinksPlugin } from "./src/markdown/lesson-links.ts";

export default defineConfig({
  output: "static",
  trailingSlash: "never",
  markdown: {
    processor: satteri({
      mdastPlugins: [lessonLinksPlugin],
      features: {
        gfm: true,
        smartPunctuation: false,
      },
    }),
  },
});

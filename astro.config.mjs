import { defineConfig, envField } from "astro/config";
import { satteri } from "@astrojs/markdown-satteri";
import sitemap from "@astrojs/sitemap";
import { URL } from "node:url";

import { accessibleTablesPlugin } from "./src/markdown/accessible-tables.ts";
import { lessonLinksPlugin } from "./src/markdown/lesson-links.ts";
import { tablaturePlugin } from "./src/markdown/tablature.ts";

export default defineConfig({
  output: "static",
  site: "https://guitar.rothcold.me",
  trailingSlash: "never",
  env: {
    schema: {
      SITE_INDEXING_ENABLED: envField.boolean({
        context: "server",
        access: "public",
        default: false,
      }),
    },
  },
  integrations: [
    sitemap({
      filter: (page) => new URL(page).pathname.replace(/\/$/, "") !== "/404",
    }),
  ],
  markdown: {
    syntaxHighlight: {
      type: "shiki",
      excludeLangs: ["math", "tab"],
    },
    processor: satteri({
      mdastPlugins: [lessonLinksPlugin],
      hastPlugins: [accessibleTablesPlugin, tablaturePlugin],
      features: {
        gfm: true,
        smartPunctuation: false,
      },
    }),
  },
});

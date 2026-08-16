import type { APIRoute } from "astro";
import { SITE_INDEXING_ENABLED } from "astro:env/server";

export const GET: APIRoute = ({ site }) => {
  const sitemapUrl = new URL("sitemap-index.xml", site);
  const body = `User-agent: *
${SITE_INDEXING_ENABLED ? "Allow: /" : "Disallow: /"}

Sitemap: ${sitemapUrl.href}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};

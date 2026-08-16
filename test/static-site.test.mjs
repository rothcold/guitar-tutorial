import assert from "node:assert/strict";
import process from "node:process";
import { access, readdir, readFile } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const distDirectory = resolve(projectRoot, "dist");
const siteOrigin = "https://guitar.rothcold.me";
const lessonSlugs = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08a",
  "08b",
  "09",
  "10",
  "11",
  "12",
  "13",
  "14",
];
const publicRoutes = [
  "/",
  ...lessonSlugs.map((slug) => `/lessons/${slug}`),
  "/privacy",
];
const indexingEnabled = process.env.SITE_INDEXING_ENABLED === "true";

function routeFile(route) {
  if (route === "/") {
    return resolve(distDirectory, "index.html");
  }

  if (route === "/404") {
    return resolve(distDirectory, "404.html");
  }

  return resolve(distDirectory, route.slice(1), "index.html");
}

function canonicalUrl(route) {
  return route === "/" ? `${siteOrigin}/` : `${siteOrigin}${route}`;
}

async function readRoute(route) {
  return readFile(routeFile(route), "utf8");
}

async function findHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await findHtmlFiles(path)));
    } else if (entry.name.endsWith(".html")) {
      files.push(path);
    }
  }

  return files;
}

test("the static build contains the complete public route surface", async () => {
  const htmlFiles = await findHtmlFiles(distDirectory);

  assert.equal(htmlFiles.length, publicRoutes.length + 1);

  for (const route of [...publicRoutes, "/404"]) {
    await assert.doesNotReject(access(routeFile(route)), `Missing route ${route}`);
  }
});

test("every HTML page has one H1, canonical metadata, and the indexing gate", async () => {
  const robotsValue = indexingEnabled ? "index, follow" : "noindex, nofollow";

  for (const route of [...publicRoutes, "/404"]) {
    const html = await readRoute(route);
    const canonical = canonicalUrl(route);

    assert.equal(
      [...html.matchAll(/<h1(?:\s|>)/gu)].length,
      1,
      `${route} must contain exactly one H1`,
    );
    assert.ok(
      html.includes(`<meta name="robots" content="${robotsValue}">`),
      `${route} has the wrong robots metadata`,
    );
    assert.ok(
      html.includes(`<link rel="canonical" href="${canonical}">`),
      `${route} has the wrong canonical URL`,
    );
    assert.ok(
      html.includes(`<meta property="og:url" content="${canonical}">`),
      `${route} has the wrong Open Graph URL`,
    );
    assert.ok(html.includes("<vercel-analytics "), `${route} is missing analytics`);
    assert.doesNotMatch(html, /href="[^"]+\.md(?:#|")/u);
  }
});

test("all generated internal links and same-page anchors resolve", async () => {
  const htmlFiles = await findHtmlFiles(distDirectory);

  for (const htmlFile of htmlFiles) {
    const html = await readFile(htmlFile, "utf8");

    for (const match of html.matchAll(/\shref="([^"]+)"/gu)) {
      const href = match[1].replaceAll("&amp;", "&");

      if (/^(?:[a-z]+:|\/\/)/iu.test(href)) {
        continue;
      }

      const [path, rawFragment] = href.split("#", 2);
      const fragment = rawFragment ? decodeURIComponent(rawFragment) : undefined;
      let targetFile = htmlFile;

      if (path) {
        assert.ok(path.startsWith("/"), `${htmlFile} uses relative link ${href}`);

        if (path.startsWith("/_astro/") || /\.(?:txt|xml)$/u.test(path)) {
          targetFile = resolve(distDirectory, path.slice(1));
        } else {
          targetFile = routeFile(path);
        }

        await assert.doesNotReject(
          access(targetFile),
          `${relative(projectRoot, htmlFile)} links to missing ${path}`,
        );
      }

      if (fragment && targetFile.endsWith(".html")) {
        const targetHtml =
          targetFile === htmlFile ? html : await readFile(targetFile, "utf8");

        assert.ok(
          targetHtml.includes(`id="${fragment}"`),
          `${relative(projectRoot, htmlFile)} links to missing anchor ${href}`,
        );
      }
    }
  }
});

test("the sitemap lists every public route and excludes the 404 page", async () => {
  const sitemapIndex = await readFile(
    resolve(distDirectory, "sitemap-index.xml"),
    "utf8",
  );
  const sitemapUrl = sitemapIndex.match(/<loc>([^<]+)<\/loc>/u)?.[1];

  assert.ok(sitemapUrl, "The sitemap index must reference a sitemap");

  const sitemap = await readFile(
    resolve(distDirectory, basename(new URL(sitemapUrl).pathname)),
    "utf8",
  );
  const actualUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)]
    .map((match) => match[1])
    .sort();
  const expectedUrls = publicRoutes
    .map((route) => (route === "/" ? siteOrigin : canonicalUrl(route)))
    .sort();

  assert.deepEqual(actualUrls, expectedUrls);
  assert.doesNotMatch(sitemap, /\/404(?:<|\/)/u);
});

test("branch pagination keeps both routes around the split", async () => {
  const routeLinks = async (route) => {
    const html = await readRoute(route);
    const pagination = html.match(
      /<nav class="lesson-pagination"[\s\S]*?<\/nav>/u,
    )?.[0];

    assert.ok(pagination, `${route} is missing lesson pagination`);
    return [...pagination.matchAll(/href="([^"]+)"/gu)].map(
      (match) => match[1],
    );
  };

  assert.deepEqual(await routeLinks("/lessons/07"), [
    "/lessons/06",
    "/lessons/08a",
    "/lessons/08b",
  ]);
  assert.deepEqual(await routeLinks("/lessons/09"), [
    "/lessons/08a",
    "/lessons/08b",
    "/lessons/10",
  ]);
});

test("robots.txt follows the indexing gate and points to the sitemap", async () => {
  const robots = await readFile(resolve(distDirectory, "robots.txt"), "utf8");
  const directive = indexingEnabled ? "Allow: /" : "Disallow: /";
  const opposite = indexingEnabled ? "Disallow: /" : "Allow: /";

  assert.match(robots, new RegExp(`^${directive}$`, "mu"));
  assert.doesNotMatch(robots, new RegExp(`^${opposite}$`, "mu"));
  assert.match(
    robots,
    /^Sitemap: https:\/\/guitar\.rothcold\.me\/sitemap-index\.xml$/mu,
  );
});

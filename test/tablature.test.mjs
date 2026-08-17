import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";
import { markdownToHtml } from "satteri";

import {
  parseTablature,
  tablaturePlugin,
} from "../src/markdown/tablature.ts";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const docsDirectory = resolve(projectRoot, "docs");

const example = `title: A Minor Pentatonic · Box 1
subtitle: 五品、七品与八品
tuning: E A D G B E
tempo: 60 BPM
beats: 1 & 2 & 3 & 4 &
techniques: h = Hammer-on · p = Pull-off
---
e|--5(A)------8(C)--|----------------|
B|--5(E)------8(G)--|----------------|
G|--5(C)--7(D)------|----------------|
D|--5(G)--7(A)------|----------------|
A|--5(D)--7(E)------|----------------|
E|--5(A)------8(C)--|----------------|`;

test("the tablature contract parses explicit metadata and six strings", () => {
  const tablature = parseTablature(example);

  assert.equal(tablature.metadata.title, "A Minor Pentatonic · Box 1");
  assert.equal(tablature.metadata.tempo, "60 BPM");
  assert.equal(tablature.strings.length, 6);
  assert.equal(tablature.measures.length, 2);
  assert.deepEqual(
    tablature.measures[0].strings.map((string) => string.label),
    ["e", "B", "G", "D", "A", "E"],
  );
  assert.equal(tablature.measures[0].strings[2].content, "--5(C)--7(D)------");
});

test("the tablature contract rejects incomplete or inferred notation", () => {
  assert.throws(
    () => parseTablature("---\ne|--5--|"),
    /title is required/u,
  );
  assert.throws(
    () => parseTablature("title: Incomplete\n---\ne|--5--|"),
    /exactly six string lines/u,
  );
  assert.throws(
    () =>
      parseTablature(
        example.replace(
          "e|--5(A)------8(C)--|----------------|",
          "e|--5(A)------8(C)--|----------------",
        ),
      ),
    /end with a barline/u,
  );
  assert.throws(
    () => parseTablature(example.replace("tempo:", "speed:")),
    /unknown metadata key/u,
  );
});

test("the Markdown plugin renders a semantic six-line tablature figure", () => {
  const { html } = markdownToHtml(`\`\`\`tab\n${example}\n\`\`\``, {
    hastPlugins: [tablaturePlugin],
  });

  assert.match(html, /<figure class="tablature"/u);
  assert.match(html, /<figcaption class="tablature__header"/u);
  assert.match(html, /data-tablature-expand/u);
  assert.equal(
    [...html.matchAll(/class="tablature__string"/gu)].length,
    12,
  );
  assert.doesNotMatch(html, /language-tab/u);
});

test("every explicit lesson tablature satisfies the contract", async () => {
  const filenames = (await readdir(docsDirectory)).filter((filename) =>
    filename.endsWith(".md"),
  );
  let tablatureCount = 0;

  for (const filename of filenames) {
    const source = await readFile(resolve(docsDirectory, filename), "utf8");

    for (const match of source.matchAll(/```tab\n([\s\S]*?)\n```/gu)) {
      tablatureCount += 1;
      assert.doesNotThrow(
        () => parseTablature(match[1]),
        `${filename} contains invalid tablature`,
      );
    }
  }

  assert.ok(tablatureCount > 0, "the lessons must contain explicit tablature");
});

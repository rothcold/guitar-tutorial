import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";
import { parse } from "yaml";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const docsDirectory = resolve(projectRoot, "docs");
const lessonIds = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08A",
  "08B",
  "09",
  "10",
  "11",
  "12",
  "13",
  "14",
];

function parseLesson(filename, source) {
  const frontmatterMatch = source.match(/^---\n([\s\S]*?)\n---\n/u);

  assert.ok(frontmatterMatch, `${filename} must start with frontmatter`);

  const frontmatter = parse(frontmatterMatch[1]);

  return {
    filename,
    source,
    body: source.slice(frontmatterMatch[0].length),
    id: frontmatter.id,
    slug: frontmatter.slug,
    track: frontmatter.track,
    order: frontmatter.order,
    previous: frontmatter.previous,
    next: frontmatter.next,
  };
}

async function readLessons() {
  const filenames = (await readdir(docsDirectory))
    .filter((filename) => filename.endsWith(".md"))
    .sort();

  return Promise.all(
    filenames.map(async (filename) =>
      parseLesson(
        filename,
        await readFile(resolve(docsDirectory, filename), "utf8"),
      ),
    ),
  );
}

function headingLevels(markdown) {
  const levels = [];
  let fenceCharacter;

  for (const line of markdown.split("\n")) {
    const fence = line.match(/^ {0,3}(`{3,}|~{3,})/u);

    if (fence) {
      const character = fence[1][0];
      fenceCharacter = fenceCharacter === character ? undefined : character;
      continue;
    }

    if (fenceCharacter) {
      continue;
    }

    const heading = line.match(/^ {0,3}(#{1,6})\s+\S/u);

    if (heading) {
      levels.push(heading[1].length);
    }
  }

  return levels;
}

test("lesson metadata defines one symmetric route graph", async () => {
  const lessons = await readLessons();
  const ordered = [...lessons].sort((left, right) => left.order - right.order);
  const lessonsById = new Map(lessons.map((lesson) => [lesson.id, lesson]));

  assert.equal(lessons.length, lessonIds.length);
  assert.deepEqual(
    ordered.map((lesson) => lesson.id),
    lessonIds,
  );
  assert.equal(new Set(lessons.map((lesson) => lesson.id)).size, lessons.length);
  assert.equal(
    new Set(lessons.map((lesson) => lesson.slug)).size,
    lessons.length,
  );
  assert.equal(
    new Set(lessons.map((lesson) => lesson.order)).size,
    lessons.length,
  );

  for (const lesson of lessons) {
    assert.equal(lesson.slug, lesson.id.toLowerCase());
    assert.equal(basename(lesson.filename).split("-")[0], lesson.id);
    assert.equal(
      lesson.track,
      lesson.id === "08A"
        ? "acoustic"
        : lesson.id === "08B"
          ? "electric"
          : "common",
    );

    for (const nextId of lesson.next) {
      const nextLesson = lessonsById.get(nextId);

      assert.ok(nextLesson, `${lesson.id} references missing next lesson ${nextId}`);
      assert.ok(
        nextLesson.previous.includes(lesson.id),
        `${lesson.id} -> ${nextId} is not symmetric`,
      );
    }

    for (const previousId of lesson.previous) {
      const previousLesson = lessonsById.get(previousId);

      assert.ok(
        previousLesson,
        `${lesson.id} references missing previous lesson ${previousId}`,
      );
      assert.ok(
        previousLesson.next.includes(lesson.id),
        `${previousId} -> ${lesson.id} is not symmetric`,
      );
    }
  }
});

test("lesson headings have one H1 and never skip a level", async () => {
  for (const lesson of await readLessons()) {
    const levels = headingLevels(lesson.body);

    assert.equal(
      levels.filter((level) => level === 1).length,
      1,
      `${lesson.filename} must contain exactly one H1`,
    );
    assert.equal(levels[0], 1, `${lesson.filename} must begin with its H1`);
    assert.ok(
      levels.every((level) => level <= 4),
      `${lesson.filename} must not use headings below H4`,
    );

    for (let index = 1; index < levels.length; index += 1) {
      assert.ok(
        levels[index] <= levels[index - 1] + 1,
        `${lesson.filename} skips from H${levels[index - 1]} to H${levels[index]}`,
      );
    }
  }
});

test("relative Markdown links point to files that exist", async () => {
  const markdownLink = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gu;

  for (const lesson of await readLessons()) {
    for (const match of lesson.source.matchAll(markdownLink)) {
      const destination = match[1];

      if (/^(?:[a-z]+:|#|\/)/iu.test(destination)) {
        continue;
      }

      const filePart = decodeURIComponent(destination.split("#")[0]);

      if (!filePart) {
        continue;
      }

      const target = resolve(dirname(resolve(docsDirectory, lesson.filename)), filePart);

      await assert.doesNotReject(
        stat(target),
        `${lesson.filename} links to missing file ${destination}`,
      );
    }
  }
});

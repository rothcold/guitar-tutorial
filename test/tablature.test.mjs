import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";
import { markdownToHtml } from "satteri";

import { parseTabScore } from "../src/markdown/tab-score.ts";
import {
  parseTabDiagram,
  tablaturePlugin,
} from "../src/markdown/tablature.ts";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const docsDirectory = resolve(projectRoot, "docs");

const diagramExample = `title: A Minor Pentatonic · Box 1
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

const scoreExample = `title: 四分音符读谱
subtitle: 两小节练习
tuning: E A D G B E
meter: 4/4
tempo: 50 BPM
counts: open
repeat: 4
---
measure 1: q 6:0 | q 6:1 | q 6:2 | q 6:3
measure 2: q 5:0 | q 5:2 | q 5:3 | q 5:2`;

test("the tab-diagram contract preserves explicit six-string figures", () => {
  const diagram = parseTabDiagram(diagramExample);

  assert.equal(diagram.metadata.title, "A Minor Pentatonic · Box 1");
  assert.equal(diagram.metadata.tempo, "60 BPM");
  assert.equal(diagram.strings.length, 6);
  assert.equal(diagram.measures.length, 2);
  assert.deepEqual(
    diagram.measures[0].strings.map((string) => string.label),
    ["e", "B", "G", "D", "A", "E"],
  );
  assert.equal(diagram.measures[0].strings[2].content, "--5(C)--7(D)------");
});

test("the tab-diagram contract rejects incomplete figures", () => {
  assert.throws(
    () => parseTabDiagram("---\ne|--5--|"),
    /title is required/u,
  );
  assert.throws(
    () => parseTabDiagram("title: Incomplete\n---\ne|--5--|"),
    /exactly six string lines/u,
  );
  assert.throws(
    () =>
      parseTabDiagram(
        diagramExample.replace(
          "e|--5(A)------8(C)--|----------------|",
          "e|--5(A)------8(C)--|----------------",
        ),
      ),
    /end with a barline/u,
  );
  assert.throws(
    () => parseTabDiagram(diagramExample.replace("tempo:", "speed:")),
    /unknown metadata key/u,
  );
});

test("the tab-score contract parses timed events, chords, modifiers, and repeats", () => {
  const score = parseTabScore(scoreExample);

  assert.equal(score.metadata.meter, "4/4");
  assert.equal(score.metadata.counts, "open");
  assert.equal(score.metadata.repeat, 4);
  assert.equal(score.measures.length, 2);
  assert.equal(score.measures[0].events[0].duration.value, "q");
  assert.equal(score.measures[0].events[3].start, 72);

  const chordScore = parseTabScore(`title: Chords
meter: 4/4
---
measure 1: h [6:5,5:7] {pm down accent} | h [6:5,5:7] {let-ring up}`);

  assert.deepEqual(chordScore.measures[0].events[0].notes, [
    { string: 5, fret: 7 },
    { string: 6, fret: 5 },
  ]);
  assert.deepEqual(chordScore.measures[0].events[0].modifiers, [
    "pm",
    "down",
    "accent",
  ]);
});

test("the tab-score contract supports dotted values, rests, ties, triplets, pickups, and meter changes", () => {
  const score = parseTabScore(`title: Rhythm scope
meter: 4/4
---
measure 1: h 6:0 | q. 6:0 | e 6:0 {tie}
measure 2: q 6:0 | q r | h 6:0
measure 3: h r | q3 6:0 | q3 6:0 | q3 6:0`);

  assert.equal(score.measures[0].events[1].duration.dotted, true);
  assert.equal(score.measures[1].events[1].rest, true);
  assert.equal(score.measures[2].events[1].duration.triplet, true);

  const pickup = parseTabScore(`title: Pickup
meter: 4/4
pickup: q
---
measure 1: q 6:0
measure 2: w 6:0
measure 3 [3/4]: h 6:0 | q 6:0`);

  assert.equal(pickup.measures[0].events.length, 1);
  assert.equal(pickup.measures[2].meter.label, "3/4");
});

test("the tab-score contract rejects invalid duration totals and malformed event state", () => {
  assert.throws(
    () => parseTabScore(scoreExample.replace("meter: 4/4\n", "")),
    /meter is required/u,
  );
  assert.throws(
    () => parseTabScore(scoreExample.replace("q 6:3", "e 6:3")),
    /measure 1 has/u,
  );
  assert.throws(
    () => parseTabScore(scoreExample.replace("q 6:0", "q 6:0 {down up}")),
    /both down-picked and up-picked/u,
  );
  assert.throws(
    () =>
      parseTabScore(
        scoreExample.replace(
          "q 6:0 | q 6:1 | q 6:2 | q 6:3",
          "h 6:0 | q3 6:0 | q3 6:0 | e3 6:0 | e3 6:0",
        ),
      ),
    /triplets must appear in complete groups of three/u,
  );
  assert.throws(
    () => parseTabScore(scoreExample.replace("q 6:0", "q 6:0 {tie}")),
    /tie must connect to the same notes/u,
  );
});

test("the Markdown plugin renders separate diagram and rhythmic score figures", () => {
  const { html } = markdownToHtml(
    `\`\`\`tab-diagram\n${diagramExample}\n\`\`\`\n\n\`\`\`tab-score\n${scoreExample}\n\`\`\``,
    { hastPlugins: [tablaturePlugin] },
  );

  assert.match(html, /<figure class="tablature tab-diagram"/u);
  assert.match(html, /<figure class="tablature tab-score"/u);
  assert.match(html, /data-tab-score=/u);
  assert.match(html, /data-tab-score-counts/u);
  assert.match(html, /第1小节，4\/4/u);
  assert.match(html, /整段反复4次/u);
  assert.equal(
    [...html.matchAll(/class="tablature__string"/gu)].length,
    12,
  );
  assert.doesNotMatch(html, /measure 1:/u);
  assert.doesNotMatch(html, /language-tab-(?:score|diagram)/u);
});

test("the legacy fenced tab contract fails instead of inferring a mode", () => {
  assert.throws(
    () => markdownToHtml(`\`\`\`tab\n${diagramExample}\n\`\`\``, {
      hastPlugins: [tablaturePlugin],
    }),
    /fenced tab is no longer supported/u,
  );
});

test("every lesson notation block satisfies its explicit contract", async () => {
  const filenames = (await readdir(docsDirectory)).filter((filename) =>
    filename.endsWith(".md"),
  );
  let diagramCount = 0;
  let scoreCount = 0;

  for (const filename of filenames) {
    const source = await readFile(resolve(docsDirectory, filename), "utf8");

    assert.doesNotMatch(source, /```tab\n/u, `${filename} uses legacy fenced tab`);

    for (const match of source.matchAll(/```tab-diagram\n([\s\S]*?)\n```/gu)) {
      diagramCount += 1;
      assert.doesNotThrow(
        () => parseTabDiagram(match[1]),
        `${filename} contains invalid tab-diagram`,
      );
    }

    for (const match of source.matchAll(/```tab-score\n([\s\S]*?)\n```/gu)) {
      scoreCount += 1;
      assert.doesNotThrow(
        () => parseTabScore(match[1]),
        `${filename} contains invalid tab-score`,
      );
    }
  }

  assert.equal(diagramCount, 18);
  assert.equal(scoreCount, 11);
});

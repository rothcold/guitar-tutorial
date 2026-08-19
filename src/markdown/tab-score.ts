import type { Element, ElementContent, Properties, Text } from "hast";

const wholeNoteTicks = 96;
const durationTicks = {
  w: wholeNoteTicks,
  h: wholeNoteTicks / 2,
  q: wholeNoteTicks / 4,
  e: wholeNoteTicks / 8,
  s: wholeNoteTicks / 16,
} as const;
const durationLabels = {
  w: "全音符",
  h: "二分音符",
  q: "四分音符",
  e: "八分音符",
  s: "十六分音符",
} as const;
const scoreMetadataKeys = [
  "title",
  "subtitle",
  "tuning",
  "meter",
  "tempo",
  "counts",
  "repeat",
  "pickup",
  "techniques",
  "note",
] as const;
const eventModifiers = [
  "pm",
  "let-ring",
  "accent",
  "dead",
  "down",
  "up",
  "tie",
] as const;

type DurationValue = keyof typeof durationTicks;
type ScoreMetadataKey = (typeof scoreMetadataKeys)[number];
export type TabScoreModifier = (typeof eventModifiers)[number];

export interface TabScoreDuration {
  value: DurationValue;
  dotted: boolean;
  triplet: boolean;
  ticks: number;
}

export interface TabScoreNote {
  string: number;
  fret: number | "x";
}

export interface TabScoreEvent {
  duration: TabScoreDuration;
  notes: TabScoreNote[];
  rest: boolean;
  modifiers: TabScoreModifier[];
  start: number;
}

export interface TabScoreMeter {
  numerator: number;
  denominator: number;
  label: string;
  ticks: number;
}

export interface TabScoreMeasure {
  number: number;
  meter: TabScoreMeter;
  events: TabScoreEvent[];
}

export interface TabScoreMetadata {
  title: string;
  meter: string;
  subtitle?: string;
  tuning?: string;
  tempo?: string;
  counts?: "open" | "closed";
  repeat?: number;
  pickup?: TabScoreDuration;
  techniques?: string;
  note?: string;
}

export interface TabScore {
  metadata: TabScoreMetadata;
  measures: TabScoreMeasure[];
}

function text(value: string): Text {
  return { type: "text", value };
}

function element(
  tagName: string,
  className: string | string[] | undefined,
  children: ElementContent[] = [],
  properties: Properties = {},
): Element {
  return {
    type: "element",
    tagName,
    properties: className
      ? {
          ...properties,
          className: Array.isArray(className) ? className : [className],
        }
      : properties,
    children,
  };
}

function parseDuration(value: string): TabScoreDuration {
  const match = /^([whqes])(\.)?(3)?$/u.exec(value);

  if (!match) {
    throw new Error(`unknown duration in tab-score: ${value}`);
  }

  const durationValue = match[1] as DurationValue;
  const dotted = Boolean(match[2]);
  const triplet = Boolean(match[3]);

  if (dotted && triplet) {
    throw new Error(`tab-score duration cannot be dotted and triplet: ${value}`);
  }

  let ticks = durationTicks[durationValue];

  if (dotted) {
    ticks *= 1.5;
  } else if (triplet) {
    ticks *= 2 / 3;
  }

  return { value: durationValue, dotted, triplet, ticks };
}

function parseMeter(value: string): TabScoreMeter {
  const match = /^(\d+)\/(1|2|4|8|16)$/u.exec(value);

  if (!match) {
    throw new Error(`tab-score meter must use numerator/denominator: ${value}`);
  }

  const numerator = Number(match[1]);
  const denominator = Number(match[2]);

  if (numerator < 1) {
    throw new Error(`tab-score meter numerator must be positive: ${value}`);
  }

  return {
    numerator,
    denominator,
    label: value,
    ticks: numerator * (wholeNoteTicks / denominator),
  };
}

function parseMetadata(lines: string[]): TabScoreMetadata {
  const values = new Map<ScoreMetadataKey, string>();

  for (const line of lines) {
    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      throw new Error(`tab-score metadata must use "key: value": ${line}`);
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!scoreMetadataKeys.includes(key as ScoreMetadataKey)) {
      throw new Error(`unknown metadata key in tab-score: ${key}`);
    }

    const typedKey = key as ScoreMetadataKey;

    if (values.has(typedKey)) {
      throw new Error(`duplicate metadata key in tab-score: ${key}`);
    }

    if (!value) {
      throw new Error(`tab-score metadata value cannot be empty: ${key}`);
    }

    values.set(typedKey, value);
  }

  const title = values.get("title");
  const meter = values.get("meter");

  if (!title) {
    throw new Error("tab-score title is required");
  }

  if (!meter) {
    throw new Error("tab-score meter is required");
  }

  parseMeter(meter);

  const countsSource = values.get("counts");

  if (countsSource && countsSource !== "open" && countsSource !== "closed") {
    throw new Error('tab-score counts must be "open" or "closed"');
  }

  const counts = countsSource as "open" | "closed" | undefined;

  const repeatSource = values.get("repeat");
  const repeat = repeatSource ? Number(repeatSource) : undefined;

  if (repeatSource && (!Number.isInteger(repeat) || (repeat ?? 0) < 2)) {
    throw new Error("tab-score repeat must be an integer of 2 or greater");
  }

  const pickupSource = values.get("pickup");
  const pickup = pickupSource ? parseDuration(pickupSource) : undefined;

  return {
    title,
    meter,
    ...(values.get("subtitle") ? { subtitle: values.get("subtitle") } : {}),
    ...(values.get("tuning") ? { tuning: values.get("tuning") } : {}),
    ...(values.get("tempo") ? { tempo: values.get("tempo") } : {}),
    ...(counts ? { counts } : {}),
    ...(repeat ? { repeat } : {}),
    ...(pickup ? { pickup } : {}),
    ...(values.get("techniques")
      ? { techniques: values.get("techniques") }
      : {}),
    ...(values.get("note") ? { note: values.get("note") } : {}),
  };
}

function parseNote(value: string): TabScoreNote {
  const match = /^([1-6]):(\d+|x)$/u.exec(value.trim());

  if (!match) {
    throw new Error(`tab-score note must use string:fret: ${value}`);
  }

  return {
    string: Number(match[1]),
    fret: match[2] === "x" ? "x" : Number(match[2]),
  };
}

function parseNotes(value: string): TabScoreNote[] {
  const notes = value.startsWith("[") && value.endsWith("]")
    ? value.slice(1, -1).split(",").map(parseNote)
    : [parseNote(value)];
  const strings = notes.map((note) => note.string);

  if (new Set(strings).size !== strings.length) {
    throw new Error(`tab-score chord repeats a string: ${value}`);
  }

  return notes.sort((left, right) => left.string - right.string);
}

function parseModifiers(value: string | undefined): TabScoreModifier[] {
  if (!value) {
    return [];
  }

  const modifiers = value.trim().split(/\s+/u);

  for (const modifier of modifiers) {
    if (!eventModifiers.includes(modifier as TabScoreModifier)) {
      throw new Error(`unknown tab-score event modifier: ${modifier}`);
    }
  }

  if (new Set(modifiers).size !== modifiers.length) {
    throw new Error(`duplicate tab-score event modifier: ${value}`);
  }

  if (modifiers.includes("down") && modifiers.includes("up")) {
    throw new Error("tab-score event cannot be both down-picked and up-picked");
  }

  return modifiers as TabScoreModifier[];
}

function parseEvent(source: string, start: number): TabScoreEvent {
  const match = /^(\S+)\s+(.+?)(?:\s+\{([^{}]+)\})?$/u.exec(source.trim());

  if (!match) {
    throw new Error(`invalid tab-score event: ${source}`);
  }

  const duration = parseDuration(match[1]);
  const target = match[2].trim();
  const modifiers = parseModifiers(match[3]);
  const rest = target === "r";

  if (rest && modifiers.some((modifier) => !["down", "up"].includes(modifier))) {
    throw new Error("tab-score rests only support down or up movement markers");
  }

  let notes = rest ? [] : parseNotes(target);

  if (modifiers.includes("dead")) {
    notes = notes.map((note) => ({ ...note, fret: "x" }));
  }

  if (modifiers.includes("tie") && (rest || notes.some((note) => note.fret === "x"))) {
    throw new Error("tab-score ties require pitched notes");
  }

  return { duration, notes, rest, modifiers, start };
}

function validateTriplets(measure: TabScoreMeasure): void {
  let index = 0;

  while (index < measure.events.length) {
    if (!measure.events[index].duration.triplet) {
      index += 1;
      continue;
    }

    const value = measure.events[index].duration.value;
    let end = index;

    while (
      end < measure.events.length &&
      measure.events[end].duration.triplet &&
      measure.events[end].duration.value === value
    ) {
      end += 1;
    }

    if ((end - index) % 3 !== 0) {
      throw new Error(
        `tab-score measure ${measure.number} triplets must appear in complete groups of three`,
      );
    }

    index = end;
  }
}

function noteKey(event: TabScoreEvent): string {
  return event.notes.map((note) => `${note.string}:${note.fret}`).join(",");
}

function validateTies(measures: TabScoreMeasure[]): void {
  const events = measures.flatMap((measure) => measure.events);

  for (const [index, event] of events.entries()) {
    if (!event.modifiers.includes("tie")) {
      continue;
    }

    const next = events[index + 1];

    if (!next || next.rest || noteKey(next) !== noteKey(event)) {
      throw new Error("tab-score tie must connect to the same notes in the next event");
    }
  }
}

export function parseTabScore(source: string): TabScore {
  const normalizedSource = source.replaceAll("\r\n", "\n").trim();
  const lines = normalizedSource.split("\n");
  const separatorIndex = lines.indexOf("---");

  if (separatorIndex === -1) {
    throw new Error('tab-score must separate metadata and measures with "---"');
  }

  const metadata = parseMetadata(lines.slice(0, separatorIndex));
  const measureLines = lines.slice(separatorIndex + 1).filter(Boolean);

  if (measureLines.length === 0) {
    throw new Error("tab-score must contain at least one measure");
  }

  let currentMeter = parseMeter(metadata.meter);
  const measures = measureLines.map((line, index) => {
    const match = /^measure\s+(\d+)(?:\s+\[(\d+\/(?:1|2|4|8|16))\])?:\s*(.+)$/u.exec(line);

    if (!match) {
      throw new Error(`tab-score measure line must use "measure N: event | event": ${line}`);
    }

    const number = Number(match[1]);

    if (number !== index + 1) {
      throw new Error(`tab-score measures must be numbered in order, expected ${index + 1}`);
    }

    if (match[2]) {
      currentMeter = parseMeter(match[2]);
    }

    let start = 0;
    const events = match[3].split("|").map((eventSource) => {
      const event = parseEvent(eventSource, start);
      start += event.duration.ticks;
      return event;
    });
    const expectedTicks = index === 0 && metadata.pickup
      ? metadata.pickup.ticks
      : currentMeter.ticks;

    if (start !== expectedTicks) {
      const quarterTicks = wholeNoteTicks / 4;
      throw new Error(
        `tab-score measure ${number} has ${start / quarterTicks} quarter-note beats, expected ${expectedTicks / quarterTicks}`,
      );
    }

    const measure = { number, meter: currentMeter, events };
    validateTriplets(measure);
    return measure;
  });

  if (metadata.pickup && metadata.pickup.ticks >= measures[0].meter.ticks) {
    throw new Error("tab-score pickup must be shorter than its measure");
  }

  validateTies(measures);

  return { metadata, measures };
}

function renderMetadata(metadata: TabScoreMetadata): ElementContent[] {
  const values = [
    metadata.tuning ? `TUNING ${metadata.tuning}` : undefined,
    `METER ${metadata.meter}`,
    metadata.tempo ? `TEMPO ${metadata.tempo}` : undefined,
  ].filter((value): value is string => Boolean(value));

  return [
    element(
      "div",
      "tablature__metadata",
      values.map((value) => element("span", undefined, [text(value)])),
    ),
  ];
}

function describeDuration(duration: TabScoreDuration, rest: boolean): string {
  const base = durationLabels[duration.value];
  const value = `${duration.dotted ? "附点" : ""}${base}${duration.triplet ? "三连音" : ""}`;
  return rest ? `${value}休止` : value;
}

function describeEvent(event: TabScoreEvent): string {
  const parts = [describeDuration(event.duration, event.rest)];

  if (!event.rest) {
    parts.push(
      event.notes
        .map((note) => `${note.string}弦${note.fret === "x" ? "闷音" : `${note.fret}品`}`)
        .join("、"),
    );
  }

  const modifierLabels: Partial<Record<TabScoreModifier, string>> = {
    pm: "掌根制音",
    "let-ring": "保持延音",
    accent: "重音",
    down: "下拨",
    up: "上拨",
    tie: "连到下一音",
  };
  const modifiers = event.modifiers
    .map((modifier) => modifierLabels[modifier])
    .filter((value): value is string => Boolean(value));

  if (modifiers.length > 0) {
    parts.push(modifiers.join("、"));
  }

  return parts.join("，");
}

export function renderTabScore(score: TabScore): Element {
  const { metadata } = score;
  const countsOpen = metadata.counts === "open";
  const descriptionParts = [metadata.techniques, metadata.note].filter(
    (value): value is string => Boolean(value),
  );

  return element("figure", ["tablature", "tab-score"], [
    element("figcaption", "tablature__header", [
      element("div", "tablature__heading", [
        element("span", "tablature__eyebrow", [text("TAB SCORE · 节奏六线谱")]),
        element("p", "tablature__title", [text(metadata.title)]),
        ...(metadata.subtitle
          ? [element("p", "tablature__subtitle", [text(metadata.subtitle)])]
          : []),
      ]),
      ...renderMetadata(metadata),
      element("div", "tab-score__controls", [
        element("button", "tab-score__counts-toggle", [
          text(countsOpen ? "隐藏数拍" : "显示数拍"),
        ], {
          type: "button",
          ariaPressed: String(countsOpen),
          dataTabScoreCounts: true,
        }),
        element("button", "tablature__expand", [text("展开")], {
          type: "button",
          ariaExpanded: "false",
          dataTablatureExpand: true,
        }),
      ]),
    ]),
    element("div", "tab-score__viewport", [
      element("div", "tab-score__systems", [], { ariaHidden: "true" }),
    ], {
      dataTabScore: JSON.stringify(score),
      dataCountsVisible: String(countsOpen),
      tabIndex: 0,
      ariaLabel: `${metadata.title} 节奏六线谱图形`,
    }),
    ...(descriptionParts.length > 0
      ? [
          element(
            "div",
            "tablature__notes",
            descriptionParts.map((description) =>
              element("p", undefined, [text(description)]),
            ),
          ),
        ]
      : []),
    element(
      "ol",
      ["tab-score__semantic", "visually-hidden"],
      [
        ...score.measures.map((measure) =>
          element("li", undefined, [
            text(
              `第${measure.number}小节，${measure.meter.label}：${measure.events.map(describeEvent).join("；")}。`,
            ),
          ]),
        ),
        ...(metadata.repeat
          ? [element("li", undefined, [text(`整段反复${metadata.repeat}次。`)])]
          : []),
      ],
    ),
  ]);
}

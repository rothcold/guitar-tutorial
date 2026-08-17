import type { Element, ElementContent, Properties, Text } from "hast";
import { defineHastPlugin } from "satteri";

const metadataKeys = [
  "title",
  "subtitle",
  "tuning",
  "meter",
  "tempo",
  "beats",
  "techniques",
  "note",
] as const;

type TablatureMetadataKey = (typeof metadataKeys)[number];

export type TablatureMetadata = Partial<
  Record<Exclude<TablatureMetadataKey, "title">, string>
> & {
  title: string;
};

export interface TablatureString {
  label: string;
  measures: string[];
}

export interface TablatureMeasure {
  number: number;
  width: number;
  strings: Array<{
    label: string;
    content: string;
  }>;
}

export interface Tablature {
  metadata: TablatureMetadata;
  strings: TablatureString[];
  measures: TablatureMeasure[];
  source: string;
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

function parseMetadata(lines: string[]): TablatureMetadata {
  const metadata = new Map<TablatureMetadataKey, string>();

  for (const line of lines) {
    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      throw new Error(`tablature metadata must use "key: value": ${line}`);
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!metadataKeys.includes(key as TablatureMetadataKey)) {
      throw new Error(`unknown metadata key in tablature: ${key}`);
    }

    const typedKey = key as TablatureMetadataKey;

    if (metadata.has(typedKey)) {
      throw new Error(`duplicate metadata key in tablature: ${key}`);
    }

    if (!value) {
      throw new Error(`tablature metadata value cannot be empty: ${key}`);
    }

    metadata.set(typedKey, value);
  }

  const title = metadata.get("title");

  if (!title) {
    throw new Error("tablature title is required");
  }

  return Object.fromEntries(metadata) as TablatureMetadata;
}

function parseStringLine(line: string, lineNumber: number): TablatureString {
  const match = /^([^|\s]+)\|(.+)\|$/u.exec(line);

  if (!match) {
    throw new Error(
      `tablature string line ${lineNumber} must use "label|content|" and end with a barline`,
    );
  }

  const measures = match[2].split("|");

  if (measures.some((measure) => measure.length === 0)) {
    throw new Error(`tablature string line ${lineNumber} contains an empty measure`);
  }

  return {
    label: match[1],
    measures,
  };
}

export function parseTablature(source: string): Tablature {
  const normalizedSource = source.replaceAll("\r\n", "\n").trim();
  const lines = normalizedSource.split("\n");
  const separatorIndex = lines.indexOf("---");

  if (separatorIndex === -1) {
    throw new Error('tablature must separate metadata and strings with "---"');
  }

  const metadata = parseMetadata(lines.slice(0, separatorIndex));
  const stringLines = lines.slice(separatorIndex + 1).filter(Boolean);

  if (stringLines.length !== 6) {
    throw new Error("tablature must contain exactly six string lines");
  }

  const strings = stringLines.map((line, index) =>
    parseStringLine(line, index + 1),
  );
  const measureCount = strings[0].measures.length;

  if (strings.some((string) => string.measures.length !== measureCount)) {
    throw new Error("every tablature string must contain the same number of measures");
  }

  const measures = Array.from({ length: measureCount }, (_, index) => {
    const measureStrings = strings.map((string) => ({
      label: string.label,
      content: string.measures[index],
    }));

    return {
      number: index + 1,
      width: Math.max(...measureStrings.map((string) => string.content.length)),
      strings: measureStrings,
    };
  });

  return {
    metadata,
    strings,
    measures,
    source: normalizedSource,
  };
}

function renderMetadata(metadata: TablatureMetadata): ElementContent[] {
  const values = [
    metadata.tuning ? `TUNING ${metadata.tuning}` : undefined,
    metadata.meter ? `METER ${metadata.meter}` : undefined,
    metadata.tempo ? `TEMPO ${metadata.tempo}` : undefined,
  ].filter((value): value is string => Boolean(value));

  if (values.length === 0) {
    return [];
  }

  return [
    element(
      "div",
      "tablature__metadata",
      values.map((value) => element("span", undefined, [text(value)])),
    ),
  ];
}

function renderMeasure(measure: TablatureMeasure, beats?: string): Element {
  const children: ElementContent[] = [
    element("p", "tablature__measure-label", [text(`小节 ${measure.number}`)]),
  ];

  if (beats) {
    children.push(
      element("p", "tablature__beats", [
        element("span", undefined, [text("BEATS")]),
        text(beats),
      ]),
    );
  }

  children.push(
    element(
      "div",
      "tablature__staff",
      measure.strings.map((string) =>
        element("div", "tablature__string", [
          element("span", "tablature__string-label", [text(string.label)]),
          element("span", "tablature__string-track", [
            text(string.content.replaceAll("-", " ")),
          ]),
        ]),
      ),
    ),
  );

  return element("section", "tablature__measure", children, {
    style: `--tab-columns: ${measure.width}`,
    ariaLabel: `小节 ${measure.number}`,
  });
}

function renderTablature(tablature: Tablature): Element {
  const { metadata } = tablature;
  const descriptionParts = [metadata.techniques, metadata.note].filter(
    (value): value is string => Boolean(value),
  );
  const sourceRows = tablature.strings
    .map((string) => `${string.label}|${string.measures.join("|")}|`)
    .join("\n");

  return element("figure", "tablature", [
    element("figcaption", "tablature__header", [
      element("div", "tablature__heading", [
        element("span", "tablature__eyebrow", [text("TAB · 六线谱")]),
        element("p", "tablature__title", [text(metadata.title)]),
        ...(metadata.subtitle
          ? [element("p", "tablature__subtitle", [text(metadata.subtitle)])]
          : []),
      ]),
      ...renderMetadata(metadata),
      element(
        "button",
        "tablature__expand",
        [text("展开")],
        {
          type: "button",
          ariaExpanded: "false",
          dataTablatureExpand: true,
        },
      ),
    ]),
    element(
      "div",
      "tablature__viewport",
      tablature.measures.map((measure) =>
        renderMeasure(measure, metadata.beats),
      ),
      {
        tabIndex: 0,
        ariaLabel: `${metadata.title} 六线谱`,
      },
    ),
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
    element("details", "tablature__source", [
      element("summary", undefined, [text("查看原始 TAB")]),
      element("pre", undefined, [
        element("code", undefined, [text(sourceRows)]),
      ]),
    ]),
  ]);
}

export const tablaturePlugin = defineHastPlugin({
  name: "tablature",
  element: {
    filter: ["pre"],
    visit(node, context) {
      const code = node.children.find(
        (child): child is Element =>
          child.type === "element" && child.tagName === "code",
      );
      const classNames = code?.properties.className;

      if (
        !code ||
        !Array.isArray(classNames) ||
        !classNames.includes("language-tab")
      ) {
        return;
      }

      try {
        context.replaceNode(
          node,
          renderTablature(parseTablature(context.textContent(code))),
        );
      } catch (error) {
        const source = context.fileURL?.pathname ?? "Markdown source";
        const message = error instanceof Error ? error.message : String(error);

        throw new Error(`${source}: invalid tablature: ${message}`, {
          cause: error,
        });
      }
    },
  },
});

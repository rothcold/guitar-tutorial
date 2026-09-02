import type {
  TabScore,
  TabScoreEvent,
  TabScoreMeasure,
  TabScoreModifier,
} from "../markdown/tab-score.ts";

const desktopMeasuresPerSystem = 4;
const wholeNoteTicks = 96;
const mobileQuery = window.matchMedia("(max-width: 52rem)");

interface Palette {
  surface: string;
  text: string;
  muted: string;
  line: string;
  accent: string;
  signalForeground: string;
}

interface EventCoordinate {
  event: TabScoreEvent;
  x: number;
  measureStart: number;
  measureEnd: number;
}

function cssVariable(styles: CSSStyleDeclaration, name: string): string {
  return styles.getPropertyValue(name).trim();
}

function paletteFor(element: HTMLElement, printing: boolean): Palette {
  if (printing) {
    return {
      surface: "#ffffff",
      text: "#000000",
      muted: "#4a4a4a",
      line: "#252525",
      accent: "#000000",
      signalForeground: "#000000",
    };
  }

  const styles = getComputedStyle(element);

  return {
    surface: cssVariable(styles, "--color-surface-raised"),
    text: cssVariable(styles, "--color-text"),
    muted: cssVariable(styles, "--color-text-muted"),
    line: cssVariable(styles, "--color-border-strong"),
    accent: cssVariable(styles, "--color-accent"),
    signalForeground: cssVariable(styles, "--color-signal-foreground"),
  };
}

function canvasContext(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): CanvasRenderingContext2D {
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D is unavailable");
  }

  context.scale(ratio, ratio);
  context.lineCap = "round";
  context.lineJoin = "round";
  return context;
}

function eventX(
  event: TabScoreEvent,
  measure: TabScoreMeasure,
  start: number,
  width: number,
): number {
  const padding = 14;
  const usableWidth = width - padding * 2;
  return start + padding + (event.start / measure.meter.ticks) * usableWidth;
}

function drawPickMarker(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  modifiers: TabScoreModifier[],
  palette: Palette,
): void {
  context.strokeStyle = palette.signalForeground;
  context.fillStyle = palette.signalForeground;
  context.lineWidth = 1.25;

  if (modifiers.includes("down")) {
    context.beginPath();
    context.moveTo(x - 4, y + 5);
    context.lineTo(x - 4, y);
    context.lineTo(x + 4, y);
    context.lineTo(x + 4, y + 5);
    context.stroke();
  } else if (modifiers.includes("up")) {
    context.beginPath();
    context.moveTo(x - 4, y);
    context.lineTo(x, y + 5);
    context.lineTo(x + 4, y);
    context.stroke();
  }

  if (modifiers.includes("accent")) {
    context.font = "700 11px ui-monospace, monospace";
    context.textAlign = "center";
    context.fillText(">", x, y - 5);
  }
}

function drawTechniqueRanges(
  context: CanvasRenderingContext2D,
  coordinates: EventCoordinate[],
  modifier: "pm" | "let-ring",
  y: number,
  palette: Palette,
): void {
  let startIndex = 0;

  while (startIndex < coordinates.length) {
    if (!coordinates[startIndex].event.modifiers.includes(modifier)) {
      startIndex += 1;
      continue;
    }

    let endIndex = startIndex;

    while (
      endIndex + 1 < coordinates.length &&
      coordinates[endIndex + 1].event.modifiers.includes(modifier)
    ) {
      endIndex += 1;
    }

    const start = coordinates[startIndex].x - 5;
    const endCoordinate = coordinates[endIndex];
    const end = Math.min(endCoordinate.x + 12, endCoordinate.measureEnd - 6);
    const label = modifier === "pm" ? "P.M." : "let ring";

    context.fillStyle = palette.muted;
    context.strokeStyle = palette.muted;
    context.font = "600 9px ui-monospace, monospace";
    context.textAlign = "left";
    context.fillText(label, start, y);
    context.setLineDash([3, 3]);
    context.beginPath();
    context.moveTo(start + context.measureText(label).width + 5, y - 3);
    context.lineTo(end, y - 3);
    context.stroke();
    context.setLineDash([]);
    startIndex = endIndex + 1;
  }
}

function drawRest(
  context: CanvasRenderingContext2D,
  event: TabScoreEvent,
  x: number,
  y: number,
  palette: Palette,
): void {
  context.strokeStyle = palette.text;
  context.fillStyle = palette.text;
  context.lineWidth = 1.6;

  if (event.duration.value === "w" || event.duration.value === "h") {
    const top = event.duration.value === "w" ? y + 3 : y;
    context.fillRect(x - 5, top, 10, 3);
  } else if (event.duration.value === "q") {
    context.beginPath();
    context.moveTo(x + 2, y - 7);
    context.lineTo(x - 3, y - 1);
    context.lineTo(x + 3, y + 4);
    context.lineTo(x - 2, y + 10);
    context.stroke();
  } else {
    context.beginPath();
    context.moveTo(x + 2, y - 8);
    context.lineTo(x - 2, y + 9);
    context.stroke();
    context.beginPath();
    context.arc(x - 1, y - 6, 3, 0.15, Math.PI * 1.35);
    context.stroke();

    if (event.duration.value === "s") {
      context.beginPath();
      context.arc(x, y, 3, 0.15, Math.PI * 1.35);
      context.stroke();
    }
  }

  if (event.duration.dotted) {
    context.beginPath();
    context.arc(x + 8, y + 2, 1.6, 0, Math.PI * 2);
    context.fill();
  }
}

function isBeamable(event: TabScoreEvent): boolean {
  return !event.rest && ["e", "s"].includes(event.duration.value);
}

function beamGroups(measure: TabScoreMeasure): TabScoreEvent[][] {
  const beatTicks = wholeNoteTicks / measure.meter.denominator;
  const groups: TabScoreEvent[][] = [];

  for (let beat = 0; beat < measure.meter.numerator; beat += 1) {
    const beatStart = beat * beatTicks;
    const beatEnd = beatStart + beatTicks;
    const events = measure.events.filter(
      (event) => event.start >= beatStart && event.start < beatEnd,
    );
    let current: TabScoreEvent[] = [];

    for (const event of events) {
      if (isBeamable(event)) {
        current.push(event);
      } else {
        if (current.length > 1) groups.push(current);
        current = [];
      }
    }

    if (current.length > 1) groups.push(current);
  }

  return groups;
}

function drawFlag(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  count: number,
  palette: Palette,
): void {
  context.strokeStyle = palette.text;
  context.lineWidth = 2;

  for (let index = 0; index < count; index += 1) {
    const flagY = y + index * 5;
    context.beginPath();
    context.moveTo(x, flagY);
    context.quadraticCurveTo(x + 9, flagY + 1, x + 7, flagY + 8);
    context.stroke();
  }
}

function drawRhythm(
  context: CanvasRenderingContext2D,
  measure: TabScoreMeasure,
  coordinates: EventCoordinate[],
  staffBottom: number,
  palette: Palette,
): void {
  const stemEnd = staffBottom + 38;
  const beamedEvents = new Set<TabScoreEvent>();

  for (const event of measure.events) {
    const coordinate = coordinates.find((entry) => entry.event === event);

    if (!coordinate) continue;

    if (event.rest) {
      drawRest(context, event, coordinate.x, staffBottom + 24, palette);
      continue;
    }

    if (event.duration.value !== "w") {
      context.strokeStyle = palette.text;
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(coordinate.x, staffBottom + 5);
      context.lineTo(coordinate.x, stemEnd);
      context.stroke();
    }

    if (event.duration.dotted) {
      context.fillStyle = palette.text;
      context.beginPath();
      context.arc(coordinate.x + 7, staffBottom + 7, 1.5, 0, Math.PI * 2);
      context.fill();
    }
  }

  for (const group of beamGroups(measure)) {
    const groupCoordinates = group
      .map((event) => coordinates.find((entry) => entry.event === event))
      .filter((value): value is EventCoordinate => Boolean(value));

    if (groupCoordinates.length < 2) continue;

    group.forEach((event) => beamedEvents.add(event));
    context.strokeStyle = palette.text;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(groupCoordinates[0].x, stemEnd);
    context.lineTo(groupCoordinates.at(-1)!.x, stemEnd);
    context.stroke();

    let sixteenthStart: EventCoordinate | undefined;

    for (let index = 0; index <= group.length; index += 1) {
      const event = group[index];
      const coordinate = groupCoordinates[index];

      if (event?.duration.value === "s" && coordinate) {
        sixteenthStart ??= coordinate;
        continue;
      }

      if (sixteenthStart) {
        const previous = groupCoordinates[index - 1];
        const end = previous === sixteenthStart
          ? Math.min(sixteenthStart.x + 8, sixteenthStart.measureEnd - 3)
          : previous.x;
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(sixteenthStart.x, stemEnd + 6);
        context.lineTo(end, stemEnd + 6);
        context.stroke();
        sixteenthStart = undefined;
      }
    }

  }

  for (const coordinate of coordinates) {
    const event = coordinate.event;

    if (!isBeamable(event) || beamedEvents.has(event)) continue;

    drawFlag(
      context,
      coordinate.x,
      stemEnd,
      event.duration.value === "s" ? 2 : 1,
      palette,
    );
  }

  let tripletStart = 0;

  while (tripletStart < measure.events.length) {
    if (!measure.events[tripletStart].duration.triplet) {
      tripletStart += 1;
      continue;
    }

    const tripletEvents = measure.events.slice(tripletStart, tripletStart + 3);
    const tripletCoordinates = tripletEvents
      .map((event) => coordinates.find((entry) => entry.event === event))
      .filter((value): value is EventCoordinate => Boolean(value));

    if (tripletCoordinates.length === 3) {
      const start = tripletCoordinates[0].x;
      const end = tripletCoordinates[2].x;
      const y = stemEnd + 17;
      context.strokeStyle = palette.muted;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(start, y);
      context.lineTo(end, y);
      context.stroke();
      context.fillStyle = palette.surface;
      context.fillRect((start + end) / 2 - 5, y - 6, 10, 10);
      context.fillStyle = palette.muted;
      context.font = "700 9px ui-monospace, monospace";
      context.textAlign = "center";
      context.fillText("3", (start + end) / 2, y + 3);
    }

    tripletStart += 3;
  }
}

function countLabel(event: TabScoreEvent, measure: TabScoreMeasure): string {
  const beatTicks = wholeNoteTicks / measure.meter.denominator;
  const beat = Math.floor(event.start / beatTicks) + 1;
  const offset = event.start % beatTicks;

  if (event.duration.triplet) {
    const subdivision = Math.round(offset / (beatTicks / 3));
    return [String(beat), "trip", "let"][subdivision] ?? String(beat);
  }

  const subdivision = Math.round(offset / (beatTicks / 4));
  return [String(beat), "e", "&", "a"][subdivision] ?? String(beat);
}

function drawCounts(
  context: CanvasRenderingContext2D,
  measure: TabScoreMeasure,
  coordinates: EventCoordinate[],
  y: number,
  palette: Palette,
): void {
  context.fillStyle = palette.muted;
  context.font = "600 9px ui-monospace, monospace";
  context.textAlign = "center";

  let tripletGroupStart = 0;
  let tripletPosition = 0;
  let previousTripletValue: string | undefined;

  for (const coordinate of coordinates) {
    const { event } = coordinate;
    let label = countLabel(event, measure);

    if (event.duration.triplet) {
      if (previousTripletValue !== event.duration.value || tripletPosition === 3) {
        tripletGroupStart = event.start;
        tripletPosition = 0;
      }

      const beatTicks = wholeNoteTicks / measure.meter.denominator;
      const beat = Math.floor(tripletGroupStart / beatTicks) + 1;
      label = [String(beat), "trip", "let"][tripletPosition];
      tripletPosition += 1;
      previousTripletValue = event.duration.value;
    } else {
      previousTripletValue = undefined;
      tripletPosition = 0;
    }

    context.fillText(label, coordinate.x, y);
  }
}

function drawTies(
  context: CanvasRenderingContext2D,
  coordinates: EventCoordinate[],
  staffTop: number,
  previousEvent: TabScoreEvent | undefined,
  palette: Palette,
): void {
  context.strokeStyle = palette.signalForeground;
  context.lineWidth = 1.2;

  if (previousEvent?.modifiers.includes("tie") && coordinates[0]) {
    const first = coordinates[0];

    for (const note of first.event.notes) {
      const y = staffTop + (note.string - 1) * 16 - 6;
      context.beginPath();
      context.moveTo(first.measureStart + 3, y);
      context.quadraticCurveTo((first.measureStart + first.x) / 2, y - 9, first.x - 5, y);
      context.stroke();
    }
  }

  for (const [index, coordinate] of coordinates.entries()) {
    if (!coordinate.event.modifiers.includes("tie")) continue;

    const next = coordinates[index + 1];
    const end = next?.x ?? coordinate.measureEnd - 3;

    for (const note of coordinate.event.notes) {
      const y = staffTop + (note.string - 1) * 16 - 6;
      context.beginPath();
      context.moveTo(coordinate.x + 5, y);
      context.quadraticCurveTo((coordinate.x + end) / 2, y - 9, end - 5, y);
      context.stroke();
    }
  }
}

function drawRepeat(
  context: CanvasRenderingContext2D,
  start: number,
  end: number,
  staffTop: number,
  staffBottom: number,
  repeat: number,
  drawStart: boolean,
  drawEnd: boolean,
  palette: Palette,
): void {
  context.strokeStyle = palette.text;
  context.fillStyle = palette.text;
  context.lineWidth = 1;
  const dotColumns: number[] = [];
  context.beginPath();

  if (drawStart) {
    context.moveTo(start + 4, staffTop);
    context.lineTo(start + 4, staffBottom);
    dotColumns.push(start + 9);
  }

  if (drawEnd) {
    context.moveTo(end - 4, staffTop);
    context.lineTo(end - 4, staffBottom);
    dotColumns.push(end - 9);
  }

  context.stroke();

  for (const x of dotColumns) {
    for (const y of [staffTop + 32, staffTop + 48]) {
      context.beginPath();
      context.arc(x, y, 1.8, 0, Math.PI * 2);
      context.fill();
    }
  }

  if (drawEnd) {
    context.font = "700 10px ui-monospace, monospace";
    context.textAlign = "right";
    context.fillText(`×${repeat}`, end - 6, staffTop - 30);
  }
}

function drawSystem(
  canvas: HTMLCanvasElement,
  score: TabScore,
  measures: TabScoreMeasure[],
  width: number,
  countsVisible: boolean,
  firstMeasureIndex: number,
  slots: number,
  printing: boolean,
): void {
  const height = countsVisible ? 235 : 208;
  const context = canvasContext(canvas, width, height);
  const palette = paletteFor(canvas, printing);
  const styles = getComputedStyle(canvas);
  const mono = cssVariable(styles, "--font-mono") || "ui-monospace, monospace";
  const staffStart = 58;
  const staffEnd = width - 12;
  const measureWidth = (staffEnd - staffStart) / slots;
  const staffTop = 58;
  const stringGap = 16;
  const staffBottom = staffTop + stringGap * 5;
  const tuning = score.metadata.tuning?.split(/\s+/u).reverse() ?? ["1", "2", "3", "4", "5", "6"];
  const allCoordinates: EventCoordinate[] = [];

  context.fillStyle = palette.surface;
  context.fillRect(0, 0, width, height);

  for (let stringIndex = 0; stringIndex < 6; stringIndex += 1) {
    const y = staffTop + stringIndex * stringGap;
    const activeEnd = staffStart + measureWidth * measures.length;
    context.strokeStyle = palette.line;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(staffStart, y);
    context.lineTo(activeEnd, y);
    context.stroke();

    if (firstMeasureIndex === 0) {
      context.fillStyle = palette.signalForeground;
      context.font = `700 10px ${mono}`;
      context.textAlign = "center";
      context.fillText(tuning[stringIndex] ?? String(stringIndex + 1), 14, y + 3);
    }
  }

  for (const [index, measure] of measures.entries()) {
    const start = staffStart + index * measureWidth;
    const end = start + measureWidth;
    const previous = score.measures[firstMeasureIndex + index - 1];

    context.strokeStyle = palette.text;
    context.lineWidth = index === 0 ? 1.6 : 1;
    context.beginPath();
    context.moveTo(start, staffTop);
    context.lineTo(start, staffBottom);
    context.stroke();

    context.fillStyle = palette.muted;
    context.font = `600 9px ${mono}`;
    context.textAlign = "left";
    context.fillText(String(measure.number), start + 5, 15);

    if (index === 0 || previous?.meter.label !== measure.meter.label) {
      const [numerator, denominator] = measure.meter.label.split("/");
      const meterX = index === 0 ? 39 : start + 10;
      context.fillStyle = palette.text;
      context.font = `700 13px ${mono}`;
      context.textAlign = "center";
      context.fillText(numerator, meterX, staffTop + 31);
      context.fillText(denominator, meterX, staffTop + 47);
    }

    const coordinates = measure.events.map((event) => ({
      event,
      x: eventX(event, measure, start, measureWidth),
      measureStart: start,
      measureEnd: end,
    }));
    allCoordinates.push(...coordinates);
    drawTechniqueRanges(context, coordinates, "pm", staffTop - 27, palette);
    drawTechniqueRanges(context, coordinates, "let-ring", staffTop - 16, palette);

    for (const coordinate of coordinates) {
      const { event, x } = coordinate;
      drawPickMarker(context, x, staffTop - 12, event.modifiers, palette);

      for (const note of event.notes) {
        const y = staffTop + (note.string - 1) * stringGap;
        const value = note.fret === "x" || event.modifiers.includes("dead")
          ? "x"
          : String(note.fret);
        context.font = `700 11px ${mono}`;
        const textWidth = context.measureText(value).width;
        context.fillStyle = palette.surface;
        context.fillRect(x - textWidth / 2 - 2, y - 7, textWidth + 4, 14);
        context.fillStyle = palette.text;
        context.textAlign = "center";
        context.fillText(value, x, y + 4);
      }
    }

    drawRhythm(context, measure, coordinates, staffBottom, palette);

    if (countsVisible) {
      drawCounts(context, measure, coordinates, staffBottom + 82, palette);
    }

    if (index === measures.length - 1) {
      context.strokeStyle = palette.text;
      context.lineWidth = 1.6;
      context.beginPath();
      context.moveTo(end, staffTop);
      context.lineTo(end, staffBottom);
      context.stroke();
    }
  }

  const previousMeasure = score.measures[firstMeasureIndex - 1];
  const previousEvent = previousMeasure?.events.at(-1);
  drawTies(context, allCoordinates, staffTop, previousEvent, palette);

  if (score.metadata.repeat) {
    const isFirstSystem = firstMeasureIndex === 0;
    const isLastSystem = firstMeasureIndex + measures.length === score.measures.length;

    if (isFirstSystem || isLastSystem) {
      drawRepeat(
        context,
        staffStart,
        staffStart + measureWidth * measures.length,
        staffTop,
        staffBottom,
        score.metadata.repeat,
        isFirstSystem,
        isLastSystem,
        palette,
      );
    }
  }
}

class TabScoreRenderer {
  readonly #viewport: HTMLElement;
  readonly #systems: HTMLElement;
  readonly #figure: HTMLElement;
  readonly #score: TabScore;
  readonly #countsButton: HTMLButtonElement;
  readonly #resizeObserver: ResizeObserver;
  #printing = false;
  #lastWidth = 0;

  constructor(viewport: HTMLElement) {
    this.#viewport = viewport;
    this.#systems = viewport.querySelector<HTMLElement>(".tab-score__systems")!;
    this.#figure = viewport.closest<HTMLElement>(".tab-score")!;
    this.#score = JSON.parse(viewport.dataset.tabScore!) as TabScore;
    this.#countsButton = this.#figure.querySelector<HTMLButtonElement>(
      "[data-tab-score-counts]",
    )!;
    this.#countsButton.addEventListener("click", () => this.#toggleCounts());
    this.#resizeObserver = new ResizeObserver(() => this.render());
    this.#resizeObserver.observe(this.#viewport);
    this.render(true);
  }

  setPrinting(printing: boolean): void {
    this.#printing = printing;
    this.render(true);
  }

  render(force = false): void {
    const width = Math.floor(this.#systems.clientWidth);

    if (!force && width === this.#lastWidth) return;

    this.#lastWidth = width;
    const mobile = !this.#printing && mobileQuery.matches;
    const measuresPerSystem = mobile ? 1 : desktopMeasuresPerSystem;
    const countsVisible = this.#viewport.dataset.countsVisible === "true";
    let systemIndex = 0;

    for (let index = 0; index < this.#score.measures.length; index += measuresPerSystem) {
      const measures = this.#score.measures.slice(index, index + measuresPerSystem);
      const existingWrapper = this.#systems.children.item(systemIndex);
      const wrapper = existingWrapper instanceof HTMLElement
        ? existingWrapper
        : document.createElement("div");
      const existingCanvas = wrapper.querySelector("canvas");
      const canvas = existingCanvas ?? document.createElement("canvas");
      const maximumEventCount = Math.max(
        ...measures.map((measure) => measure.events.length),
      );
      const minimumSystemWidth = 72 + maximumEventCount * 20 * measuresPerSystem;
      const denseWidth = this.#printing
        ? width
        : Math.max(width, minimumSystemWidth);

      wrapper.className = "tab-score__system";
      canvas.className = "tab-score__canvas";
      canvas.setAttribute("aria-hidden", "true");
      if (!existingCanvas) wrapper.append(canvas);
      if (!existingWrapper) this.#systems.append(wrapper);
      drawSystem(
        canvas,
        this.#score,
        measures,
        denseWidth,
        countsVisible,
        index,
        measuresPerSystem,
        this.#printing,
      );
      systemIndex += 1;
    }

    while (this.#systems.children.length > systemIndex) {
      this.#systems.lastElementChild?.remove();
    }
  }

  #toggleCounts(): void {
    const visible = this.#viewport.dataset.countsVisible !== "true";
    this.#viewport.dataset.countsVisible = String(visible);
    this.#countsButton.setAttribute("aria-pressed", String(visible));
    this.#countsButton.textContent = visible ? "隐藏数拍" : "显示数拍";
    this.render(true);
  }
}

export function initializeTabScores(): void {
  const renderers = [...document.querySelectorAll<HTMLElement>("[data-tab-score]")]
    .map((viewport) => new TabScoreRenderer(viewport));

  if (renderers.length === 0) return;

  const redraw = () => renderers.forEach((renderer) => renderer.render(true));
  const themeObserver = new MutationObserver(redraw);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  mobileQuery.addEventListener("change", redraw);
  window.addEventListener("beforeprint", () => {
    renderers.forEach((renderer) => renderer.setPrinting(true));
  });
  window.addEventListener("afterprint", () => {
    renderers.forEach((renderer) => renderer.setPrinting(false));
  });
}

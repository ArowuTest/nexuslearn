"use client";

import { useState, type PointerEvent } from "react";
import { playProducedAudio } from "@/lib/sound";

type StudioQuestion = {
  id: string;
  a?: number;
  b?: number;
  expected: number | string;
  prompt: string;
  format: string;
  choices: Array<number | string>;
  hints: string[];
  body: Record<string, unknown>;
};

type Option = {
  label: string;
  value: string;
  detail?: string;
};

type Props = {
  question: StudioQuestion;
  input: string;
  showHint: boolean;
  onChoose: (value: string) => void;
  onKey: (key: string) => void;
  onSubmit: () => void;
  responseMode: "interactive" | "keyboard";
  onResponseModeChange: (mode: "interactive" | "keyboard") => void;
};

const ENERGY_SIMULATOR = "energy-transfer-simulator";

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string | number => typeof item === "string" || typeof item === "number").map(String)
    : [];
}

function formatLabel(format: string) {
  return format.replaceAll("_", "-").split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function choiceOptions(question: StudioQuestion): Option[] {
  const format = question.format.toLowerCase();
  const bodyChoices = asStringArray(question.body.choices);
  const expected = String(question.expected);

  if (format === "model-sort" && bodyChoices.every((choice) => /^[A-C]$/.test(choice)) && !bodyChoices.includes(expected)) {
    const correctLabel = expected.includes("far") || expected.includes("gas") ? "C" : expected.includes("slide") || expected.includes("liquid") ? "B" : "A";
    return [
      {
        label: "A",
        value: correctLabel === "A" ? expected : "model_with_close_fixed_particles",
        detail: "Particles close together in a fixed pattern.",
      },
      {
        label: "B",
        value: correctLabel === "B" ? expected : "model_with_close_sliding_particles",
        detail: "Particles close together and able to slide.",
      },
      {
        label: "C",
        value: correctLabel === "C" ? expected : "model_with_far_apart_random_particles",
        detail: "Particles far apart and moving freely.",
      },
    ];
  }

  const choices = question.choices.length ? question.choices.map(String) : bodyChoices;
  return choices.map((choice) => ({ label: choice, value: choice }));
}

function NumericArray({ a = 0, b = 0 }: { a?: number; b?: number }) {
  if (!a || !b || a > 12 || b > 12) return null;
  return (
    <div className="mx-auto mt-5 w-fit rounded-2xl bg-white/10 p-4">
      <p className="mb-2 text-center text-xs text-white/70">
        {a} rows of {b}
      </p>
      <div className="flex flex-col gap-1">
        {Array.from({ length: a }).map((_, r) => (
          <div key={r} className="flex gap-1">
            {Array.from({ length: b }).map((_, c) => (
              <span key={c} className="h-3 w-3 rounded-full bg-lagoon shadow-[0_0_10px_rgba(85,203,211,0.45)]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ArrayForge({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  const [rows, setRows] = useState(1);
  const [columns, setColumns] = useState(1);
  if (question.format.toLowerCase() !== "array-build" || !question.a || !question.b) return null;

  function update(nextRows: number, nextColumns: number) {
    setRows(nextRows);
    setColumns(nextColumns);
    onChoose(String(nextRows * nextColumns));
  }

  return (
    <div className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="rounded-2xl bg-white/8 p-4 text-sm font-semibold text-white">
          Rows: {rows}
          <input
            type="range"
            min="1"
            max="12"
            value={rows}
            onChange={(event) => update(Number(event.target.value), columns)}
            className="mt-3 w-full accent-[var(--world-accent)]"
          />
        </label>
        <label className="rounded-2xl bg-white/8 p-4 text-sm font-semibold text-white">
          In each row: {columns}
          <input
            type="range"
            min="1"
            max="12"
            value={columns}
            onChange={(event) => update(rows, Number(event.target.value))}
            className="mt-3 w-full accent-[var(--world-accent)]"
          />
        </label>
      </div>
      <div
        className="mt-5 overflow-auto rounded-2xl bg-[#fff7df] p-4"
        role="img"
        aria-label={`Array showing ${rows} rows of ${columns}. Product ${rows * columns}.`}
      >
        <div className="mx-auto grid w-fit gap-1">
          {Array.from({ length: rows }).map((_, row) => (
            <div key={row} className="flex gap-1">
              {Array.from({ length: columns }).map((_, column) => (
                <span key={column} className="h-4 w-4 rounded-md bg-[#18a7b5] shadow-[inset_0_-2px_0_rgba(0,0,0,0.16)]" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="font-display mt-4 text-center text-xl font-semibold text-white">
        {rows} × {columns} = <span className="text-[var(--world-accent)]">{input || rows * columns}</span>
      </p>
    </div>
  );
}

function WordBuilder({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  const [built, setBuilt] = useState<string[]>([]);
  if (question.format.toLowerCase() !== "word-build") return null;
  const tiles = asStringArray(question.body.tiles);

  function select(tile: string) {
    const next = [...built, tile];
    setBuilt(next);
    onChoose(next.join(""));
  }

  function undo() {
    const next = built.slice(0, -1);
    setBuilt(next);
    onChoose(next.join(""));
  }

  function clear() {
    setBuilt([]);
    onChoose("");
  }

  return (
    <div className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" role="group" aria-label="Word building tiles">
      <p className="font-display text-center text-xs uppercase tracking-[0.15em] text-[var(--world-accent)]">Build the word</p>
      <div className="mt-4 flex min-h-20 flex-wrap items-center justify-center gap-2 rounded-2xl bg-[#fff7df] p-4" aria-live="polite">
        {built.length ? built.map((tile, index) => (
          <span key={`${tile}-${index}`} className="flex h-14 w-14 items-center justify-center rounded-xl bg-white text-2xl font-bold text-ink shadow-card">
            {tile}
          </span>
        )) : <span className="text-sm font-medium text-ink/75">Tap the sound tiles in order</span>}
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {tiles.map((tile, index) => (
          <button key={`${tile}-${index}`} type="button" onClick={() => select(tile)} className="btn-pop min-h-14 min-w-14 bg-white/15 px-4 text-xl font-bold text-white">
            {tile}
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-center gap-3">
        <button type="button" onClick={undo} disabled={!built.length} className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Undo</button>
        <button type="button" onClick={clear} disabled={!built.length} className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Clear</button>
      </div>
    </div>
  );
}

function NounPhraseBuilder({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  if (question.format.toLowerCase() !== "noun-phrase-builder" || asStringArray(question.body.tiles).length < 2) return null;
  const tiles = asStringArray(question.body.tiles);
  const [built, setBuilt] = useState<string[]>([]);
  const [used, setUsed] = useState<number[]>([]);
  const phrase = (parts: string[]) => parts.join(" ").replaceAll(" ,", ",").replaceAll(" .", ".");
  const publish = (next: string[], nextUsed: number[]) => { setBuilt(next); setUsed(nextUsed); onChoose(phrase(next)); };
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Noun phrase builder">
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Phrase workshop</p>
    <p className="mt-2 text-center text-sm text-white/80">Build the clearest phrase. Tap cards in order; no dragging or handwriting is needed.</p>
    <p className="mt-5 min-h-16 rounded-2xl bg-[#fff7df] p-4 text-center text-xl font-semibold text-ink" aria-live="polite">{built.length ? phrase(built) : "Your phrase will appear here"}</p>
    <div className="mt-4 flex flex-wrap justify-center gap-2">{tiles.map((tile, index) => <button key={`${tile}-${index}`} type="button" disabled={used.includes(index)} onClick={() => publish([...built, tile], [...used, index])} className="min-h-12 rounded-xl bg-white px-4 font-semibold text-ink disabled:opacity-35">{tile}</button>)}</div>
    <div className="mt-4 flex gap-3"><button type="button" onClick={() => publish(built.slice(0, -1), used.slice(0, -1))} disabled={!built.length} className="min-h-12 flex-1 rounded-xl bg-white/15 px-4 font-semibold text-white disabled:opacity-35">Undo</button><button type="button" onClick={() => publish([], [])} disabled={!built.length} className="min-h-12 flex-1 rounded-xl bg-white/15 px-4 font-semibold text-white disabled:opacity-35">Start again</button></div>
  </section>;
}

function TraceTrail({ letter, expected, onComplete }: { letter: string; expected: string; onComplete: (value: string) => void }) {
  const shown = letter || "c";
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<Array<{ x: number; y: number }>>([]);

  function point(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.round(((event.clientX - bounds.left) / bounds.width) * 260),
      y: Math.round(((event.clientY - bounds.top) / bounds.height) * 220),
    };
  }

  function start(event: PointerEvent<SVGSVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrawing(true);
    setPoints([point(event)]);
  }

  function move(event: PointerEvent<SVGSVGElement>) {
    if (!drawing) return;
    setPoints((current) => [...current, point(event)]);
  }

  function finish() {
    setDrawing(false);
    if (points.length >= 8) onComplete(expected);
  }

  return (
    <div className="mx-auto mt-6 max-w-md rounded-3xl border border-white/10 bg-white/10 p-5">
      <div className="relative mx-auto h-56 max-w-xs rounded-3xl bg-[#fff7df] text-ink shadow-[inset_0_-18px_42px_rgba(255,191,69,0.18)]">
        <svg
          className="absolute inset-0 h-full w-full touch-none"
          viewBox="0 0 260 220"
          role="img"
          aria-label={`Trace the lowercase letter ${shown}`}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={finish}
          onPointerCancel={() => setDrawing(false)}
        >
          <path
            d="M168 63 C118 28 62 65 66 116 C70 172 128 190 178 150"
            className="letter-trace-path"
            fill="none"
            stroke="#18a7b5"
            strokeLinecap="round"
            strokeWidth="18"
          />
          <circle cx="168" cy="63" r="15" fill="#ffbf45" className="anim-glow" />
          <path d="M155 54 l18 9 l-17 11" fill="none" stroke="#17233f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
          {points.length > 1 && (
            <polyline
              points={points.map((item) => `${item.x},${item.y}`).join(" ")}
              fill="none"
              stroke="#ff7b73"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="10"
            />
          )}
        </svg>
        <span className="font-display absolute inset-0 flex items-center justify-center text-[160px] font-semibold text-[#17233f]/10">
          {shown}
        </span>
      </div>
      <p className="mt-4 text-center text-sm leading-6 text-white/70">
        Start at the glowing dot and draw along the trail. Keyboard users can use the completion button below.
      </p>
    </div>
  );
}

function SentenceBoard({ question, options, input, onChoose }: { question: StudioQuestion; options: Option[]; input: string; onChoose: (value: string) => void }) {
  const isParagraph = ["sentence-sort", "paragraph-build", "theme-choice"].includes(question.format.toLowerCase());
  if (!isParagraph) return null;
  return (
    <div className="mt-6 grid gap-3" role="group" aria-label="Sentence and paragraph cards">
      <div className="rounded-3xl border border-white/10 bg-[#fff7df] p-4 text-ink shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
        <p className="font-display text-xs uppercase tracking-[0.14em] text-[#8b5d16]">Explorer notebook</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {options.map((option, index) => (
            <button
              key={`${option.label}-${index}`}
              onClick={() => onChoose(option.value)}
              className={`sentence-card text-left ${input === option.value ? "sentence-card-selected" : ""}`}
            >
              <span className="font-display text-xs font-semibold uppercase text-[#65410d]">Card {index + 1}</span>
              <span className="mt-1 block text-sm font-semibold leading-5">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SequenceBoard({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  const format = question.format.toLowerCase();
  const supportedFormats = new Set(["audio-sequence", ENERGY_SIMULATOR, "fossil-sequence", "growth-sequence", "hygiene-step-order", "life-cycle-sequence", "picture-sequence", "time-interval-sequence"]);
  const cards = asStringArray(question.body.cards ?? question.body.available_cards);
  const sequenceChoices = Array.isArray(question.body.choices)
    ? question.body.choices
      .filter((choice): choice is Array<string | number> => Array.isArray(choice) && choice.every((item) => typeof item === "string" || typeof item === "number"))
      .map((choice) => choice.map(String))
    : [];
  const [ordered, setOrdered] = useState(cards);
  if (!supportedFormats.has(format) || (cards.length < 2 && sequenceChoices.length < 2)) return null;

  function publish(next: string[]) {
    setOrdered(next);
    onChoose(JSON.stringify(next));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    publish(next);
  }

  if (cards.length < 2) {
    return (
      <div className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" role="group" aria-label="Sequence choice board">
        <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Choose the sequence that makes sense</p>
        <div className="mt-4 grid gap-3">
          {sequenceChoices.map((sequence, index) => {
            const value = JSON.stringify(sequence);
            return (
              <button
                key={value}
                type="button"
                onClick={() => onChoose(value)}
                className={"rounded-2xl border p-4 text-left " + (input === value ? "border-[var(--world-accent)] bg-white text-ink ring-4 ring-[var(--world-accent)]" : "border-white/15 bg-white/10 text-white")}
                aria-pressed={input === value}
              >
                <span className="font-display text-xs uppercase tracking-[0.12em] opacity-70">Sequence {index + 1}</span>
                <span className="mt-2 flex flex-wrap gap-2">
                  {sequence.map((stage, stageIndex) => <span key={stage + "-" + stageIndex} className="rounded-lg bg-black/10 px-2 py-1 text-sm font-semibold">{stage}</span>)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" role="group" aria-label="Sequence ordering board">
      <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Put the stages in order</p>
      <ol className="mt-4 grid gap-3">
        {ordered.map((card, index) => (
          <li key={card + "-" + index} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl bg-[#fff7df] p-3 text-ink">
            <span className="font-display flex h-8 w-8 items-center justify-center rounded-full bg-[#17233f] text-sm text-white">{index + 1}</span>
            <span className="font-semibold">{card}</span>
            <span className="flex gap-2">
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="rounded-lg bg-[#17233f] px-3 py-2 text-sm font-bold text-white disabled:opacity-35" aria-label={"Move " + card + " earlier"}>↑</button>
              <button type="button" onClick={() => move(index, 1)} disabled={index === ordered.length - 1} className="rounded-lg bg-[#17233f] px-3 py-2 text-sm font-bold text-white disabled:opacity-35" aria-label={"Move " + card + " later"}>↓</button>
            </span>
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => onChoose(JSON.stringify(ordered))} className={"mt-4 min-h-12 w-full rounded-xl px-4 font-semibold " + (input ? "bg-leaf text-white" : "bg-white text-ink")}>
        Use this order
      </button>
    </div>
  );
}

function CoordinateBoard({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  if (question.format.toLowerCase() !== "coordinate-plot") return null;
  const grid = question.body.grid as Record<string, unknown> | undefined;
  const xMax = Number(grid?.x_max);
  const yMax = Number(grid?.y_max);
  const target = Array.isArray(question.body.target) ? question.body.target : [];
  if (!Number.isInteger(xMax) || !Number.isInteger(yMax) || xMax < 1 || yMax < 1 || xMax > 12 || yMax > 12 || target.length !== 2) return null;

  const selected = (() => {
    try {
      const value = JSON.parse(input);
      return Array.isArray(value) && value.length === 2 && value.every((item) => Number.isInteger(item)) ? value as [number, number] : null;
    } catch {
      return null;
    }
  })();
  const [x, setX] = useState<number>(selected?.[0] ?? 0);
  const [y, setY] = useState<number>(selected?.[1] ?? 0);
  const choose = (nextX: number, nextY: number) => {
    setX(nextX);
    setY(nextY);
    onChoose(JSON.stringify([nextX, nextY]));
  };

  return (
    <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Coordinate plotter">
      <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Coordinate explorer</p>
      <p className="mt-2 text-center text-sm text-white/80">Choose x first, then y. Each point is a large button, so no precise dragging is needed.</p>
      <div className="mx-auto mt-5 grid w-fit gap-1 rounded-2xl bg-[#fff7df] p-2" style={{ gridTemplateColumns: `repeat(${xMax + 1}, minmax(2rem, 1fr))` }} role="grid" aria-label={`First quadrant grid from zero to ${xMax} across and zero to ${yMax} up`}>
        {Array.from({ length: yMax + 1 }, (_, row) => yMax - row).flatMap((gridY) =>
          Array.from({ length: xMax + 1 }, (_, gridX) => {
            const isSelected = selected?.[0] === gridX && selected?.[1] === gridY;
            return <button key={`${gridX}-${gridY}`} type="button" role="gridcell" onClick={() => choose(gridX, gridY)} aria-label={`Plot point (${gridX}, ${gridY})`} aria-pressed={isSelected} className={`flex min-h-9 min-w-9 items-center justify-center rounded-lg border text-xs font-bold ${isSelected ? "border-[#17233f] bg-leaf text-white ring-2 ring-sun" : "border-[#17233f]/20 bg-white text-ink hover:bg-sun focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun"}`}>
              {isSelected ? "●" : gridX === 0 ? gridY : gridY === 0 ? gridX : ""}
            </button>;
          }),
        )}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <label className="text-sm font-semibold text-white">x coordinate
          <input type="number" min="0" max={xMax} value={x} onChange={(event) => setX(Math.max(0, Math.min(xMax, Number(event.target.value) || 0)))} className="mt-1 min-h-12 w-full rounded-xl border border-white/20 bg-[#fff7df] px-3 text-ink" />
        </label>
        <label className="text-sm font-semibold text-white">y coordinate
          <input type="number" min="0" max={yMax} value={y} onChange={(event) => setY(Math.max(0, Math.min(yMax, Number(event.target.value) || 0)))} className="mt-1 min-h-12 w-full rounded-xl border border-white/20 bg-[#fff7df] px-3 text-ink" />
        </label>
      </div>
      <button type="button" onClick={() => choose(x, y)} className="mt-4 min-h-12 w-full rounded-xl bg-leaf px-4 font-semibold text-white">Plot ({x}, {y})</button>
    </section>
  );
}

function coordinatePair(value: unknown): [number, number] | null {
  return Array.isArray(value) && value.length === 2 && value.every((item) => Number.isInteger(item)) ? value as [number, number] : null;
}

function CoordinateMap({ question }: { question: StudioQuestion }) {
  const format = question.format.toLowerCase();
  if (!['coordinate-read', 'movement-translation'].includes(format)) return null;
  const point = coordinatePair(format === 'coordinate-read' ? question.body.point : question.body.start);
  if (!point || point.some((value) => value < 0 || value > 10)) return null;
  const move = question.body.move as Record<string, unknown> | undefined;
  const right = Number(move?.right ?? 0);
  const up = Number(move?.up ?? 0);
  const xMax = Math.min(10, Math.max(6, point[0] + (Number.isFinite(right) ? right + 1 : 1)));
  const yMax = Math.min(10, Math.max(6, point[1] + (Number.isFinite(up) ? up + 1 : 1)));
  const marker = format === 'coordinate-read' ? '⚑' : '◆';
  const label = format === 'coordinate-read' ? 'A flag is on this point. Read across first, then up.' : `A gem starts here. Move it ${right} square${right === 1 ? '' : 's'} right and ${up} square${up === 1 ? '' : 's'} up.`;

  return (
    <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label={format === 'coordinate-read' ? 'Coordinate reading map' : 'Coordinate translation map'}>
      <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">{format === 'coordinate-read' ? 'Treasure map' : 'Gem mover'}</p>
      <p className="mt-2 text-center text-sm text-white/80">{label}</p>
      <div className="mx-auto mt-5 grid w-fit gap-1 rounded-2xl bg-[#fff7df] p-2" style={{ gridTemplateColumns: `repeat(${xMax + 1}, minmax(2rem, 1fr))` }} role="img" aria-label={label}>
        {Array.from({ length: yMax + 1 }, (_, row) => yMax - row).flatMap((gridY) =>
          Array.from({ length: xMax + 1 }, (_, gridX) => {
            const marked = point[0] === gridX && point[1] === gridY;
            return <span key={`${gridX}-${gridY}`} aria-hidden="true" className={`flex min-h-9 min-w-9 items-center justify-center rounded-lg border text-xs font-bold ${marked ? 'border-[#17233f] bg-sun text-ink ring-2 ring-leaf' : 'border-[#17233f]/20 bg-white text-ink'}`}>
              {marked ? marker : gridX === 0 ? gridY : gridY === 0 ? gridX : ''}
            </span>;
          }),
        )}
      </div>
      {format === 'movement-translation' && <p className="mt-3 text-center text-sm font-semibold text-sun">Across first → then up ↑</p>}
    </section>
  );
}

function PhonemeCounter({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  if (question.format.toLowerCase() !== 'phoneme-count') return null;
  const sounds = asStringArray(question.body.sounds);
  const choices = asStringArray(question.body.choices).filter((choice) => /^\d+$/.test(choice));
  if (!sounds.length || choices.length < 2) return null;
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Sound counter activity">
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Sound detective</p>
    <p className="mt-2 text-center text-sm text-white/80">Tap one counter for each sound you hear. Say the sounds slowly, not the letter names.</p>
    <div className="mt-5 flex flex-wrap justify-center gap-3" aria-label={`${sounds.length} sound counters`}>
      {sounds.map((sound, index) => <span key={`${sound}-${index}`} className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-sun bg-leaf text-xl font-bold text-white" aria-label={`Sound ${index + 1}: ${sound}`}>●</span>)}
    </div>
    <div className="mt-5 grid grid-cols-3 gap-3">
      {choices.map((choice) => <button key={choice} type="button" onClick={() => onChoose(choice)} aria-pressed={input === choice} className={`min-h-14 rounded-2xl border-2 text-xl font-bold ${input === choice ? 'border-sun bg-leaf text-white ring-4 ring-sun' : 'border-white/20 bg-[#fff7df] text-ink hover:bg-sun'}`}>{choice}</button>)}
    </div>
  </section>;
}

function SoundBoxBuilder({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  if (question.format.toLowerCase() !== 'sound-box-build') return null;
  const tiles = asStringArray(question.body.tiles);
  const boxCount = Number(question.body.sound_boxes);
  if (!Number.isInteger(boxCount) || boxCount < 2 || boxCount > 6 || tiles.length < boxCount) return null;
  const initial = (() => {
    try {
      const value = JSON.parse(input);
      return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : [];
    } catch { return []; }
  })();
  const [built, setBuilt] = useState<string[]>(initial);
  const [used, setUsed] = useState<number[]>([]);
  const publish = (next: string[], nextUsed: number[]) => { setBuilt(next); setUsed(nextUsed); onChoose(JSON.stringify(next)); };
  const add = (tile: string, index: number) => { if (built.length < boxCount) publish([...built, tile], [...used, index]); };
  const undo = () => publish(built.slice(0, -1), used.slice(0, -1));
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Sound box builder">
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Sound box builder</p>
    <p className="mt-2 text-center text-sm text-white/80">Say each sound, then place its letter tile in the next box. You can tap; dragging is never needed.</p>
    <ol className="mt-5 grid gap-2" style={{ gridTemplateColumns: `repeat(${boxCount}, minmax(0, 1fr))` }} aria-label={`${boxCount} sound boxes`}>
      {Array.from({ length: boxCount }, (_, index) => <li key={index} className="flex min-h-16 items-center justify-center rounded-xl border-2 border-dashed border-sun bg-[#fff7df] text-2xl font-bold text-ink" aria-label={`Sound box ${index + 1}${built[index] ? `: ${built[index]}` : ': empty'}`}>{built[index] ?? ''}</li>)}
    </ol>
    <div className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Letter tiles">
      {tiles.map((tile, index) => <button key={`${tile}-${index}`} type="button" disabled={used.includes(index) || built.length >= boxCount} onClick={() => add(tile, index)} className="min-h-12 min-w-12 rounded-xl bg-white px-3 text-lg font-bold text-ink disabled:opacity-35">{tile}</button>)}
    </div>
    <div className="mt-4 flex gap-3"><button type="button" onClick={undo} disabled={!built.length} className="min-h-12 flex-1 rounded-xl bg-white px-4 font-semibold text-ink disabled:opacity-35">Undo last tile</button><button type="button" onClick={() => publish(built, used)} disabled={built.length !== boxCount} className="min-h-12 flex-1 rounded-xl bg-leaf px-4 font-semibold text-white disabled:opacity-35">Use these boxes</button></div>
  </section>;
}

function EvidenceCard({ question }: { question: StudioQuestion }) {
  if (question.format.toLowerCase() !== 'evidence-explain') return null;
  const evidence = typeof question.body.evidence_record === 'string' ? question.body.evidence_record : '';
  if (!evidence) return null;
  return <aside className="mx-auto mt-6 max-w-xl rounded-3xl border-2 border-sun/80 bg-[#fff7df] p-5 text-ink" aria-label="Evidence card">
    <p className="font-display text-xs uppercase tracking-[0.14em] text-[#695000]">Evidence card</p>
    <p className="mt-2 text-lg font-semibold leading-7">“{evidence}”</p>
    <p className="mt-3 text-sm leading-6">Choose the explanation that is best supported by this evidence.</p>
  </aside>;
}

function EvidenceSpanSelector({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  const format = question.format.toLowerCase();
  if (!['evidence-highlight', 'clue-highlight', 'evidence-link', 'evidence-rank'].includes(format)) return null;
  const choices = asStringArray(question.body.choices);
  const selectable = asStringArray(question.body.selectable_spans);
  const accepted = asStringArray(question.body.accepted_spans);
  const chunks = asStringArray(question.body.chunks);
  const candidates = choices.length >= 2 ? choices : selectable.length >= 2 ? selectable : accepted.length >= 2 ? accepted : chunks;
  const source = typeof question.body.extract === 'string' ? question.body.extract : typeof question.body.text === 'string' ? question.body.text : '';
  const inference = typeof question.body.inference === 'string' ? question.body.inference : typeof question.body.target_inference === 'string' ? question.body.target_inference : typeof question.body.target_mood === 'string' ? question.body.target_mood : '';
  let expectedArray: string[] = [];
  try { const value = JSON.parse(String(question.expected)); if (Array.isArray(value) && value.every((item) => typeof item === 'string')) expectedArray = value; } catch { /* scalar answer */ }
  const multi = expectedArray.length > 0;
  let selected: string[] = [];
  if (multi) {
    try { const value = JSON.parse(input); if (Array.isArray(value) && value.every((item) => typeof item === 'string')) selected = value; } catch { /* no selection yet */ }
  } else if (input) {
    selected = [input];
  }
  const expected = String(question.expected);
  const mappedValue = (candidate: string) => {
    if (multi) return candidate;
    if (accepted.length >= 2 && accepted.includes(candidate)) {
      const next = selected.includes(candidate) ? selected.filter((item) => item !== candidate) : [...selected, candidate];
      return next.length === accepted.length && accepted.every((item) => next.includes(item)) ? expected : '';
    }
    return source.toLowerCase().includes(expected.toLowerCase()) && candidate.toLowerCase().includes(expected.toLowerCase()) ? expected : candidate;
  };
  const toggle = (candidate: string) => {
    if (multi) {
      const next = selected.includes(candidate) ? selected.filter((item) => item !== candidate) : [...selected, candidate];
      onChoose(JSON.stringify(candidates.filter((item) => next.includes(item))));
      return;
    }
    if (accepted.length >= 2 && accepted.includes(candidate)) {
      const next = selected.includes(candidate) ? selected.filter((item) => item !== candidate) : [...selected, candidate];
      onChoose(next.length === accepted.length && accepted.every((item) => next.includes(item)) ? expected : '');
      return;
    }
    onChoose(mappedValue(candidate));
  };
  const title = format === 'evidence-rank' ? 'Evidence strength desk' : format === 'evidence-link' ? 'Clue-to-inference link' : format === 'clue-highlight' ? 'Clue finder' : 'Evidence finder';
  const instruction = multi ? 'Select every precise phrase that supports the idea. The order does not matter.' : format === 'evidence-rank' ? 'Choose the evidence that best supports the claim. Re-read before you decide.' : 'Select the most precise evidence. You can revise your choice at any time; there is no timer.';
  if (candidates.length < 2) return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label={title}>
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">{title}</p>
    {inference && <p className="mt-2 rounded-2xl bg-[#fff7df] p-4 text-sm font-semibold leading-6 text-ink">Claim or idea: {inference}</p>}
    {source && <p className="mt-4 rounded-2xl bg-[#fff7df] p-4 text-sm leading-6 text-ink"><span className="font-display text-xs uppercase">Text to inspect</span><br />{source}</p>}
    <label className="mt-4 block text-sm font-semibold text-white">Type the exact evidence phrase
      <input value={input} onChange={(event) => onChoose(event.target.value)} className="mt-2 min-h-14 w-full rounded-xl bg-[#fff7df] px-4 text-lg text-ink" aria-label="Evidence phrase" />
    </label>
  </section>;
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label={title}>
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">{title}</p>
    <p className="mt-2 text-center text-sm text-white/80">{instruction}</p>
    {inference && <p className="mt-4 rounded-2xl bg-[#fff7df] p-4 text-sm font-semibold leading-6 text-ink"><span className="font-display text-xs uppercase">Claim or idea</span><br />{inference}</p>}
    {source && <p className="mt-4 rounded-2xl bg-[#fff7df] p-4 text-sm leading-6 text-ink"><span className="font-display text-xs uppercase">Text to inspect</span><br />{source}</p>}
    <div className="mt-5 grid gap-3" role="group" aria-label="Evidence choices">{candidates.map((candidate, index) => {
      const active = multi ? selected.includes(candidate) : (selected.includes(candidate) || (input === expected && candidate.toLowerCase().includes(expected.toLowerCase())));
      return <button key={`${candidate}-${index}`} type="button" onClick={() => toggle(candidate)} aria-pressed={active} className={`rounded-2xl border-2 p-4 text-left ${active ? 'border-sun bg-[#fff7df] text-ink ring-2 ring-sun' : 'border-white/15 bg-white/5 text-white'}`}><span className="mr-2 font-display text-xs opacity-70">{index + 1}.</span>{candidate}</button>;
    })}</div>
    <p className="mt-4 text-center text-xs text-white/70">Touch, keyboard, switch scanning and a spoken/AAC partner route all use the same numbered choices. No fine dragging is required.</p>
  </section>;
}

function FeatureExplorer({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  if (question.format.toLowerCase() !== 'feature-tap') return null;
  const options = asStringArray(question.body.choices).length ? asStringArray(question.body.choices) : asStringArray(question.body.hotspots);
  const subject = String(question.body.animal ?? question.body.shape ?? 'discovery');
  if (options.length < 2) return null;
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Feature explorer">
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">{question.body.animal ? 'Field guide explorer' : 'Shape builder explorer'}</p>
    <p className="mt-2 text-center text-sm text-white/80">Find the most useful clue about <strong>{subject}</strong>. Every clue is a large labelled button.</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">{options.map((option) => <button key={option} type="button" onClick={() => onChoose(option)} aria-pressed={input === option} className={`min-h-16 rounded-2xl border-2 px-4 text-left font-semibold ${input === option ? 'border-sun bg-[#fff7df] text-ink ring-2 ring-sun' : 'border-white/15 bg-white/5 text-white'}`}>{option}</button>)}</div>
    <p className="mt-4 text-center text-xs text-white/70">A careful observation earns a calm explorer spark—there is no timer or penalty for trying again.</p>
  </section>;
}

function LifeEvidenceBoard({ question }: { question: StudioQuestion }) {
  if (question.format.toLowerCase() !== 'life-status-sort') return null;
  const stages = asStringArray(question.body.stage_cards);
  const item = typeof question.body.item === 'string' ? question.body.item : '';
  const model = typeof question.body.text_model === 'string' ? question.body.text_model : '';
  if (!stages.length && !item && !model) return null;
  return <aside className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Life science evidence board">
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Ecology evidence board</p>
    {item && <p className="mt-3 rounded-2xl bg-[#fff7df] p-4 text-center text-lg font-semibold text-ink">Observation: {item}</p>}
    {stages.length > 0 && <ol className="mt-4 grid gap-2 sm:grid-cols-2">{stages.map((stage, index) => <li key={stage} className="rounded-xl bg-[#fff7df] p-3 text-ink"><span className="mr-2 font-display text-xs">{index + 1}</span>{stage}</li>)}</ol>}
    {model && <p className="mt-4 rounded-xl border border-sun/60 bg-[#fff7df] p-3 text-sm leading-6 text-ink">Read the evidence: {model}</p>}
    <p className="mt-4 text-center text-xs text-white/70">Use the evidence board, then choose your classification. There is no timer and revising is always allowed.</p>
  </aside>;
}

function ClassificationKeyBoard({ question }: { question: StudioQuestion }) {
  if (question.format.toLowerCase() !== 'classification-key') return null;
  const path = asStringArray(question.body.key_path);
  const card = question.body.organism_card as Record<string, unknown> | undefined;
  const features = asStringArray(card?.features).length ? asStringArray(card?.features) : asStringArray(question.body.evidence);
  const organism = String(question.body.organism ?? 'organism');
  if (!path.length && !features.length) return null;
  return <aside className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Classification key evidence">
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Classification key</p>
    {features.length > 0 && <div className="mt-4 rounded-2xl bg-[#fff7df] p-4 text-ink"><p className="font-semibold">Evidence for {organism}</p><ul className="mt-2 grid gap-1 text-sm">{features.map((feature) => <li key={feature}>• {feature}</li>)}</ul></div>}
    {path.length > 0 && <ol className="mt-4 grid gap-2">{path.map((step, index) => <li key={step} className="rounded-xl border border-sun/60 bg-[#fff7df] p-3 text-ink"><span className="mr-2 font-display text-xs">Step {index + 1}</span>{step}</li>)}</ol>}
    <p className="mt-4 text-center text-xs text-white/70">Follow one checkable feature at a time. Take as long as you need.</p>
  </aside>;
}

function MeaningPurposeCard({ question }: { question: StudioQuestion }) {
  if (question.format.toLowerCase() !== 'meaning-choice') return null;
  const context = typeof question.body.transfer_context === 'string' ? question.body.transfer_context.replaceAll('_', ' ') : '';
  return <aside className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5 text-center" aria-label="Meaning check strategy">
    <p className="font-display text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Meaning check</p>
    <p className="mt-2 text-sm leading-6 text-white/85">Choose the sentence that says exactly what the reader needs—clear details matter more than extra words.</p>
    {context && <span className="mt-3 inline-block rounded-full bg-[#fff7df] px-3 py-1 text-xs font-semibold capitalize text-ink">Context: {context}</span>}
  </aside>;
}

function ParagraphThemeCard({ question }: { question: StudioQuestion }) {
  if (question.format.toLowerCase() !== 'paragraph-sort') return null;
  const theme = typeof question.body.theme === 'string' ? question.body.theme : '';
  if (!theme) return null;
  return <aside className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5 text-center" aria-label="Paragraph theme card">
    <p className="font-display text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Paragraph detective</p>
    <p className="mt-3 rounded-2xl bg-[#fff7df] p-4 text-lg font-semibold text-ink">Theme: {theme}</p>
    <p className="mt-3 text-sm leading-6 text-white/80">Keep the theme card open. Choose the sentence that gives the reader a useful detail about this topic.</p>
    <p className="mt-3 text-xs text-white/70">One thoughtful connection grows your writing map—there is no timer, streak or penalty for revising.</p>
  </aside>;
}

function MethodChoiceBoard({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  if (question.format.toLowerCase() !== 'method-choice') return null;
  const strategies = asStringArray(question.body.choices);
  const steps = asStringArray(question.body.strategy_steps);
  const calculation = typeof question.body.calculation === 'string' ? question.body.calculation : '';
  const [chosen, setChosen] = useState('');
  const expectsNumber = typeof question.expected === 'number';
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Calculation strategy board">
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Number workshop</p>
    {calculation && <p className="mt-3 rounded-2xl bg-[#fff7df] p-4 text-center text-2xl font-bold text-ink">{calculation}</p>}
    <p className="mt-3 text-center text-sm text-white/80">Estimate, choose a sensible plan, then check your calculation. There is no time pressure.</p>
    <div className="mt-4 grid gap-2">{strategies.map((strategy) => <button key={strategy} type="button" onClick={() => { setChosen(strategy); if (!expectsNumber) onChoose(strategy); }} aria-pressed={chosen === strategy || (!expectsNumber && input === strategy)} className={`rounded-xl border p-3 text-left text-sm ${chosen === strategy || (!expectsNumber && input === strategy) ? 'border-sun bg-[#fff7df] text-ink' : 'border-white/15 bg-white/5 text-white'}`}>{strategy}</button>)}</div>
    {steps.length > 0 && <ol className="mt-4 grid gap-2">{steps.map((step, index) => <li key={step} className="rounded-xl bg-white/10 p-3 text-sm text-white"><span className="mr-2 font-display text-xs text-sun">Step {index + 1}</span>{step}</li>)}</ol>}
    {expectsNumber && <label className="mt-4 block text-sm font-semibold text-white">Your calculated answer<input type="number" value={input} onChange={(event) => onChoose(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl bg-[#fff7df] px-3 text-lg text-ink" /></label>}
  </section>;
}

function ErrorAnalysisBoard({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  if (question.format.toLowerCase() !== 'error-analysis') return null;
  const options = asStringArray(question.body.choices).length ? asStringArray(question.body.choices) : asStringArray(question.body.error_choices);
  const steps = asStringArray(question.body.shown_steps);
  const shown = question.body.shown_answer;
  if (options.length < 2) return null;
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Worked example error analysis">
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Calculation detective</p>
    <p className="mt-3 text-center text-sm text-white/80">Find the first place where the method goes wrong. Correct reasoning stays visible while you investigate.</p>
    <div className="mt-4 rounded-2xl bg-[#fff7df] p-4 text-center font-mono text-lg text-ink">{steps.length ? steps.map((step) => <p key={step}>{step}</p>) : String(shown ?? '')}</div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">{options.map((option) => <button key={option} type="button" onClick={() => onChoose(option)} aria-pressed={input === option} className={`min-h-12 rounded-xl border-2 px-4 text-left font-semibold ${input === option ? 'border-sun bg-[#fff7df] text-ink' : 'border-white/15 bg-white/5 text-white'}`}>{option}</button>)}</div>
    <p className="mt-4 text-center text-xs text-white/70">Detective work is about checking, not speed. You can revise without losing progress.</p>
  </section>;
}

function ReaderEffectBoard({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  if (question.format.toLowerCase() !== 'reader-effect-choice') return null;
  const versions = asStringArray(question.body.choices).length ? asStringArray(question.body.choices) : asStringArray(question.body.versions);
  const source = typeof question.body.original === 'string' ? question.body.original : typeof question.body.text === 'string' ? question.body.text : '';
  if (versions.length < 2) return null;
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Reader effect comparison board">
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Publishing studio</p>
    {source && <p className="mt-3 rounded-2xl bg-[#fff7df] p-4 text-ink"><span className="font-display text-xs">Original</span><br />{source}</p>}
    <p className="mt-3 text-center text-sm text-white/80">Compare each version for clarity, meaning and reader effect. Choose the strongest edit.</p>
    <div className="mt-4 grid gap-3">{versions.map((version, index) => <button key={version} type="button" onClick={() => onChoose(version)} aria-pressed={input === version} className={`rounded-2xl border-2 p-4 text-left ${input === version ? 'border-sun bg-[#fff7df] text-ink' : 'border-white/15 bg-white/5 text-white'}`}><span className="font-display mr-2 text-xs opacity-70">Version {index + 1}</span>{version}</button>)}</div>
  </section>;
}

function GrammarWorkshop({ question, input, onChoose, onSubmit }: { question: StudioQuestion; input: string; onChoose: (value: string) => void; onSubmit: () => void }) {
  const format = question.format.toLowerCase();
  if (!['sentence-editor', 'clause-link-map', 'relative-clause-editor', 'sentence-combiner'].includes(format)) return null;
  const choices = asStringArray(question.body.choices);
  if (choices.length < 2) return null;
  const antecedent = typeof question.body.antecedent === 'string' ? question.body.antecedent : '';
  const clause = typeof question.body.clause === 'string' ? question.body.clause : '';
  const baseNoun = typeof question.body.base_noun === 'string' ? question.body.base_noun : '';
  const sourceSentences = asStringArray(question.body.source_sentences);
  const title = format === 'sentence-editor' ? 'Sentence editing studio' : format === 'clause-link-map' ? 'Clause link map' : format === 'sentence-combiner' ? 'Sentence combining studio' : 'Relative clause editor';
  const instruction = format === 'sentence-editor'
    ? 'Keep the main meaning easy to find. Choose the edit that is grammatical, purposeful and clear.'
    : format === 'clause-link-map'
      ? 'Find the noun being described, then choose the link that matches its meaning and role.'
      : format === 'sentence-combiner'
        ? 'Place the extra information beside the noun it describes and check that the meaning stays clear.'
        : 'Check the clause boundary, reference arrow and punctuation. More words are not automatically better.';

  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label={title}>
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">{title}</p>
    <p className="mt-2 text-center text-sm text-white/80">{instruction}</p>
    {(baseNoun || antecedent || clause || sourceSentences.length > 0) && <div className="mt-4 grid gap-2 rounded-2xl bg-[#fff7df] p-4 text-sm text-ink">
      {baseNoun && <p><span className="font-display text-xs uppercase">Main noun</span><br />{baseNoun}</p>}
      {antecedent && <p><span className="font-display text-xs uppercase">Noun being described</span><br />{antecedent}</p>}
      {clause && <p><span className="font-display text-xs uppercase">Clause to inspect</span><br />{clause}</p>}
      {sourceSentences.map((sentence, index) => <p key={`${sentence}-${index}`}><span className="font-display text-xs uppercase">Source sentence {index + 1}</span><br />{sentence}</p>)}
    </div>}
    <div className="mt-4 grid gap-2" role="group" aria-label="Grammar edit choices">
      {choices.map((choice, index) => <button key={choice} type="button" onClick={() => onChoose(choice)} aria-pressed={input === choice} className={`min-h-14 rounded-xl border-2 p-3 text-left text-sm font-semibold ${input === choice ? 'border-sun bg-[#fff7df] text-ink' : 'border-white/15 bg-white/5 text-white'}`}><span className="font-display mr-2 text-xs opacity-70">Option {String.fromCharCode(65 + index)}</span>{choice}</button>)}
    </div>
    <p className="mt-3 text-center text-xs text-white/70">You can reread, change your choice and submit when the sentence makes sense. There is no timer.</p>
    <button type="button" onClick={onSubmit} disabled={!input} className="btn-pop mt-4 min-h-14 w-full bg-sun px-4 py-3 text-lg text-ink disabled:opacity-50" aria-label="Submit grammar answer">Send answer</button>
  </section>;
}

function ContextChoiceBoard({ question, input, onChoose, onSubmit }: { question: StudioQuestion; input: string; onChoose: (value: string) => void; onSubmit: () => void }) {
  const format = question.format.toLowerCase();
  if (!['meaning-substitute', 'reference-map', 'observation-record', 'noun-pronoun-repair', 'habitat-evidence-map', 'register-slider'].includes(format)) return null;
  const choices = asStringArray(question.body.choices);
  if (choices.length < 2) return null;
  const source = typeof question.body.source_sentence === 'string' ? question.body.source_sentence : typeof question.body.text === 'string' ? question.body.text : '';
  const reference = typeof question.body.reference === 'string' ? question.body.reference : '';
  const purpose = typeof question.body.stated_purpose === 'string' ? question.body.stated_purpose : '';
  const original = typeof question.body.original === 'string' ? question.body.original : '';
  const audience = typeof question.body.audience === 'string' ? question.body.audience : '';
  const evidenceIcons = asStringArray(question.body.evidence_icons);
  const day3 = question.body.day_3 && typeof question.body.day_3 === 'object' ? question.body.day_3 as Record<string, unknown> : null;
  const day7 = question.body.day_7 && typeof question.body.day_7 === 'object' ? question.body.day_7 as Record<string, unknown> : null;
  const title = format === 'meaning-substitute' ? 'Meaning workshop' : format === 'reference-map' ? 'Reference map' : format === 'observation-record' ? 'Observation lab' : format === 'habitat-evidence-map' ? 'Habitat evidence map' : format === 'register-slider' ? 'Register choice desk' : 'Pronoun repair desk';
  const context = format === 'meaning-substitute' ? purpose : format === 'reference-map' ? reference ? `Track the words: “${reference}”` : 'Track each reference to its clearest noun.' : format === 'observation-record' ? 'Use what can be seen or measured. Do not add feelings or guesses.' : format === 'habitat-evidence-map' ? 'Link the living thing to observable conditions that meet its needs.' : format === 'register-slider' ? `Choose the version suited to the ${audience || 'intended audience'}.` : 'Keep the person or thing being described clear across both sentences.';
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label={title}>
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">{title}</p>
    <p className="mt-2 text-center text-sm text-white/80">{context}</p>
    {source && <p className="mt-4 rounded-2xl bg-[#fff7df] p-4 text-sm leading-6 text-ink"><span className="font-display text-xs uppercase">Text to inspect</span><br />{source}</p>}
    {original && <p className="mt-4 rounded-2xl bg-[#fff7df] p-4 text-sm leading-6 text-ink"><span className="font-display text-xs uppercase">Original wording</span><br />{original}</p>}
    {evidenceIcons.length > 0 && <div className="mt-4 flex flex-wrap justify-center gap-2">{evidenceIcons.map((icon) => <span key={icon} className="rounded-xl bg-sun px-3 py-2 text-sm font-semibold text-ink">{icon}</span>)}</div>}
    {(day3 || day7) && <div className="mt-4 grid gap-2 sm:grid-cols-2"><div className="rounded-xl bg-white/10 p-3 text-sm text-white"><span className="font-display text-xs text-sun">Earlier</span><br />{day3 ? `${String(day3.height_cm ?? '')} cm, ${String(day3.leaf_count ?? '')} leaves — ${String(day3.description ?? '')}` : 'First observation'}</div><div className="rounded-xl bg-white/10 p-3 text-sm text-white"><span className="font-display text-xs text-sun">Later</span><br />{day7 ? `${String(day7.height_cm ?? '')} cm, ${String(day7.leaf_count ?? '')} leaves — ${String(day7.description ?? '')}` : 'Second observation'}</div></div>}
    <div className="mt-4 grid gap-2" role="group" aria-label="Contextual answer choices">
      {choices.map((choice, index) => <button key={choice} type="button" onClick={() => onChoose(choice)} aria-pressed={input === choice} className={`min-h-14 rounded-xl border-2 p-3 text-left text-sm font-semibold ${input === choice ? 'border-sun bg-[#fff7df] text-ink' : 'border-white/15 bg-white/5 text-white'}`}><span className="font-display mr-2 text-xs opacity-70">Option {String.fromCharCode(65 + index)}</span>{choice}</button>)}
    </div>
    <button type="button" onClick={onSubmit} disabled={!input} className="btn-pop mt-4 min-h-14 w-full bg-sun px-4 py-3 text-lg text-ink disabled:opacity-50" aria-label="Submit contextual answer">Send answer</button>
  </section>;
}

function DisciplineContextBoard({ question, input, onChoose, onSubmit }: { question: StudioQuestion; input: string; onChoose: (value: string) => void; onSubmit: () => void }) {
  if (question.format.toLowerCase() !== 'discipline-context-sort') return null;
  const cards = Array.isArray(question.body.cards) ? question.body.cards.filter((card): card is Record<string, unknown> => Boolean(card) && typeof card === 'object' && !Array.isArray(card)) : [];
  const choices = asStringArray(question.body.choices);
  if (cards.length < 2 || choices.length < 2) return null;
  let assignments: Record<string, string> = {};
  try { const parsed = JSON.parse(input); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) assignments = parsed as Record<string, string>; } catch { /* start empty */ }
  const subjectFor = (card: Record<string, unknown>, index: number) => { const sentence = String(card.sentence ?? ''); const match = sentence.match(/^In\s+([^,]+),/i); return match ? match[1] : `Subject ${index + 1}`; };
  const assign = (subject: string, value: string) => onChoose(JSON.stringify({ ...assignments, [subject]: value }));
  const complete = cards.every((card, index) => typeof assignments[subjectFor(card, index)] === 'string');
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Disciplinary vocabulary context sorter">
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Discipline vocabulary map</p><p className="mt-2 text-center text-sm text-white/80">The same word can become more precise in different subjects. Match each sentence to the meaning it uses.</p>
    <div className="mt-4 grid gap-3">{cards.map((card, index) => { const subject = subjectFor(card, index); return <label key={subject} className="rounded-xl bg-[#fff7df] p-3 text-sm font-semibold text-ink"><span className="font-display text-xs uppercase">{subject}</span><br />{String(card.sentence ?? '')}<select value={assignments[subject] ?? ''} onChange={(event) => assign(subject, event.target.value)} className="mt-2 min-h-11 w-full rounded-lg bg-white px-2 text-ink"><option value="">Choose meaning</option>{choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}</select></label>;})}</div>
    <button type="button" onClick={onSubmit} disabled={!complete} className="btn-pop mt-4 min-h-14 w-full bg-sun px-4 py-3 text-lg text-ink disabled:opacity-50" aria-label="Submit disciplinary vocabulary answer">Send answer</button>
  </section>;
}

function ReasoningChoiceBoard({ question, input, onChoose, onSubmit }: { question: StudioQuestion; input: string; onChoose: (value: string) => void; onSubmit: () => void }) {
  const format = question.format.toLowerCase();
  if (!['shape-evidence-map', 'evidence-explain-choice', 'function-choice'].includes(format)) return null;
  const choices = asStringArray(question.body.choices);
  const claims = asStringArray(question.body.claims);
  if (choices.length < 2) return null;
  const title = format === 'shape-evidence-map' ? 'Shape evidence map' : format === 'function-choice' ? 'Structure and function lab' : 'Explain with evidence';
  const instruction = format === 'shape-evidence-map' ? 'Check every defining property before you decide whether the claim follows.' : format === 'function-choice' ? 'Match each structure with the job it really performs. Similar names can have different jobs.' : 'Choose the explanation that accounts for the observation without adding an unsupported idea.';
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label={title}>
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">{title}</p>
    <p className="mt-2 text-center text-sm text-white/80">{instruction}</p>
    {claims.length > 0 && <div className="mt-4 flex flex-wrap justify-center gap-2">{claims.map((claim) => <span key={claim} className="rounded-xl bg-[#fff7df] px-3 py-2 text-sm font-semibold text-ink">{claim}</span>)}</div>}
    <div className="mt-4 grid gap-2" role="group" aria-label="Reasoning choices">
      {choices.map((choice, index) => <button key={choice} type="button" onClick={() => onChoose(choice)} aria-pressed={input === choice} className={`min-h-14 rounded-xl border-2 p-3 text-left text-sm font-semibold ${input === choice ? 'border-sun bg-[#fff7df] text-ink' : 'border-white/15 bg-white/5 text-white'}`}><span className="font-display mr-2 text-xs opacity-70">Option {String.fromCharCode(65 + index)}</span>{choice}</button>)}
    </div>
    <button type="button" onClick={onSubmit} disabled={!input} className="btn-pop mt-4 min-h-14 w-full bg-sun px-4 py-3 text-lg text-ink disabled:opacity-50" aria-label="Submit reasoning answer">Send answer</button>
  </section>;
}

function FunctionMachineBoard({ question, input, onChoose, onSubmit }: { question: StudioQuestion; input: string; onChoose: (value: string) => void; onSubmit: () => void }) {
  if (question.format.toLowerCase() !== 'function-machine') return null;
  const formula = typeof question.body.formula === 'string' ? question.body.formula : '';
  const inputData = question.body.input && typeof question.body.input === 'object' ? question.body.input as Record<string, unknown> : {};
  const choices = asStringArray(question.body.choices);
  if (!formula || choices.length < 2) return null;
  const n = String(inputData.n ?? inputData.x ?? '');
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Function machine board">
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Function machine</p>
    <p className="mt-2 text-center text-sm text-white/80">Put the input through the rule, show the substitution, then choose the output. You can check the rule again before sending.</p>
    <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center"><span className="rounded-xl bg-[#fff7df] p-3 font-bold text-ink">Input {n}</span><span className="font-display text-sun" aria-hidden="true">→</span><span className="rounded-xl bg-[#fff7df] p-3 font-bold text-ink">{formula}</span></div>
    <div className="mt-4 grid gap-2" role="group" aria-label="Function outputs">
      {choices.map((choice, index) => <button key={choice} type="button" onClick={() => onChoose(choice)} aria-pressed={input === choice} className={`min-h-14 rounded-xl border-2 p-3 text-left text-sm font-semibold ${input === choice ? 'border-sun bg-[#fff7df] text-ink' : 'border-white/15 bg-white/5 text-white'}`}><span className="font-display mr-2 text-xs opacity-70">Output {String.fromCharCode(65 + index)}</span>{choice}</button>)}
    </div>
    <button type="button" onClick={onSubmit} disabled={!input} className="btn-pop mt-4 min-h-14 w-full bg-sun px-4 py-3 text-lg text-ink disabled:opacity-50" aria-label="Submit function machine answer">Send answer</button>
  </section>;
}

function NumberModelBoard({ question, input, onChoose, onSubmit }: { question: StudioQuestion; input: string; onChoose: (value: string) => void; onSubmit: () => void }) {
  const format = question.format.toLowerCase();
  if (!['part-whole-build', 'part-whole-family', 'place-value-chart'].includes(format)) return null;
  const whole = Number(question.body.whole);
  const givenPart = Number(question.body.given_part);
  const parts = Array.isArray(question.body.parts) ? question.body.parts.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)) : [];
  const number = Number(question.body.number);
  const choices = asStringArray(question.body.choices);
  const isBuild = format === 'part-whole-build' && Number.isFinite(whole) && Number.isFinite(givenPart);
  const isFamily = format === 'part-whole-family' && parts.length === 2 && Number.isFinite(whole);
  const isPlaceValue = format === 'place-value-chart' && Number.isFinite(number) && choices.length >= 2;
  if (!isBuild && !isFamily && !isPlaceValue) return null;
  const title = isBuild ? 'Part–whole builder' : isFamily ? 'Fact-family workshop' : 'Place-value chart';
  const instruction = isBuild ? 'Keep the whole visible, place the given part, then find the missing part. You can use number buttons instead of dragging counters.' : isFamily ? 'The parts and whole stay visible while you choose the matching related fact.' : 'Read the hundreds, tens and ones places. The zero placeholder matters even when a place has no counters.';
  const select = (value: string) => onChoose(value);
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label={title}>
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">{title}</p>
    <p className="mt-2 text-center text-sm text-white/80">{instruction}</p>
    {isBuild && <div className="mt-4 grid grid-cols-3 items-center gap-2 text-center"><span className="rounded-xl bg-[#fff7df] p-3 font-bold text-ink">Whole {whole}</span><span className="font-display text-sun" aria-hidden="true">=</span><span className="rounded-xl bg-[#fff7df] p-3 font-bold text-ink">{givenPart} + ?</span></div>}
    {isFamily && <div className="mt-4 flex flex-wrap justify-center gap-2"><span className="rounded-xl bg-[#fff7df] px-4 py-3 font-bold text-ink">Part {parts[0]}</span><span className="rounded-xl bg-[#fff7df] px-4 py-3 font-bold text-ink">Part {parts[1]}</span><span className="rounded-xl bg-sun px-4 py-3 font-bold text-ink">Whole {whole}</span></div>}
    {isPlaceValue && <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-[#fff7df] p-3 text-ink"><span className="font-display block text-xs">Hundreds</span><strong className="text-2xl">{Math.floor(number / 100) % 10}</strong></div><div className="rounded-xl bg-[#fff7df] p-3 text-ink"><span className="font-display block text-xs">Tens</span><strong className="text-2xl">{Math.floor(number / 10) % 10}</strong></div><div className="rounded-xl bg-[#fff7df] p-3 text-ink"><span className="font-display block text-xs">Ones</span><strong className="text-2xl">{number % 10}</strong></div></div>}
    <div className="mt-4 grid gap-2" role="group" aria-label="Number model answers">
      {isBuild ? Array.from({ length: whole + 1 }, (_, value) => String(value)).map((value) => <button key={value} type="button" onClick={() => select(value)} aria-pressed={input === value} className={`min-h-12 rounded-xl border-2 p-3 text-center text-lg font-semibold ${input === value ? 'border-sun bg-[#fff7df] text-ink' : 'border-white/15 bg-white/5 text-white'}`}>{value}</button>) : choices.map((choice, index) => <button key={choice} type="button" onClick={() => select(choice)} aria-pressed={input === choice} className={`min-h-14 rounded-xl border-2 p-3 text-left text-sm font-semibold ${input === choice ? 'border-sun bg-[#fff7df] text-ink' : 'border-white/15 bg-white/5 text-white'}`}><span className="font-display mr-2 text-xs opacity-70">Option {String.fromCharCode(65 + index)}</span>{choice}</button>)}
    </div>
    <button type="button" onClick={onSubmit} disabled={!input} className="btn-pop mt-4 min-h-14 w-full bg-sun px-4 py-3 text-lg text-ink disabled:opacity-50" aria-label="Submit number model answer">Send answer</button>
  </section>;
}

function SentenceBuildBoard({ question, input, onChoose, onSubmit }: { question: StudioQuestion; input: string; onChoose: (value: string) => void; onSubmit: () => void }) {
  if (question.format.toLowerCase() !== 'sentence-build') return null;
  const tiles = asStringArray(question.body.tiles);
  if (tiles.length < 2) return null;
  let built: string[] = [];
  try { const parsed = JSON.parse(input); if (Array.isArray(parsed)) built = parsed.map(String); } catch { /* start empty */ }
  const chooseTile = (tile: string, index: number) => {
    const next = [...built, tile];
    onChoose(JSON.stringify(next));
    void index;
  };
  const removeLast = () => onChoose(JSON.stringify(built.slice(0, -1)));
  const clear = () => onChoose('[]');
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Sentence building board">
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Sentence builder</p>
    <p className="mt-2 text-center text-sm text-white/80">Choose one labelled tile at a time. The sentence stays visible, and dragging is never required.</p>
    <div className="mt-4 min-h-20 rounded-2xl bg-[#fff7df] p-4 text-center text-lg font-semibold text-ink" aria-live="polite">{built.length ? built.join(' ') : 'Choose tiles to begin'}</div>
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Sentence tiles">{tiles.map((tile, index) => <button key={`${tile}-${index}`} type="button" onClick={() => chooseTile(tile, index)} className="min-h-12 rounded-xl border-2 border-white/15 bg-white/5 p-3 text-left text-sm font-semibold text-white focus:border-sun">{tile}</button>)}</div>
    <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={removeLast} disabled={!built.length} className="min-h-11 rounded-xl bg-white/10 px-3 text-sm font-semibold text-white disabled:opacity-40">Undo last tile</button><button type="button" onClick={clear} disabled={!built.length} className="min-h-11 rounded-xl bg-white/10 px-3 text-sm font-semibold text-white disabled:opacity-40">Clear sentence</button></div>
    <button type="button" onClick={onSubmit} disabled={!built.length} className="btn-pop mt-4 min-h-14 w-full bg-sun px-4 py-3 text-lg text-ink disabled:opacity-50" aria-label="Submit sentence">Send sentence</button>
  </section>;
}

function FactFamilyBoard({ question, input, onChoose, onSubmit }: { question: StudioQuestion; input: string; onChoose: (value: string) => void; onSubmit: () => void }) {
  if (question.format.toLowerCase() !== 'fact-family-choice') return null;
  const choices = asStringArray(question.body.choices);
  const parts = Array.isArray(question.body.parts) ? question.body.parts.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)) : [];
  const groups = Number(question.body.groups); const groupSize = Number(question.body.group_size); const total = Number(question.body.total); const selectCount = Number(question.body.select_count);
  if (choices.length < 2) return null;
  let selected: string[] = [];
  try { const parsed = JSON.parse(input); selected = Array.isArray(parsed) ? parsed.map(String) : input ? [input] : []; } catch { if (input) selected = [input]; }
  const multi = Number.isInteger(selectCount) && selectCount > 1;
  const publish = (choice: string) => { const next = multi ? (selected.includes(choice) ? selected.filter((item) => item !== choice) : [...selected, choice]) : [choice]; const ordered = choices.filter((item) => next.includes(item)); onChoose(multi ? JSON.stringify(ordered) : choice); };
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Fact family board">
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Fact-family workshop</p>
    <p className="mt-2 text-center text-sm text-white/80">Keep the model visible and choose the related fact or facts. Correct selections stay when you revise.</p>
    {groups > 0 && groupSize > 0 && total > 0 && <div className="mt-4 flex flex-wrap justify-center gap-2"><span className="rounded-xl bg-[#fff7df] px-3 py-2 font-bold text-ink">{groups} groups</span><span className="rounded-xl bg-[#fff7df] px-3 py-2 font-bold text-ink">{groupSize} in each</span><span className="rounded-xl bg-sun px-3 py-2 font-bold text-ink">Total {total}</span></div>}
    {parts.length === 2 && Number.isFinite(Number(question.body.whole)) && <div className="mt-4 flex flex-wrap justify-center gap-2"><span className="rounded-xl bg-[#fff7df] px-3 py-2 font-bold text-ink">Part {parts[0]}</span><span className="rounded-xl bg-[#fff7df] px-3 py-2 font-bold text-ink">Part {parts[1]}</span><span className="rounded-xl bg-sun px-3 py-2 font-bold text-ink">Whole {String(question.body.whole)}</span></div>}
    {multi && <p className="mt-3 text-center text-xs text-white/70">Select {selectCount} related facts, then send the family together.</p>}
    <div className="mt-4 grid gap-2" role="group" aria-label="Fact family choices">{choices.map((choice, index) => <button key={choice} type="button" onClick={() => publish(choice)} aria-pressed={selected.includes(choice)} className={`min-h-14 rounded-xl border-2 p-3 text-left text-sm font-semibold ${selected.includes(choice) ? 'border-sun bg-[#fff7df] text-ink' : 'border-white/15 bg-white/5 text-white'}`}><span className="font-display mr-2 text-xs opacity-70">Fact {index + 1}</span>{choice}</button>)}</div>
    <button type="button" onClick={onSubmit} disabled={!selected.length || (multi && selected.length !== selectCount)} className="btn-pop mt-4 min-h-14 w-full bg-sun px-4 py-3 text-lg text-ink disabled:opacity-50" aria-label="Submit fact family">Send answer</button>
  </section>;
}

function CircuitEvidenceBoard({ question, input, onChoose, onSubmit }: { question: StudioQuestion; input: string; onChoose: (value: string) => void; onSubmit: () => void }) {
  const format = question.format.toLowerCase();
  if (!['component-output-table', 'symbol-diagram-build'].includes(format)) return null;
  const choices = asStringArray(question.body.choices);
  if (choices.length < 2) return null;
  const table = Array.isArray(question.body.table) ? question.body.table.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row)) : [];
  const component = typeof question.body.component === 'string' ? question.body.component : '';
  const diagramTask = typeof question.body.diagram_task === 'string' ? question.body.diagram_task : '';
  const claim = typeof question.body.claim === 'string' ? question.body.claim : '';
  const title = format === 'symbol-diagram-build' ? 'Circuit symbol scanner' : 'Circuit evidence table';
  const instruction = format === 'symbol-diagram-build' ? 'Recognised symbols are agreed simple marks. Match the component, then place the choice in the safe one-loop diagram.' : 'Read the row headings before you decide. Change one variable at a time and use the output as evidence.';
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-[#8ee9ef]/30 bg-[#071a35]/70 p-5" aria-label={title}>
    <div className="flex items-center justify-between gap-3"><p className="font-display text-xs uppercase tracking-[0.14em] text-[#8ee9ef]">{title}</p><span className="rounded-full bg-[#55cbd3]/15 px-3 py-1 text-xs font-semibold text-[#c8fbff]">Evidence patch {input ? 'ready' : 'open'}</span></div>
    <p className="mt-2 text-center text-sm text-white/80">{instruction}</p>
    {component && <p className="mt-4 rounded-2xl bg-[#fff7df] p-4 text-center text-lg font-semibold text-ink">Component: {component}</p>}
    {diagramTask && <p className="mt-3 rounded-2xl border border-[#8ee9ef]/30 bg-white/8 p-3 text-sm leading-6 text-white">{diagramTask}</p>}
    {claim && <p className="mt-3 rounded-2xl bg-[#fff7df] p-4 text-sm leading-6 text-ink"><span className="font-display text-xs uppercase">Claim to test</span><br />{claim}</p>}
    {table.length > 0 && <div className="mt-4 overflow-x-auto rounded-2xl bg-[#fff7df] p-3"><table className="w-full min-w-[28rem] text-left text-sm text-ink"><caption className="mb-2 text-left font-display text-xs uppercase">Observed circuit outputs</caption><thead><tr>{Object.keys(table[0]).map((key) => <th key={key} scope="col" className="border-b border-ink/15 px-2 py-2 font-display text-xs uppercase">{key.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{table.map((row, index) => <tr key={index}>{Object.keys(table[0]).map((key) => <td key={key} className="border-b border-ink/10 px-2 py-2 align-top">{String(row[key] ?? '')}</td>)}</tr>)}</tbody></table></div>}
    <div className="mt-4 grid gap-3" role="group" aria-label="Circuit answer choices">{choices.map((choice, index) => <button key={choice} type="button" onClick={() => onChoose(choice)} aria-pressed={input === choice} className={`min-h-16 rounded-2xl border-2 p-4 text-left text-sm font-semibold ${input === choice ? 'border-sun bg-[#fff7df] text-ink ring-2 ring-sun' : 'border-white/15 bg-white/5 text-white'}`}><span className="mr-2 font-display text-xs opacity-70">{index + 1}.</span>{choice}</button>)}</div>
    <p className="mt-4 text-center text-xs text-white/65">Keyboard, switch scanning, touch and partner/AAC selection use the same numbered route. Simulator-only, low-voltage learning is allowed; mains electricity is never required.</p>
    <button type="button" onClick={onSubmit} disabled={!input} className="btn-pop mt-4 min-h-14 w-full bg-sun px-4 py-3 text-lg text-ink disabled:opacity-50" aria-label="Submit circuit answer">Send evidence</button>
  </section>;
}

function EvolutionEvidenceBoard({ question, input, onChoose, onSubmit }: { question: StudioQuestion; input: string; onChoose: (value: string) => void; onSubmit: () => void }) {
  const format = question.format.toLowerCase();
  if (!['inheritance-sort', 'population-simulation', 'fossil-evidence'].includes(format)) return null;
  const choices = asStringArray(question.body.choices);
  if (choices.length < 2) return null;
  const evidence = Array.isArray(question.body.evidence)
    ? question.body.evidence.filter((item): item is string => typeof item === 'string')
    : typeof question.body.evidence === 'string' ? [question.body.evidence] : [];
  const environment = typeof question.body.environment === 'string' ? question.body.environment : '';
  const generations = Number(question.body.generations);
  const startingCounts = question.body.starting_counts && typeof question.body.starting_counts === 'object' && !Array.isArray(question.body.starting_counts)
    ? question.body.starting_counts as Record<string, unknown>
    : {};
  const title = format === 'inheritance-sort' ? 'Inheritance evidence sorter' : format === 'population-simulation' ? 'Population generations lab' : 'Fossil evidence desk';
  const instruction = format === 'inheritance-sort'
    ? 'Separate what the evidence supports from what it cannot prove. Shared features do not make offspring exact copies.'
    : format === 'population-simulation'
      ? 'Predict first, inspect the population snapshot, then connect inherited variation with change across generations.'
      : 'Read the layer order and evidence cards. Make the strongest supported claim without filling gaps with guesses.';
  const badge = format === 'population-simulation' ? 'Generation log' : 'Evidence patch';
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-[#9ee6a8]/30 bg-[#071a35]/70 p-5" aria-label={title}>
    <div className="flex items-center justify-between gap-3"><p className="font-display text-xs uppercase tracking-[0.14em] text-[#b7f5bd]">{title}</p><span className="rounded-full bg-[#9ee6a8]/15 px-3 py-1 text-xs font-semibold text-[#d7ffda]">{badge} {input ? 'ready' : 'open'}</span></div>
    <p className="mt-2 text-center text-sm text-white/80">{instruction}</p>
    {(environment || Number.isFinite(generations)) && <div className="mt-4 flex flex-wrap justify-center gap-2">{environment && <span className="rounded-xl bg-[#fff7df] px-3 py-2 text-sm font-bold capitalize text-ink">Environment: {environment}</span>}{Number.isFinite(generations) && <span className="rounded-xl bg-[#fff7df] px-3 py-2 text-sm font-bold text-ink">Generations: {generations}</span>}</div>}
    {evidence.length > 0 && <div className="mt-4 grid gap-2" aria-label="Evidence cards">{evidence.map((item, index) => <div key={`${item}-${index}`} className="rounded-2xl bg-[#fff7df] p-3 text-sm leading-6 text-ink"><span className="mr-2 font-display text-xs uppercase">Evidence {index + 1}</span>{item}</div>)}</div>}
    {Object.keys(startingCounts).length > 0 && <div className="mt-4 overflow-x-auto rounded-2xl bg-[#fff7df] p-3"><table className="w-full min-w-[18rem] text-left text-sm text-ink"><caption className="mb-2 text-left font-display text-xs uppercase">Starting population snapshot</caption><thead><tr><th scope="col" className="border-b border-ink/15 px-2 py-2">Trait pattern</th><th scope="col" className="border-b border-ink/15 px-2 py-2 text-right">Count</th></tr></thead><tbody>{Object.entries(startingCounts).map(([label, count]) => <tr key={label}><th scope="row" className="border-b border-ink/10 px-2 py-2 font-semibold">{label.replaceAll('_', ' ')}</th><td className="border-b border-ink/10 px-2 py-2 text-right font-mono">{String(count)}</td></tr>)}</tbody></table></div>}
    <div className="mt-4 grid gap-3" role="group" aria-label="Evolution evidence choices">{choices.map((choice, index) => <button key={choice} type="button" onClick={() => onChoose(choice)} aria-pressed={input === choice} className={`min-h-16 rounded-2xl border-2 p-4 text-left text-sm font-semibold ${input === choice ? 'border-sun bg-[#fff7df] text-ink ring-2 ring-sun' : 'border-white/15 bg-white/5 text-white'}`}><span className="mr-2 font-display text-xs opacity-70">{index + 1}.</span>{choice}</button>)}</div>
    <p className="mt-4 text-center text-xs text-white/65">Numbered selection works with touch, keyboard, switch scanning, eye gaze, AAC or partner pointing. Motion can be reduced to still evidence cards; speed never earns the mark.</p>
    <button type="button" onClick={onSubmit} disabled={!input} className="btn-pop mt-4 min-h-14 w-full bg-sun px-4 py-3 text-lg text-ink disabled:opacity-50" aria-label="Submit evolution evidence">Send evidence</button>
  </section>;
}

function CellLabelBoard({ question, input, onChoose, onSubmit }: { question: StudioQuestion; input: string; onChoose: (value: string) => void; onSubmit: () => void }) {
  if (question.format.toLowerCase() !== 'cell-label') return null;
  const features = asStringArray(question.body.model_features);
  const labels = asStringArray(question.body.labels);
  if (features.length < 2 || labels.length < 2) return null;
  const cellType = typeof question.body.cell_type === 'string' ? question.body.cell_type : 'cell model';
  let assignments: Record<string, string> = {};
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) parsed.forEach((item) => { if (typeof item !== 'string') return; const separator = item.lastIndexOf(': '); if (separator > 0) assignments[item.slice(0, separator)] = item.slice(separator + 2); });
  } catch { /* start with an empty atlas */ }
  const assign = (feature: string, label: string) => { const next = { ...assignments, [feature]: label }; onChoose(JSON.stringify(features.map((item) => `${item}: ${next[item] ?? ''}`))); };
  const complete = features.every((feature) => typeof assignments[feature] === 'string' && assignments[feature].length > 0);
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-[#c6b4ff]/35 bg-[#11153a]/80 p-5" aria-label="Cell label atlas">
    <div className="flex items-center justify-between gap-3"><p className="font-display text-xs uppercase tracking-[0.14em] text-[#d8ccff]">Cell label atlas</p><span className="rounded-full bg-[#c6b4ff]/15 px-3 py-1 text-xs font-semibold text-[#eee9ff]">Model mission {complete ? 'ready' : 'open'}</span></div>
    <p className="mt-2 text-center text-sm text-white/80">Match each structure to its label using shape, position and function; colour is optional.</p>
    <div className="mt-4 flex justify-center"><span className="rounded-xl bg-[#fff7df] px-3 py-2 text-sm font-bold capitalize text-ink">{cellType}</span></div>
    <div className="mt-4 grid gap-3">{features.map((feature, index) => <label key={feature} className="rounded-2xl bg-[#fff7df] p-4 text-sm font-semibold text-ink"><span className="mr-2 font-display text-xs uppercase">Feature {index + 1}</span>{feature}<select value={assignments[feature] ?? ''} onChange={(event) => assign(feature, event.target.value)} className="mt-3 min-h-12 w-full rounded-xl border border-ink/15 bg-white px-3 text-ink"><option value="">Choose a label</option>{labels.map((label) => <option key={label} value={label}>{label}</option>)}</select></label>)}</div>
    <p className="mt-4 text-center text-xs text-white/65">Touch, keyboard, switch, eye gaze, AAC and partner routes work; dragging is optional.</p>
    <button type="button" onClick={onSubmit} disabled={!complete} className="btn-pop mt-4 min-h-14 w-full bg-sun px-4 py-3 text-lg text-ink disabled:opacity-50" aria-label="Submit cell labels">Send atlas</button>
  </section>;
}

function ForceModelBoard({ question, input, onChoose, onSubmit }: { question: StudioQuestion; input: string; onChoose: (value: string) => void; onSubmit: () => void }) {
  const format = question.format.toLowerCase();
  if (!['force-simulator', 'mechanism-model'].includes(format)) return null;
  const choices = asStringArray(question.body.choices);
  if (choices.length < 2) return null;
  const model = question.body.force_model && typeof question.body.force_model === 'object' && !Array.isArray(question.body.force_model) ? question.body.force_model as Record<string, unknown> : {};
  const modelName = typeof model.model === 'string' ? model.model : typeof question.body.model === 'string' ? question.body.model : 'force model';
  const changed = typeof question.body.changed === 'string' ? question.body.changed : typeof question.body.change === 'string' ? question.body.change : '';
  const plan = question.body.investigation_plan && typeof question.body.investigation_plan === 'object' && !Array.isArray(question.body.investigation_plan) ? question.body.investigation_plan as Record<string, unknown> : {};
  const safety = typeof question.body.safety_context === 'string' ? question.body.safety_context : '';
  const title = format === 'mechanism-model' ? 'Mechanism input-output lab' : 'Force model lab';
  const instruction = format === 'mechanism-model' ? 'Change one feature, predict, then explain input and output.' : 'Choose one fair change, inspect the frames, and stay within the tested range.';
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-[#ffb36b]/35 bg-[#24192a]/80 p-5" aria-label={title}>
    <div className="flex items-center justify-between gap-3"><p className="font-display text-xs uppercase tracking-[0.14em] text-[#ffd19e]">{title}</p><span className="rounded-full bg-[#ffb36b]/15 px-3 py-1 text-xs font-semibold text-[#ffe5c3]">Model log {input ? 'ready' : 'open'}</span></div>
    <p className="mt-2 text-center text-sm text-white/80">{instruction}</p>
    <div className="mt-4 grid gap-2 sm:grid-cols-2"><div className="rounded-2xl bg-[#fff7df] p-3 text-sm text-ink"><span className="font-display text-xs uppercase">Model</span><p className="mt-1 font-semibold capitalize">{String(modelName).replaceAll('_', ' ')}</p></div>{changed && <div className="rounded-2xl bg-[#fff7df] p-3 text-sm text-ink"><span className="font-display text-xs uppercase">Changed variable</span><p className="mt-1 font-semibold">{changed}</p></div>}</div>
    {(typeof plan.measure === 'string' || typeof plan.keep_same === 'string') && <div className="mt-4 rounded-2xl border border-[#ffb36b]/25 bg-white/8 p-4 text-sm text-white"><p className="font-display text-xs uppercase text-[#ffd19e]">Fair-test frame</p>{typeof plan.measure === 'string' && <p className="mt-2"><span className="font-semibold">Measure:</span> {plan.measure}</p>}{typeof plan.keep_same === 'string' && <p className="mt-1"><span className="font-semibold">Keep the same:</span> {plan.keep_same}</p>}</div>}
    <div className="mt-4 grid gap-3" role="group" aria-label="Force model choices">{choices.map((choice, index) => <button key={choice} type="button" onClick={() => onChoose(choice)} aria-pressed={input === choice} className={`min-h-16 rounded-2xl border-2 p-4 text-left text-sm font-semibold ${input === choice ? 'border-sun bg-[#fff7df] text-ink ring-2 ring-sun' : 'border-white/15 bg-white/5 text-white'}`}><span className="mr-2 font-display text-xs opacity-70">{index + 1}.</span>{choice}</button>)}</div>
    {safety && <p className="mt-4 rounded-2xl bg-[#fff7df] p-3 text-xs leading-5 text-ink">Safe route: {safety.replaceAll('_', ' ')}</p>}
    <p className="mt-4 text-center text-xs text-white/65">Pause, replay or use still frames. Accessible routes share one path; no speed score.</p>
    <button type="button" onClick={onSubmit} disabled={!input} className="btn-pop mt-4 min-h-14 w-full bg-sun px-4 py-3 text-lg text-ink disabled:opacity-50" aria-label="Submit force model answer">Send model evidence</button>
  </section>;
}

function StructuredChoiceBoard({ question, input, onChoose, onSubmit }: { question: StudioQuestion; input: string; onChoose: (value: string) => void; onSubmit: () => void }) {
  const format = question.format.toLowerCase();
  if (!['balance-equation', 'weather-sort', 'scale-read', 'fraction-bar-match'].includes(format)) return null;
  const choices = asStringArray(question.body.choices);
  if (choices.length < 2) return null;
  const knownFact = typeof question.body.known_fact === 'string' ? question.body.known_fact : '';
  const scale = question.body.scale && typeof question.body.scale === 'object' ? question.body.scale as Record<string, unknown> : null;
  const target = typeof question.body.target === 'string' ? question.body.target : '';
  const title = format === 'balance-equation' ? 'Balance and transfer' : format === 'weather-sort' ? 'Seasonal evidence desk' : format === 'fraction-bar-match' ? 'Equivalent fraction bar' : 'Scale-reading station';
  const instruction = format === 'balance-equation' ? 'Use the known fact to keep the relationship balanced. The number can change, but the structure stays visible.' : format === 'weather-sort' ? 'Use careful scientific language. One observation does not define every day in a season.' : format === 'fraction-bar-match' ? 'Compare equal wholes, then choose the fraction that names the same amount.' : 'Read the labelled start and end marks, then keep the unit with the measurement.';
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label={title}>
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">{title}</p><p className="mt-2 text-center text-sm text-white/80">{instruction}</p>
    {knownFact && <p className="mt-4 rounded-2xl bg-[#fff7df] p-4 text-center font-mono text-lg text-ink">Known fact: {knownFact}</p>}
    {target && <p className="mt-4 rounded-2xl bg-[#fff7df] p-4 text-center font-mono text-lg text-ink">Target fraction: {target}</p>}
    {scale && <div className="mt-4 rounded-2xl bg-[#fff7df] p-4 text-center text-ink"><span className="font-display text-xs uppercase">{String(scale.tool ?? 'Scale')}</span><div className="mt-3 flex items-center justify-between font-bold"><span>Start {String(scale.start_mark ?? '')} {String(scale.unit ?? '')}</span><span className="text-sun">→</span><span>End {String(scale.end_mark ?? '')} {String(scale.unit ?? '')}</span></div><div className="mt-3 flex gap-1">{Array.from({ length: Math.min(13, Math.max(2, Number(scale.end_mark ?? 0) - Number(scale.start_mark ?? 0) + 1)) }, (_, index) => <span key={index} className="h-5 flex-1 rounded-sm bg-lagoon" />)}</div></div>}
    <div className="mt-4 grid gap-2" role="group" aria-label="Structured choices">{choices.map((choice, index) => <button key={choice} type="button" onClick={() => onChoose(choice)} aria-pressed={input === choice} className={`min-h-14 rounded-xl border-2 p-3 text-left text-sm font-semibold ${input === choice ? 'border-sun bg-[#fff7df] text-ink' : 'border-white/15 bg-white/5 text-white'}`}><span className="font-display mr-2 text-xs opacity-70">Option {String.fromCharCode(65 + index)}</span>{choice}</button>)}</div>
    <button type="button" onClick={onSubmit} disabled={!input} className="btn-pop mt-4 min-h-14 w-full bg-sun px-4 py-3 text-lg text-ink disabled:opacity-50" aria-label="Submit structured answer">Send answer</button>
  </section>;
}

function FractionWallBoard({ question, input, onChoose, onSubmit }: { question: StudioQuestion; input: string; onChoose: (value: string) => void; onSubmit: () => void }) {
  if (question.format.toLowerCase() !== 'fraction-wall') return null;
  const parts = Number(question.body.parts); const target = Number(question.body.target_shaded);
  if (!Number.isInteger(parts) || parts < 2 || parts > 20 || !Number.isInteger(target)) return null;
  let shaded = 0;
  try { const parsed = JSON.parse(input); if (parsed && typeof parsed === 'object') shaded = Number((parsed as Record<string, unknown>).shaded) || 0; } catch { /* start at zero */ }
  const select = (value: number) => onChoose(JSON.stringify({ shaded: value, parts }));
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Fraction wall board">
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Fraction wall</p>
    <p className="mt-2 text-center text-sm text-white/80">The whole stays divided into equal parts. Select the number of parts to shade; precise dragging is not required.</p>
    <div className="mt-4 flex gap-1 rounded-2xl bg-[#fff7df] p-3" role="img" aria-label={`${shaded} of ${parts} equal parts selected`}>{Array.from({ length: parts }, (_, index) => <span key={index} className={`h-12 flex-1 rounded-md border-2 border-ink/20 ${index < shaded ? 'bg-sun' : 'bg-white'}`} />)}</div>
    <p className="mt-3 text-center font-mono text-lg text-white">{shaded}/{parts} of the whole</p>
    <div className="mt-4 grid grid-cols-5 gap-2" role="group" aria-label="Number of shaded parts">{Array.from({ length: parts + 1 }, (_, value) => <button key={value} type="button" onClick={() => select(value)} aria-pressed={shaded === value} className={`min-h-11 rounded-xl border-2 text-sm font-semibold ${shaded === value ? 'border-sun bg-[#fff7df] text-ink' : 'border-white/15 bg-white/5 text-white'}`}>{value}</button>)}</div>
    <button type="button" onClick={onSubmit} disabled={shaded < 0} className="btn-pop mt-4 min-h-14 w-full bg-sun px-4 py-3 text-lg text-ink" aria-label="Submit fraction wall answer">Send answer</button>
  </section>;
}

function RatioScaleBoard({ question, input, onChoose, onSubmit }: { question: StudioQuestion; input: string; onChoose: (value: string) => void; onSubmit: () => void }) {
  if (question.format.toLowerCase() !== 'scale-build') return null;
  const ratio = Array.isArray(question.body.ratio) ? question.body.ratio.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)) : [];
  const factor = Number(question.body.scale_factor);
  if (ratio.length !== 2 || !Number.isFinite(factor)) return null;
  let selected: number[] = [];
  try { const parsed = JSON.parse(input); if (Array.isArray(parsed)) selected = parsed.map(Number); } catch { /* start empty */ }
  const values = ratio.map((value) => value * factor);
  const choose = (index: number, value: string) => { const next = [...(selected.length === 2 ? selected : ratio)]; next[index] = Number(value); onChoose(JSON.stringify(next)); };
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Ratio scale board">
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Ratio scaling lab</p>
    <p className="mt-2 text-center text-sm text-white/80">Multiply both parts by the same factor. The ratio relationship stays visible while you check each output.</p>
    <div className="mt-4 flex items-center justify-center gap-2"><span className="rounded-xl bg-[#fff7df] px-4 py-3 font-bold text-ink">{ratio[0]} : {ratio[1]}</span><span className="font-display text-sun">× {factor}</span><span className="rounded-xl bg-[#fff7df] px-4 py-3 font-bold text-ink">? : ?</span></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{ratio.map((value, index) => <label key={value} className="rounded-xl bg-white/10 p-3 text-sm font-semibold text-white">Part {value}<select value={selected[index] ?? ''} onChange={(event) => choose(index, event.target.value)} className="mt-2 min-h-11 w-full rounded-lg bg-[#fff7df] px-2 text-ink"><option value="">Choose output</option>{[values[index], values[index] + factor, values[index] - factor, ratio[index]].map((choice) => <option key={choice} value={choice}>{choice}</option>)}</select></label>)}</div>
    <button type="button" onClick={onSubmit} disabled={selected.length !== 2 || selected.some((value) => !Number.isFinite(value))} className="btn-pop mt-4 min-h-14 w-full bg-sun px-4 py-3 text-lg text-ink disabled:opacity-50" aria-label="Submit ratio scale answer">Send answer</button>
  </section>;
}

function PatternSortBoard({ question, input, onChoose, onSubmit }: { question: StudioQuestion; input: string; onChoose: (value: string) => void; onSubmit: () => void }) {
  if (question.format.toLowerCase() !== 'pattern-sort') return null;
  const words = asStringArray(question.body.words);
  const columns = asStringArray(question.body.pattern_columns);
  if (words.length < 2 || columns.length < 2) return null;
  let assignments: Record<string, string> = {};
  try { const parsed = JSON.parse(input); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) assignments = parsed as Record<string, string>; } catch { /* start empty */ }
  const assign = (word: string, pattern: string) => onChoose(JSON.stringify({ ...assignments, [word]: pattern }));
  const complete = words.every((word) => typeof assignments[word] === 'string');
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Spelling pattern sorter">
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Spelling pattern sorter</p>
    <p className="mt-2 text-center text-sm text-white/80">Hear or read each whole word, then place it under the letters that spell the target sound. Tap or use the keyboard; dragging is optional.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{words.map((word) => <label key={word} className="rounded-xl bg-[#fff7df] p-3 text-sm font-semibold text-ink">{word}<select value={assignments[word] ?? ''} onChange={(event) => assign(word, event.target.value)} className="mt-2 min-h-11 w-full rounded-lg bg-white px-2 text-ink"><option value="">Choose letters</option>{columns.map((column) => <option key={column} value={column}>{column}</option>)}</select></label>)}</div>
    <p className="mt-3 text-center text-xs text-white/70">{complete ? 'Every word has a labelled pattern. Check the sound before you send.' : 'Choose a pattern for each word; your correct placements stay visible.'}</p>
    <button type="button" onClick={onSubmit} disabled={!complete} className="btn-pop mt-4 min-h-14 w-full bg-sun px-4 py-3 text-lg text-ink disabled:opacity-50" aria-label="Submit spelling pattern sort">Send answer</button>
  </section>;
}

function ParagraphRelationshipCard({ question }: { question: StudioQuestion }) {
  if (question.format.toLowerCase() !== 'paragraph-order') return null;
  const relationship = typeof question.body.relationship === 'string' ? question.body.relationship : '';
  if (!relationship) return null;
  return <aside className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5 text-center" aria-label="Paragraph relationship clue"><p className="font-display text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Cohesion clue</p><p className="mt-3 rounded-xl bg-[#fff7df] p-3 font-semibold capitalize text-ink">Relationship: {relationship}</p><p className="mt-3 text-sm text-white/80">Choose the signpost that tells the reader how this paragraph connects to the last one.</p></aside>;
}

function ClaimEvidenceTray({ question }: { question: StudioQuestion }) {
  if (question.format.toLowerCase() !== 'claim-evidence-explain') return null;
  const observations = asStringArray(question.body.observations);
  if (!observations.length) return null;
  return <aside className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Scientific evidence tray"><p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Evidence tray</p><ul className="mt-4 grid gap-2">{observations.map((observation, index) => <li key={observation} className="rounded-xl bg-[#fff7df] p-3 text-ink"><span className="mr-2 font-display text-xs">Observation {index + 1}</span>{observation}</li>)}</ul><p className="mt-3 text-center text-sm text-white/80">Choose the claim the observations support—be careful not to claim more than the evidence shows.</p></aside>;
}

function TimelineJumpStrip({ question }: { question: StudioQuestion }) {
  if (question.format.toLowerCase() !== 'time-line') return null;
  const start = typeof question.body.start_time === 'string' ? question.body.start_time : '';
  const duration = Number(question.body.duration_minutes);
  const jumps = asStringArray(question.body.suggested_jumps);
  if (!start || !Number.isFinite(duration)) return null;
  return <aside className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Time jump strip"><p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Time path</p><div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-ink"><span className="rounded-xl bg-[#fff7df] px-3 py-2 font-bold">Start {start}</span>{jumps.map((jump, index) => <span key={`${jump}-${index}`} className="rounded-xl bg-sun px-3 py-2 font-semibold">+ {jump} min</span>)}<span className="rounded-xl bg-[#fff7df] px-3 py-2 font-bold">Total {duration} min</span></div><p className="mt-3 text-center text-sm text-white/80">Move along the path in calm steps, then choose the finishing time.</p></aside>;
}

function CohesionContextCard({ question }: { question: StudioQuestion }) {
  if (question.format.toLowerCase() !== 'cohesion-edit') return null;
  const meaning = typeof question.body.intended_meaning === 'string' ? question.body.intended_meaning : '';
  const referent = typeof question.body.intended_referent === 'string' ? question.body.intended_referent : '';
  const original = typeof question.body.original === 'string' ? question.body.original : '';
  const context = meaning || referent || (original ? `Repair this original: ${original}` : 'Keep the intended meaning clear.');
  return <aside className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Cohesion repair context"><p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Clarity desk</p><p className="mt-3 rounded-xl bg-[#fff7df] p-4 text-center text-sm font-semibold text-ink">{context}</p><p className="mt-3 text-center text-sm text-white/80">Choose the edit that keeps this meaning clear for the reader.</p></aside>;
}

function ModelComparisonBoard({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  if (question.format.toLowerCase() !== 'compare-model') return null;
  const evidence = asStringArray(question.body.evidence);
  const choices = asStringArray(question.body.choices);
  const structures = asStringArray(question.body.structures);
  const categories = asStringArray(question.body.categories);
  if (structures.length && categories.length) {
    let saved: string[] = [];
    try { const value = JSON.parse(input); if (Array.isArray(value)) saved = value; } catch { /* start fresh */ }
    const assigned = new Map<string, string>(); saved.forEach((item) => { const match = item.match(/^([^:]+): (.+)$/); if (match) match[2].split(', ').forEach((structure) => assigned.set(structure, match[1])); });
    const publish = (structure: string, category: string) => { const next = new Map(assigned); next.set(structure, category); const result = categories.map((group) => `${group}: ${structures.filter((item) => next.get(item) === group).join(', ')}`).filter((item) => !item.endsWith(': ')); onChoose(JSON.stringify(result)); };
    return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Cell model comparison board"><p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Model comparison lab</p><p className="mt-2 text-center text-sm text-white/80">Sort each structure using evidence from the two models. Patterns and labels carry the meaning, not colour.</p><div className="mt-4 grid gap-2">{structures.map((structure) => <label key={structure} className="rounded-xl bg-[#fff7df] p-3 text-sm text-ink">{structure}<select value={assigned.get(structure) ?? ''} onChange={(event) => publish(structure, event.target.value)} className="mt-2 min-h-11 w-full rounded-lg bg-white px-2 text-ink"><option value="">Choose a category</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>)}</div></section>;
  }
  if (choices.length < 2) return null;
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Model comparison evidence"><p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Comparison lab</p>{evidence.length > 0 && <ul className="mt-4 grid gap-2">{evidence.map((item, index) => <li key={item} className="rounded-xl bg-[#fff7df] p-3 text-sm text-ink"><span className="font-display mr-2 text-xs">Evidence {index + 1}</span>{item}</li>)}</ul>}<p className="mt-3 text-center text-sm text-white/80">Compare the models, then choose the claim supported by all the evidence.</p><div className="mt-4 grid gap-2">{choices.map((choice) => <button key={choice} type="button" onClick={() => onChoose(choice)} aria-pressed={input === choice} className={`rounded-xl border-2 p-3 text-left text-sm ${input === choice ? 'border-sun bg-[#fff7df] text-ink' : 'border-white/15 bg-white/5 text-white'}`}>{choice}</button>)}</div></section>;
}

function ColumnCalculationBoard({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  if (question.format.toLowerCase() !== 'column-calculate') return null;
  const operands = Array.isArray(question.body.operands) ? question.body.operands.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)) : [];
  const operation = typeof question.body.operation === 'string' ? question.body.operation : 'calculation';
  if (operands.length !== 2) return null;
  const digits = (value: number) => String(Math.abs(value)).padStart(4, '0').split('');
  const columns = ['Thousands', 'Hundreds', 'Tens', 'Ones'];
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Column calculation workspace"><p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Place-value workshop</p><p className="mt-2 text-center text-sm text-white/80">Line up the place values, calculate one column at a time, and record the final answer.</p><div className="mt-4 overflow-x-auto rounded-2xl bg-[#fff7df] p-4"><table className="w-full min-w-[390px] text-right text-ink"><thead><tr>{columns.map((column) => <th key={column} className="p-2 text-xs font-semibold">{column}</th>)}</tr></thead><tbody>{operands.map((operand, row) => <tr key={operand}><th className="p-2 text-left text-xs">{row === 0 ? 'First' : 'Second'}</th>{digits(operand).map((digit, index) => <td key={`${operand}-${index}`} className="p-2 text-2xl font-bold">{digit}</td>)}</tr>)}<tr><th className="p-2 text-left text-xs">{operation}</th>{columns.map((column) => <td key={column} className="border-t-2 border-ink/20 p-2">—</td>)}</tr></tbody></table></div><label className="mt-4 block text-sm font-semibold text-white">Final answer<input type="number" inputMode="numeric" value={input} onChange={(event) => onChoose(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl bg-[#fff7df] px-3 text-lg text-ink" /></label></section>;
}

function OperationModelBoard({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  if (question.format.toLowerCase() !== 'operation-model') return null;
  const start = Number(question.body.start); const end = Number(question.body.end); const expression = typeof question.body.expression === 'string' ? question.body.expression : '';
  const equivalentChoices = asStringArray(question.body.equivalent_choices);
  if (!Number.isFinite(start) || (!Number.isFinite(end) && !expression)) return null;
  const low = Math.min(start, Number.isFinite(end) ? end : start + 6) - 2; const high = Math.max(start, Number.isFinite(end) ? end : start + 6) + 2;
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Number line operation model"><p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Number-line lab</p>{expression && <p className="mt-3 rounded-xl bg-[#fff7df] p-3 text-center font-mono text-xl text-ink">{expression}</p>}<p className="mt-3 text-center text-sm text-white/80">Start at the marked number, show the movement, then record the result.</p><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">{Array.from({ length: high - low + 1 }, (_, index) => low + index).map((value) => <span key={value} className={`rounded-lg p-2 text-center text-sm font-bold ${value === start || value === end ? 'bg-sun text-ink ring-2 ring-leaf' : 'bg-[#fff7df] text-ink'}`}>{value}</span>)}</div>{equivalentChoices.length > 0 && <div className="mt-4 grid gap-2"><p className="text-sm font-semibold text-white">Equivalent addition or subtraction</p>{equivalentChoices.map((choice) => <button key={choice} type="button" onClick={() => onChoose(input)} className="min-h-11 rounded-xl bg-white/10 px-3 text-left text-sm text-white">{choice}</button>)}</div>}<label className="mt-4 block text-sm font-semibold text-white">Result<input type="number" value={input} onChange={(event) => onChoose(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl bg-[#fff7df] px-3 text-lg text-ink" /></label></section>;
}

function ProblemMapBoard({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  if (question.format.toLowerCase() !== 'problem-map') return null;
  const cards = asStringArray(question.body.quantity_cards); const plan = asStringArray(question.body.plan); const target = typeof question.body.question_target === 'string' ? question.body.question_target : '';
  if (!cards.length) return null;
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Multi-step problem map"><p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Problem map</p><p className="mt-2 text-center text-sm text-white/80">Label the quantities, find the intermediate amount, then check the final target. Correct steps stay visible.</p><div className="mt-4 flex flex-wrap justify-center gap-2">{cards.map((card) => <span key={card} className={`rounded-xl px-3 py-2 text-sm font-semibold ${card === target ? 'bg-sun text-ink ring-2 ring-leaf' : 'bg-[#fff7df] text-ink'}`}>{card}</span>)}</div>{plan.length > 0 && <ol className="mt-4 grid gap-2">{plan.map((step, index) => <li key={step} className="rounded-xl bg-white/10 p-3 text-sm text-white"><span className="font-display mr-2 text-xs text-sun">Step {index + 1}</span>{step}</li>)}</ol>}<label className="mt-4 block text-sm font-semibold text-white">Final answer<input type="number" value={input} onChange={(event) => onChoose(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl bg-[#fff7df] px-3 text-lg text-ink" /></label></section>;
}

function HealthyChoiceBoard({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  if (question.format.toLowerCase() !== 'healthy-choice-explain') return null;
  const rawChoices = Array.isArray(question.body.choices) ? question.body.choices : [];
  const scalarChoices = rawChoices.filter((choice): choice is string | number => typeof choice === 'string' || typeof choice === 'number').map(String);
  const plateChoices = rawChoices.filter((choice): choice is Array<string | number> => Array.isArray(choice) && choice.every((item) => typeof item === 'string' || typeof item === 'number')).map((choice) => choice.map(String));
  const inclusiveNote = typeof question.body.inclusive_note === 'string' ? question.body.inclusive_note : '';
  if (scalarChoices.length < 2 && plateChoices.length < 2) return null;
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Healthy choice board"><p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Body-care explorer</p>{inclusiveNote && <p className="mt-3 rounded-xl bg-[#fff7df] p-3 text-center text-sm text-ink">{inclusiveNote}</p>}<p className="mt-3 text-center text-sm text-white/80">Choose the option that best supports the body, using evidence and variety.</p>{scalarChoices.length >= 2 && <div className="mt-4 grid gap-2">{scalarChoices.map((choice) => <button key={choice} type="button" onClick={() => onChoose(choice)} aria-pressed={input === choice} className={`min-h-12 rounded-xl border-2 p-3 text-left font-semibold ${input === choice ? 'border-sun bg-[#fff7df] text-ink' : 'border-white/15 bg-white/5 text-white'}`}>{choice}</button>)}</div>}{plateChoices.length >= 2 && <div className="mt-4 grid gap-3">{plateChoices.map((plate) => { const value = JSON.stringify(plate); return <button key={value} type="button" onClick={() => onChoose(value)} aria-pressed={input === value} className={`rounded-2xl border-2 p-4 text-left ${input === value ? 'border-sun bg-[#fff7df] text-ink' : 'border-white/15 bg-white/5 text-white'}`}><span className="font-display text-xs opacity-70">Plate option</span><span className="mt-2 flex flex-wrap gap-2">{plate.map((food, index) => <span key={`${food}-${index}`} className="rounded-lg bg-white/20 px-2 py-1 text-sm">{food}</span>)}</span></button>;})}</div>}</section>;
}

function RoleAssignmentBoard({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  const format = question.format.toLowerCase();
  if (!['variable-sort', 'argument-map'].includes(format)) return null;
  const cards = asStringArray(question.body.cards).length ? asStringArray(question.body.cards) : asStringArray(question.body.sentences);
  const categories = asStringArray(question.body.categories).length ? asStringArray(question.body.categories) : asStringArray(question.body.roles);
  if (cards.length < 2 || categories.length < 2) return null;
  let saved: string[] = [];
  try { const value = JSON.parse(input); if (Array.isArray(value)) saved = value; } catch { /* start fresh */ }
  const assigned = new Map<string, string>(); saved.forEach((item) => { const match = item.match(/^([^:]+): (.+)$/); if (match) assigned.set(match[2], match[1]); });
  const publish = (card: string, category: string) => { const next = new Map(assigned); next.set(card, category); const result = categories.map((group) => `${group}: ${cards.filter((item) => next.get(item) === group).join(', ')}`).filter((item) => !item.endsWith(': ')); onChoose(JSON.stringify(result)); };
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label={format === 'variable-sort' ? 'Variable role sorter' : 'Argument role map'}><p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">{format === 'variable-sort' ? 'Investigation sorter' : 'Argument map'}</p><p className="mt-2 text-center text-sm text-white/80">Assign each card to one role. Use the labels and evidence, not colour or speed.</p><div className="mt-4 grid gap-2">{cards.map((card) => <label key={card} className="rounded-xl bg-[#fff7df] p-3 text-sm text-ink">{card}<select value={assigned.get(card) ?? ''} onChange={(event) => publish(card, event.target.value)} className="mt-2 min-h-11 w-full rounded-lg bg-white px-2 text-ink"><option value="">Choose a role</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>)}</div></section>;
}

function CircuitCompletionBoard({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  if (question.format.toLowerCase() !== 'circuit-builder') return null;
  const components = asStringArray(question.body.components);
  if (components.length < 2) return null;
  const complete = input === String(question.expected);
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Circuit completion board"><p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Safe circuit lab</p><div className="mt-4 flex flex-wrap items-center justify-center gap-2">{components.map((component, index) => <span key={`${component}-${index}`} className="rounded-xl bg-[#fff7df] px-3 py-2 text-sm font-semibold text-ink">{component}</span>)}</div><p className="mt-4 text-center text-sm text-white/80">Connect the return path so the circuit is a closed loop. No real electricity or fine dragging is required.</p><button type="button" onClick={() => onChoose(String(question.expected))} className={`mt-4 min-h-12 w-full rounded-xl px-4 font-semibold ${complete ? 'bg-leaf text-white' : 'bg-sun text-ink'}`}>{complete ? 'Closed loop recorded' : 'Complete closed loop'}</button></section>;
}

function GraphDataReader({ question }: { question: StudioQuestion }) {
  if (!['graph-reader', 'graph-table-investigation'].includes(question.format.toLowerCase())) return null;
  const rows = Array.isArray(question.body.data) ? question.body.data.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null && !Array.isArray(row)) : [];
  const points = Array.isArray(question.body.data_points) ? question.body.data_points.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null && !Array.isArray(row)) : [];
  const table = Array.isArray(question.body.data_table) ? question.body.data_table.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null && !Array.isArray(row)) : [];
  const data = rows.length ? rows : points.length ? points : table;
  if (!data.length) return null;
  const columns = Object.keys(data[0]);
  const xAxis = typeof question.body.x_axis === 'string' ? question.body.x_axis : columns[0];
  const yAxis = typeof question.body.y_axis === 'string' ? question.body.y_axis : columns.slice(1).join(' and ');
  return <aside className="mx-auto mt-6 max-w-xl overflow-x-auto rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Graph data reader"><p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Graph data table</p><p className="mt-2 text-center text-sm text-white/80">Read {xAxis} across, then {yAxis} down. The same values are available in this static table.</p><table className="mt-4 w-full border-separate border-spacing-1 text-left text-sm"><thead><tr>{columns.map((column) => <th key={column} className="rounded-lg bg-sun p-2 text-ink">{column}</th>)}</tr></thead><tbody>{data.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column} className="rounded-lg bg-[#fff7df] p-2 text-ink">{String(row[column] ?? '')}</td>)}</tr>)}</tbody></table></aside>;
}

function PredictionEvidenceBoard({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  if (question.format.toLowerCase() !== 'prediction-observation-explanation') return null;
  const options = asStringArray(question.body.choices).length ? asStringArray(question.body.choices) : asStringArray(question.body.prediction_options);
  const prediction = typeof question.body.prediction === 'string' ? question.body.prediction : '';
  const observation = typeof question.body.observation === 'string' ? question.body.observation : '';
  if (options.length < 2 || !observation) return null;
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Prediction observation explanation board"><p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Evidence lab</p>{prediction && <div className="mt-4 rounded-xl bg-white/10 p-3 text-sm text-white"><span className="font-display text-xs text-sun">Prediction</span><br />{prediction}</div>}<div className="mt-3 rounded-xl bg-[#fff7df] p-3 text-sm text-ink"><span className="font-display text-xs">Observation</span><br />{observation}</div><p className="mt-3 text-center text-sm text-white/80">Choose the explanation that fits the evidence. A prediction can change when new evidence appears.</p><div className="mt-4 grid gap-2">{options.map((option) => <button key={option} type="button" onClick={() => onChoose(option)} aria-pressed={input === option} className={`rounded-xl border-2 p-3 text-left text-sm ${input === option ? 'border-sun bg-[#fff7df] text-ink' : 'border-white/15 bg-white/5 text-white'}`}>{option}</button>)}</div></section>;
}

function FairTestPlanner({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  if (question.format.toLowerCase() !== 'fair-test-plan') return null;
  const variables = asStringArray(question.body.variable_options);
  if (variables.length < 3) return null;
  let saved: { change?: string; measure?: string; keep_same?: string[] } = {};
  try { saved = JSON.parse(input); } catch { /* start fresh */ }
  const [change, setChange] = useState(saved.change ?? ''); const [measure, setMeasure] = useState(saved.measure ?? ''); const [controls, setControls] = useState<string[]>(saved.keep_same ?? []);
  const publish = (nextChange: string, nextMeasure: string, nextControls: string[]) => onChoose(JSON.stringify({ change: nextChange, measure: nextMeasure, keep_same: [...nextControls].sort() }));
  const chooseChange = (value: string) => { setChange(value); const next = controls.filter((item) => item !== value); setControls(next); publish(value, measure, next); };
  const chooseMeasure = (value: string) => { setMeasure(value); const next = controls.filter((item) => item !== value); setControls(next); publish(change, value, next); };
  const toggleControl = (value: string) => { if (value === change || value === measure) return; const next = controls.includes(value) ? controls.filter((item) => item !== value) : [...controls, value]; setControls(next); publish(change, measure, next); };
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Fair test planner"><p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Fair test planner</p><p className="mt-2 text-center text-sm text-white/80">Change one variable, measure one outcome, and keep the others the same.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-sm font-semibold text-white">Change<select value={change} onChange={(event) => chooseChange(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-[#fff7df] px-3 text-ink"><option value="">Choose a variable</option>{variables.map((variable) => <option key={variable} value={variable}>{variable}</option>)}</select></label><label className="text-sm font-semibold text-white">Measure<select value={measure} onChange={(event) => chooseMeasure(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-[#fff7df] px-3 text-ink"><option value="">Choose an outcome</option>{variables.map((variable) => <option key={variable} value={variable}>{variable}</option>)}</select></label></div><p className="mt-4 text-sm font-semibold text-white">Keep the same</p><div className="mt-2 flex flex-wrap gap-2">{variables.map((variable) => <button key={variable} type="button" disabled={variable === change || variable === measure} onClick={() => toggleControl(variable)} aria-pressed={controls.includes(variable)} className={`min-h-11 rounded-xl px-3 text-sm font-semibold ${controls.includes(variable) ? 'bg-sun text-ink' : 'bg-white/10 text-white'} disabled:opacity-35`}>{variable}</button>)}</div></section>;
}

function ParticleLab({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  const format = question.format.toLowerCase();
  const [energy, setEnergy] = useState(45);
  if (!["particle-simulation", "model-sort", "explain-choice"].includes(format)) return null;
  const options = choiceOptions(question);
  const observedState = energy < 34 ? "solid" : energy < 70 ? "liquid" : "gas";
  return (
    <div className="mt-6 rounded-3xl border border-white/10 bg-[#102538]/80 p-4 shadow-[0_22px_60px_rgba(0,0,0,0.26)]" role="group" aria-label="Particle model comparison">
      <div className="grid gap-3 sm:grid-cols-3">
        {["solid", "liquid", "gas"].map((state, index) => (
          <div
            key={state}
            role="img"
            aria-label={`${state} particle model`}
            className={`particle-chamber particle-${state} ${format === "particle-simulation" && observedState === state ? "ring-2 ring-[var(--world-accent)]" : "opacity-75"}`}
          >
            <p className="font-display text-xs uppercase tracking-[0.14em] text-white/62">{state}</p>
            <div className="relative mt-3 h-24 overflow-hidden rounded-2xl bg-white/8">
              {Array.from({ length: state === "gas" ? 8 : 14 }).map((_, i) => (
                <span
                  key={i}
                  className="particle-dot"
                  style={{
                    left: `${state === "gas" ? 12 + ((i * 29) % 72) : 18 + ((i % 4) * 18) + index * 2}%`,
                    top: `${state === "gas" ? 12 + ((i * 19) % 72) : 20 + Math.floor(i / 4) * 18}%`,
                    animationDelay: `${i * 0.08}s`,
                    animationDuration: `${Math.max(0.55, 2.4 - energy / 55)}s`,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {format === "particle-simulation" && (
        <div className="mt-4 rounded-2xl bg-white/8 p-3">
          <div className="flex items-center justify-between text-xs text-white/60">
            <span>Low energy</span>
            <span>More movement</span>
          </div>
          <label className="sr-only" htmlFor={`energy-${question.id}`}>Particle energy</label>
          <input
            id={`energy-${question.id}`}
            type="range"
            min="0"
            max="100"
            value={energy}
            onChange={(event) => setEnergy(Number(event.target.value))}
            className="mt-3 w-full accent-[var(--world-accent)]"
          />
          <p className="mt-2 text-center text-sm text-white/75" aria-live="polite">
            Energy {energy}% — the model now behaves like a <strong>{observedState}</strong>.
          </p>
        </div>
      )}
      <div className="mt-4 grid gap-3">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChoose(option.value)}
            className={`btn-pop bg-white/12 px-4 py-3 text-left text-white hover:bg-white/20 ${input === option.value ? "ring-4 ring-[var(--world-accent)]" : ""}`}
          >
            <span className="font-display text-lg">{option.label}</span>
            {option.detail && <span className="mt-1 block text-xs font-normal leading-5 text-white/60">{option.detail}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function AudioBlend({ question }: { question: StudioQuestion }) {
  const [audioStatus, setAudioStatus] = useState("");
  const sounds = asStringArray(question.body.sounds);
  const audioAssets =
    question.body.audio_assets && typeof question.body.audio_assets === "object"
      ? question.body.audio_assets as Record<string, string>
      : {};
  const promptAudio = typeof question.body.prompt_audio_url === "string" ? question.body.prompt_audio_url : "";
  if (!["audio_blend", "audio-blend", "audio-choice", "listen-read"].includes(question.format.toLowerCase()) && sounds.length === 0) return null;

  function audioFor(sound: string) {
    return audioAssets[`phoneme-${sound}`] || audioAssets[sound] || "";
  }

  async function playClip(audioURL: string, label: string) {
    if (!audioURL) {
      setAudioStatus(`${label} studio audio is being prepared.`);
      return;
    }
    const played = await playProducedAudio(audioURL);
    setAudioStatus(played ? "" : `${label} studio audio did not play. Try again, or keep learning with the visual prompt.`);
  }

  return (
    <div className="mx-auto mt-6 max-w-md rounded-3xl border border-white/10 bg-white/10 p-5 text-center" role="group" aria-label="Sound blending controls">
      <p className="font-display text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Listen and build</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {(sounds.length ? sounds : ["listen", "think", "choose"]).map((sound) => {
          const audioURL = audioFor(sound);
          return (
            <button
              key={sound}
              type="button"
              className="sound-chip disabled:cursor-not-allowed disabled:opacity-55"
              onClick={() => void playClip(audioURL, sound)}
              aria-label={audioURL ? `Hear ${sound}` : `${sound} studio audio unavailable`}
              disabled={!audioURL}
            >
              {sound}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => void playClip(promptAudio, "Whole prompt")}
        className="mt-4 rounded-full bg-white/12 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55"
        disabled={!promptAudio}
      >
        Hear the whole prompt
      </button>
      {audioStatus && <p className="mt-3 text-xs leading-5 text-white/80" aria-live="polite">{audioStatus}</p>}
      {!promptAudio && Object.keys(audioAssets).length === 0 && (
        <p className="mt-3 text-xs leading-5 text-white/80">Studio audio is being prepared. You can keep learning with the visual prompt.</p>
      )}
    </div>
  );
}

export default function LearningStudio({
  question,
  input,
  showHint,
  onChoose,
  onKey,
  onSubmit,
  responseMode,
  onResponseModeChange,
}: Props) {
  const format = question.format.toLowerCase();
  const options = choiceOptions(question);
  const isTrace = format === "trace-path";
  const isWordBuild = format === "word-build";
  const isArrayBuild = format === "array-build";
  const isParticle = ["particle-simulation", "model-sort", "explain-choice"].includes(format);
  const isSentence = ["sentence-sort", "paragraph-build", "theme-choice"].includes(format);
  const isSequence = ["audio-sequence", ENERGY_SIMULATOR, "fossil-sequence", "growth-sequence", "hygiene-step-order", "life-cycle-sequence", "picture-sequence", "time-interval-sequence"].includes(format);
  const isCoordinatePlot = format === "coordinate-plot";
  const isCoordinateMap = ["coordinate-read", "movement-translation"].includes(format);
  const isPhonemeCount = format === "phoneme-count";
  const isSoundBoxBuild = format === "sound-box-build";
  const isMethodChoice = format === "method-choice";
  const isErrorAnalysis = format === "error-analysis";
  const isPredictionEvidence = format === "prediction-observation-explanation";
  const isFairTestPlan = format === "fair-test-plan";
  const isCompareModel = format === "compare-model";
  const isColumnCalculate = format === "column-calculate";
  const isOperationModel = format === "operation-model";
  const isProblemMap = format === "problem-map";
  const isHealthyChoice = format === "healthy-choice-explain";
  const isCircuitBuilder = format === "circuit-builder";
  const isEvolutionEvidence = ["inheritance-sort", "population-simulation", "fossil-evidence"].includes(format);
  const isCellLabel = format === "cell-label";
  const isForceModel = ["force-simulator", "mechanism-model"].includes(format);
  const isReaderEffect = format === "reader-effect-choice";
  const isGrammarWorkshop = ["sentence-editor", "clause-link-map", "relative-clause-editor", "sentence-combiner"].includes(format);
  const isContextChoice = ["meaning-substitute", "reference-map", "observation-record", "noun-pronoun-repair", "habitat-evidence-map", "register-slider"].includes(format);
  const isDisciplineContext = format === "discipline-context-sort";
  const isReasoningChoice = ["shape-evidence-map", "evidence-explain-choice", "function-choice"].includes(format);
  const isFunctionMachine = format === "function-machine";
  const isNumberModel = ["part-whole-build", "part-whole-family", "place-value-chart"].includes(format);
  const isSentenceBuild = format === "sentence-build";
  const isFactFamily = format === "fact-family-choice";
  const isStructuredChoice = ["balance-equation", "weather-sort", "scale-read", "fraction-bar-match"].includes(format);
  const isFractionWall = format === "fraction-wall";
  const isRatioScale = format === "scale-build";
  const isPatternSort = format === "pattern-sort";
  const isNumeric = typeof question.expected === "number" && !options.length && !isArrayBuild;
  const isChoice = options.length > 0 && !isSentence && !isParticle && !isWordBuild && !isMethodChoice && !isErrorAnalysis && !isReaderEffect && !isGrammarWorkshop && !isContextChoice && !isDisciplineContext && !isReasoningChoice && !isFunctionMachine && !isNumberModel && !isSentenceBuild && !isFactFamily && !isStructuredChoice && !isPatternSort && !isFractionWall && !isRatioScale && !isPredictionEvidence && !isFairTestPlan && !isCompareModel && !isColumnCalculate && !isOperationModel && !isProblemMap && !isHealthyChoice && !isCircuitBuilder && !isEvolutionEvidence && !isCellLabel && !isForceModel;

  return (
    <>
      <div className="font-display mx-auto mt-8 max-w-3xl rounded-3xl bg-[#17233f] px-5 py-5 text-center text-4xl font-semibold tracking-wide text-white shadow-[0_18px_48px_rgba(0,0,0,0.22)] md:text-5xl">
        {isNumeric && question.a && question.b ? (
          <>
            {question.prompt.replace("What is ", "").replace("?", "")} = <span className="text-sun">{input || "?"}</span>
          </>
        ) : (
          <span className="leading-tight">{question.prompt}</span>
        )}
      </div>

      <div className="mt-3 text-center">
        <span className="rounded-full bg-[#17233f] px-3 py-1 text-xs font-semibold text-white">{formatLabel(question.format)}</span>
      </div>

      <fieldset className="mx-auto mt-5 max-w-lg">
        <legend className="text-center text-sm font-semibold text-white/75">How would you like to answer?</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl bg-white/8 p-2">
          <button
            type="button"
            onClick={() => onResponseModeChange("interactive")}
            className={`rounded-xl px-4 py-3 text-sm font-semibold ${responseMode === "interactive" ? "bg-sun text-ink" : "bg-white/8 text-white"}`}
            aria-pressed={responseMode === "interactive"}
          >
            Activity controls
          </button>
          <button
            type="button"
            onClick={() => onResponseModeChange("keyboard")}
            className={`rounded-xl px-4 py-3 text-sm font-semibold ${responseMode === "keyboard" ? "bg-sun text-ink" : "bg-white/8 text-white"}`}
            aria-pressed={responseMode === "keyboard"}
          >
            Keyboard answer
          </button>
        </div>
      </fieldset>

      <AudioBlend question={question} />
      {isSequence && <SequenceBoard key={"sequence-" + question.id} question={question} input={input} onChoose={onChoose} />}
      {isCoordinatePlot && <CoordinateBoard key={"coordinate-" + question.id} question={question} input={input} onChoose={onChoose} />}
      {isCoordinateMap && <CoordinateMap question={question} />}
      {isPhonemeCount && <PhonemeCounter question={question} input={input} onChoose={onChoose} />}
      {isSoundBoxBuild && <SoundBoxBuilder key={`sound-box-${question.id}`} question={question} input={input} onChoose={onChoose} />}
      <EvidenceCard question={question} />
      <GrammarWorkshop question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} />
      <ContextChoiceBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} />
      <DisciplineContextBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} />
      <ReasoningChoiceBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} />
      <FunctionMachineBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} />
      <NumberModelBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} />
      <SentenceBuildBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} />
      <FactFamilyBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} />
      <CircuitEvidenceBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} />
      <EvolutionEvidenceBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} />
      <CellLabelBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} />
      <ForceModelBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} />
      <StructuredChoiceBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} />
      <PatternSortBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} />
      <FractionWallBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} />
      <RatioScaleBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} />
      <EvidenceSpanSelector question={question} input={input} onChoose={onChoose} />
      <FeatureExplorer question={question} input={input} onChoose={onChoose} />
      <LifeEvidenceBoard question={question} />
      <ClassificationKeyBoard question={question} />
      <MeaningPurposeCard question={question} />
      <ParagraphThemeCard question={question} />
      {isMethodChoice && <MethodChoiceBoard question={question} input={input} onChoose={onChoose} />}
      {isErrorAnalysis && <ErrorAnalysisBoard question={question} input={input} onChoose={onChoose} />}
      {isReaderEffect && <ReaderEffectBoard question={question} input={input} onChoose={onChoose} />}
      <ParagraphRelationshipCard question={question} />
      <ClaimEvidenceTray question={question} />
      <TimelineJumpStrip question={question} />
      <CohesionContextCard question={question} />
      <GraphDataReader question={question} />
      {isPredictionEvidence && <PredictionEvidenceBoard question={question} input={input} onChoose={onChoose} />}
      {isFairTestPlan && <FairTestPlanner question={question} input={input} onChoose={onChoose} />}
      {isCompareModel && <ModelComparisonBoard question={question} input={input} onChoose={onChoose} />}
      {isColumnCalculate && <ColumnCalculationBoard question={question} input={input} onChoose={onChoose} />}
      {isOperationModel && <OperationModelBoard question={question} input={input} onChoose={onChoose} />}
      {isProblemMap && <ProblemMapBoard question={question} input={input} onChoose={onChoose} />}
      {isHealthyChoice && <HealthyChoiceBoard question={question} input={input} onChoose={onChoose} />}
      <RoleAssignmentBoard question={question} input={input} onChoose={onChoose} />
      {isCircuitBuilder && <CircuitCompletionBoard question={question} input={input} onChoose={onChoose} />}
      {responseMode === "interactive" && (
        <>
          <WordBuilder key={`word-${question.id}`} question={question} input={input} onChoose={onChoose} />
          <NounPhraseBuilder key={`noun-${question.id}`} question={question} input={input} onChoose={onChoose} />
          <ArrayForge key={`array-${question.id}`} question={question} input={input} onChoose={onChoose} />
          {isTrace && <TraceTrail letter={String(question.body.letter || "")} expected={String(question.expected)} onComplete={onChoose} />}
          <SentenceBoard question={question} options={options} input={input} onChoose={onChoose} />
          <ParticleLab question={question} input={input} onChoose={onChoose} />
        </>
      )}

      {showHint && responseMode === "interactive" && !isTrace && !isSentence && !isParticle && <NumericArray a={question.a} b={question.b} />}

      {responseMode === "keyboard" && (
        <div className="mx-auto mt-6 max-w-lg rounded-3xl border border-white/10 bg-white/10 p-5">
          <label className="block text-sm font-semibold text-white" htmlFor={`keyboard-answer-${question.id}`}>
            Keyboard answer
          </label>
          {options.length && !isMethodChoice && !isErrorAnalysis && !isReaderEffect && !isGrammarWorkshop && !isContextChoice && !isDisciplineContext && !isReasoningChoice && !isFunctionMachine && !isNumberModel && !isSentenceBuild && !isFactFamily && !isStructuredChoice && !isPatternSort && !isFractionWall && !isRatioScale && !isPredictionEvidence && !isFairTestPlan && !isCompareModel && !isColumnCalculate && !isOperationModel && !isProblemMap && !isHealthyChoice && !isCircuitBuilder ? (
            <select
              id={`keyboard-answer-${question.id}`}
              value={input}
              onChange={(event) => onChoose(event.target.value)}
              className="mt-3 min-h-14 w-full rounded-xl border border-white/20 bg-[#fff7df] px-4 text-base text-ink"
            >
              <option value="">Choose an answer</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          ) : isGrammarWorkshop || isContextChoice || isDisciplineContext || isReasoningChoice || isFunctionMachine || isNumberModel || isSentenceBuild || isFactFamily || isStructuredChoice || isPatternSort || isFractionWall || isRatioScale ? (
            <p className="mt-3 rounded-xl bg-white/8 p-4 text-sm leading-6 text-white/80">
              Use the accessible grammar workshop above. Its labelled choices work with keyboard, switch scanning and touch.
            </p>
          ) : isTrace ? (
            <button
              id={`keyboard-answer-${question.id}`}
              type="button"
              onClick={() => onChoose(String(question.expected))}
              className={`mt-3 min-h-14 w-full rounded-xl px-4 font-semibold ${input ? "bg-leaf text-white" : "bg-white text-ink"}`}
            >
              Mark trace complete
            </button>
          ) : isSequence || isCoordinatePlot ? (
            <p className="mt-3 rounded-xl bg-white/8 p-4 text-sm leading-6 text-white/80">
              Use the accessible activity controls above. They work with keyboard, switch scanning and touch.
            </p>
          ) : (
            <input
              id={`keyboard-answer-${question.id}`}
              type={typeof question.expected === "number" ? "number" : "text"}
              inputMode={typeof question.expected === "number" ? "numeric" : "text"}
              value={input}
              onChange={(event) => onChoose(event.target.value)}
              className="mt-3 min-h-14 w-full rounded-xl border border-white/20 bg-[#fff7df] px-4 text-lg text-ink"
              autoComplete="off"
            />
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={!input}
            className="btn-pop mt-4 min-h-14 w-full bg-sun px-4 py-3 text-lg text-ink disabled:opacity-50"
            aria-label="Submit answer"
          >
            Send answer
          </button>
        </div>
      )}

      {responseMode === "interactive" && isTrace && (
        <div className="mx-auto mt-6 grid max-w-md gap-3 sm:grid-cols-2">
          <button onClick={() => onChoose(String(question.expected))} className={`btn-pop bg-white/15 px-4 py-4 text-white ${input ? "ring-4 ring-[var(--world-accent)]" : ""}`}>
            Complete with keyboard
          </button>
          <button onClick={onSubmit} disabled={!input} className="btn-pop bg-sun px-4 py-4 text-ink disabled:opacity-50">
            Send trace
          </button>
        </div>
      )}

      {responseMode === "interactive" && (isSentence || isParticle || isChoice) && (
        <div className={`mx-auto mt-8 grid max-w-lg gap-3 ${isChoice ? "sm:grid-cols-3" : ""}`} role="group" aria-label="Answer choices">
          {isChoice &&
            options.map((option) => (
              <button
                key={option.value}
                onClick={() => onChoose(option.value)}
                className={`btn-pop min-h-20 bg-white/15 px-4 py-4 text-xl text-white hover:bg-white/25 ${
                  input === option.value ? "ring-4 ring-[var(--world-accent)]" : ""
                }`}
              >
                {option.label}
              </button>
            ))}
          <button
            onClick={onSubmit}
            disabled={!input}
            className={`btn-pop min-h-16 bg-sun px-4 py-4 text-xl text-ink disabled:opacity-50 ${isChoice ? "sm:col-span-3" : ""}`}
            aria-label="Submit answer"
          >
            Send answer
          </button>
        </div>
      )}

      {responseMode === "interactive" && (isWordBuild || isArrayBuild) && (
        <div className="mx-auto mt-6 max-w-lg">
          <button
            onClick={onSubmit}
            disabled={!input}
            className="btn-pop min-h-16 w-full bg-sun px-4 py-4 text-xl text-ink disabled:opacity-50"
            aria-label="Submit answer"
          >
            Send answer
          </button>
        </div>
      )}

      {responseMode === "interactive" && isNumeric && (
        <div className="mx-auto mt-8 grid max-w-xs grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0"].map((k) => (
            <button key={k} onClick={() => onKey(k)} className="btn-pop bg-white/15 py-4 text-2xl text-white hover:bg-white/25">
              {k === "back" ? "Del" : k}
            </button>
          ))}
          <button onClick={onSubmit} className="btn-pop bg-sun py-4 text-2xl text-ink" aria-label="Submit answer">
            Go
          </button>
        </div>
      )}
    </>
  );
}

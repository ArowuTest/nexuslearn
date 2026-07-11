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
  const supportedFormats = new Set(["audio-sequence", "fossil-sequence", "growth-sequence", "hygiene-step-order", "life-cycle-sequence", "picture-sequence", "time-interval-sequence"]);
  const cards = asStringArray(question.body.cards);
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
  const isSequence = ["audio-sequence", "fossil-sequence", "growth-sequence", "hygiene-step-order", "life-cycle-sequence", "picture-sequence", "time-interval-sequence"].includes(format);
  const isCoordinatePlot = format === "coordinate-plot";
  const isCoordinateMap = ["coordinate-read", "movement-translation"].includes(format);
  const isPhonemeCount = format === "phoneme-count";
  const isSoundBoxBuild = format === "sound-box-build";
  const isNumeric = typeof question.expected === "number" && !options.length && !isArrayBuild;
  const isChoice = options.length > 0 && !isSentence && !isParticle && !isWordBuild;

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
      {responseMode === "interactive" && (
        <>
          <WordBuilder key={`word-${question.id}`} question={question} input={input} onChoose={onChoose} />
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
          {options.length ? (
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

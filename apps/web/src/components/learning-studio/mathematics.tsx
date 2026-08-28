"use client";

import { useState } from "react";
import type { MathematicsFormat } from "./formats";
import { asStringArray, type StudioQuestion, type StudioRendererDefinition, type StudioRendererProps, type StudioRendererRegistry } from "./types";

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
function CoordinateBoard({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  const [x, setX] = useState<number>(0);
  const [y, setY] = useState<number>(0);
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
            return <button key={`${gridX}-${gridY}`} type="button" role="gridcell" onClick={() => choose(gridX, gridY)} aria-label={`Plot point (${gridX}, ${gridY})`} aria-selected={isSelected} className={`flex min-h-9 min-w-9 items-center justify-center rounded-lg border text-xs font-bold ${isSelected ? "border-[#17233f] bg-leaf text-white ring-2 ring-sun" : "border-[#17233f]/20 bg-white text-ink hover:bg-sun focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun"}`}>
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
function MethodChoiceBoard({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  const [chosen, setChosen] = useState('');
  if (question.format.toLowerCase() !== 'method-choice') return null;
  const strategies = asStringArray(question.body.choices);
  const steps = asStringArray(question.body.strategy_steps);
  const calculation = typeof question.body.calculation === 'string' ? question.body.calculation : '';
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
function FactFamilyBoard({ question, input, onChoose, onSubmit }: { question: StudioQuestion; input: string; onChoose: (value: string) => void; onSubmit: () => void }) {
  const planner = question.format[0] === 'i';
  if (!planner && question.format !== 'fact-family-choice') return null;
  const choices = asStringArray(question.body[planner ? 'planner_cards' : 'choices']);
  const parts = Array.isArray(question.body.parts) ? question.body.parts.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)) : [];
  const groups = Number(question.body.groups); const groupSize = Number(question.body.group_size); const total = Number(question.body.total);
  let selectCount = Number(question.body.select_count);
  if (planner) { try { selectCount = JSON.parse(question.expected as string).length || 0; } catch { selectCount = 0; } }
  let selected: string[] = [];
  try { const parsed = JSON.parse(input); selected = Array.isArray(parsed) ? parsed.map(String) : input ? [input] : []; } catch { if (input) selected = [input]; }
  const multi = selectCount > 1;
  const publish = (choice: string) => { const next = multi ? (selected.includes(choice) ? selected.filter((item) => item !== choice) : [...selected, choice]) : [choice]; const ordered = choices.filter((item) => next.includes(item)); onChoose(multi ? JSON.stringify(ordered) : choice); };
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Choice board">
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Fact workshop</p>
    <p className="mt-2 text-center text-sm text-white/80">Keep the model visible and choose the related fact or facts. Correct selections stay when you revise.</p>
    {groups > 0 && groupSize > 0 && total > 0 && <div className="mt-4 flex flex-wrap justify-center gap-2"><span className="rounded-xl bg-[#fff7df] px-3 py-2 font-bold text-ink">{groups} groups</span><span className="rounded-xl bg-[#fff7df] px-3 py-2 font-bold text-ink">{groupSize} in each</span><span className="rounded-xl bg-sun px-3 py-2 font-bold text-ink">Total {total}</span></div>}
    {parts.length === 2 && Number.isFinite(Number(question.body.whole)) && <div className="mt-4 flex flex-wrap justify-center gap-2"><span className="rounded-xl bg-[#fff7df] px-3 py-2 font-bold text-ink">Part {parts[0]}</span><span className="rounded-xl bg-[#fff7df] px-3 py-2 font-bold text-ink">Part {parts[1]}</span><span className="rounded-xl bg-sun px-3 py-2 font-bold text-ink">Whole {String(question.body.whole)}</span></div>}
    {multi && <p className="mt-3 text-center text-xs text-white/70">Select {selectCount} related facts, then send the family together.</p>}
    <div className="mt-4 grid gap-2" role="group" aria-label="Choices">{choices.map((choice, index) => <button key={choice} type="button" onClick={() => publish(choice)} aria-pressed={selected.includes(choice)} className={`min-h-14 rounded-xl border-2 p-3 text-left text-sm font-semibold ${selected.includes(choice) ? 'border-sun bg-[#fff7df] text-ink' : 'border-white/15 bg-white/5 text-white'}`}><span className="mr-2 text-xs">Fact {index + 1}</span>{choice}</button>)}</div>
    <button type="button" onClick={onSubmit} disabled={!selected.length || (multi && selected.length !== selectCount)} className="btn-pop mt-4 min-h-14 w-full bg-sun px-4 py-3 text-lg text-ink disabled:opacity-50" aria-label="Submit fact family">Send answer</button>
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
function TimelineJumpStrip({ question }: { question: StudioQuestion }) {
  if (question.format.toLowerCase() !== 'time-line') return null;
  const start = typeof question.body.start_time === 'string' ? question.body.start_time : '';
  const duration = Number(question.body.duration_minutes);
  const jumps = asStringArray(question.body.suggested_jumps);
  if (!start || !Number.isFinite(duration)) return null;
  return <aside className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Time jump strip"><p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Time path</p><div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-ink"><span className="rounded-xl bg-[#fff7df] px-3 py-2 font-bold">Start {start}</span>{jumps.map((jump, index) => <span key={`${jump}-${index}`} className="rounded-xl bg-sun px-3 py-2 font-semibold">+ {jump} min</span>)}<span className="rounded-xl bg-[#fff7df] px-3 py-2 font-bold">Total {duration} min</span></div><p className="mt-3 text-center text-sm text-white/80">Move along the path in calm steps, then choose the finishing time.</p></aside>;
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
  const [equivalent, setEquivalent] = useState('');
  if (question.format.toLowerCase() !== 'operation-model') return null;
  const start = Number(question.body.start); const end = Number(question.body.end); const expression = typeof question.body.expression === 'string' ? question.body.expression : '';
  const equivalentChoices = asStringArray(question.body.equivalent_choices);
  if (!Number.isFinite(start) || (!Number.isFinite(end) && !expression)) return null;
  const low = Math.min(start, Number.isFinite(end) ? end : start + 6) - 2; const high = Math.max(start, Number.isFinite(end) ? end : start + 6) + 2;
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Number line operation model"><p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Number-line lab</p>{expression && <p className="mt-3 rounded-xl bg-[#fff7df] p-3 text-center font-mono text-xl text-ink">{expression}</p>}<p className="mt-3 text-center text-sm text-white/80">Start at the marked number, show the movement, then record the result.</p><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">{Array.from({ length: high - low + 1 }, (_, index) => low + index).map((value) => <span key={value} className={`rounded-lg p-2 text-center text-sm font-bold ${value === start || value === end ? 'bg-sun text-ink ring-2 ring-leaf' : 'bg-[#fff7df] text-ink'}`}>{value}</span>)}</div>{equivalentChoices[0]&&<div className="mt-4 grid">{equivalentChoices.map((choice) => <button key={choice} type="button" onClick={() => setEquivalent(choice)} aria-pressed={equivalent === choice} className={`min-h-11 rounded-xl ${equivalent === choice ? 'bg-sun text-ink' : 'bg-white/10 text-white'}`}>{choice}</button>)}</div>}<label className="mt-4 block text-sm font-semibold text-white">Result<input type="number" value={input} onChange={(event) => onChoose(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl bg-[#fff7df] px-3 text-lg text-ink" /></label></section>;
}

function ProblemMapBoard({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  if (question.format.toLowerCase() !== 'problem-map') return null;
  const cards = asStringArray(question.body.quantity_cards); const plan = asStringArray(question.body.plan); const target = typeof question.body.question_target === 'string' ? question.body.question_target : '';
  if (!cards.length) return null;
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Multi-step problem map"><p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Problem map</p><p className="mt-2 text-center text-sm text-white/80">Label the quantities, find the intermediate amount, then check the final target. Correct steps stay visible.</p><div className="mt-4 flex flex-wrap justify-center gap-2">{cards.map((card) => <span key={card} className={`rounded-xl px-3 py-2 text-sm font-semibold ${card === target ? 'bg-sun text-ink ring-2 ring-leaf' : 'bg-[#fff7df] text-ink'}`}>{card}</span>)}</div>{plan.length > 0 && <ol className="mt-4 grid gap-2">{plan.map((step, index) => <li key={step} className="rounded-xl bg-white/10 p-3 text-sm text-white"><span className="font-display mr-2 text-xs text-sun">Step {index + 1}</span>{step}</li>)}</ol>}<label className="mt-4 block text-sm font-semibold text-white">Final answer<input type="number" value={input} onChange={(event) => onChoose(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl bg-[#fff7df] px-3 text-lg text-ink" /></label></section>;
}

export const mathematicsRendererRegistry = {
  "array-build": { family: "mathematics", Renderer: ({ question, input, onChoose }) => <ArrayForge key={`array-${question.id}`} question={question} input={input} onChoose={onChoose} /> },
  "coordinate-plot": { family: "mathematics", Renderer: ({ question, input, onChoose }) => <CoordinateBoard key={`coordinate-${question.id}`} question={question} input={input} onChoose={onChoose} /> },
  "coordinate-read": { family: "mathematics", Renderer: ({ question }) => <CoordinateMap question={question} /> },
  "movement-translation": { family: "mathematics", Renderer: ({ question }) => <CoordinateMap question={question} /> },
  "method-choice": { family: "mathematics", Renderer: ({ question, input, onChoose }) => <MethodChoiceBoard question={question} input={input} onChoose={onChoose} /> },
  "error-analysis": { family: "mathematics", Renderer: ({ question, input, onChoose }) => <ErrorAnalysisBoard question={question} input={input} onChoose={onChoose} /> },
  "function-machine": { family: "mathematics", Renderer: ({ question, input, onChoose, onSubmit }) => <FunctionMachineBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "part-whole-build": { family: "mathematics", Renderer: ({ question, input, onChoose, onSubmit }) => <NumberModelBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "part-whole-family": { family: "mathematics", Renderer: ({ question, input, onChoose, onSubmit }) => <NumberModelBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "place-value-chart": { family: "mathematics", Renderer: ({ question, input, onChoose, onSubmit }) => <NumberModelBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "fact-family-choice": { family: "mathematics", Renderer: ({ question, input, onChoose, onSubmit }) => <FactFamilyBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "investigation-planner": { family: "mathematics", Renderer: ({ question, input, onChoose, onSubmit }) => <FactFamilyBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "fraction-wall": { family: "mathematics", Renderer: ({ question, input, onChoose, onSubmit }) => <FractionWallBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "scale-build": { family: "mathematics", Renderer: ({ question, input, onChoose, onSubmit }) => <RatioScaleBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "pattern-sort": { family: "mathematics", Renderer: ({ question, input, onChoose, onSubmit }) => <PatternSortBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "time-line": { family: "mathematics", Renderer: ({ question }) => <TimelineJumpStrip question={question} /> },
  "compare-model": { family: "mathematics", Renderer: ({ question, input, onChoose }) => <ModelComparisonBoard question={question} input={input} onChoose={onChoose} /> },
  "column-calculate": { family: "mathematics", Renderer: ({ question, input, onChoose }) => <ColumnCalculationBoard question={question} input={input} onChoose={onChoose} /> },
  "operation-model": { family: "mathematics", Renderer: ({ question, input, onChoose }) => <OperationModelBoard key={question.id} question={question} input={input} onChoose={onChoose} /> },
  "problem-map": { family: "mathematics", Renderer: ({ question, input, onChoose }) => <ProblemMapBoard question={question} input={input} onChoose={onChoose} /> },
} satisfies Record<MathematicsFormat, StudioRendererDefinition>;

export function MathematicsRenderer(props: StudioRendererProps) {
  const Renderer = (mathematicsRendererRegistry as StudioRendererRegistry)[props.question.format.toLowerCase()]?.Renderer;
  return Renderer ? <Renderer {...props} /> : null;
}

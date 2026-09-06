"use client";

import { useState, type PointerEvent } from "react";
import type { LiteracyFormat } from "./formats";
import { asStringArray, choiceOptions, type Option, type StudioQuestion, type StudioRendererDefinition, type StudioRendererProps, type StudioRendererRegistry } from "./types";

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
  const tiles = asStringArray(question.body.tiles);
  const [built, setBuilt] = useState<string[]>([]);
  const [used, setUsed] = useState<number[]>([]);
  if (question.format.toLowerCase() !== "noun-phrase-builder" || tiles.length < 2) return null;
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
function TraceTrail({ letter, onComplete }: { letter: string; onComplete: (value: string) => void }) {
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
    if (points.length >= 8) onComplete(JSON.stringify({ points }));
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
  const initial = (() => {
    try {
      const value = JSON.parse(input);
      return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
    } catch { return []; }
  })();
  const [built, setBuilt] = useState<string[]>(initial);
  const [used, setUsed] = useState<number[]>([]);
  if (!['sound-box-build', 'oral-segment'].includes(question.format.toLowerCase())) return null;
  const tiles = asStringArray(question.body.tiles);
  const boxCount = Number(question.body.sound_boxes);
  if (!Number.isInteger(boxCount) || boxCount < 2 || boxCount > 6 || tiles.length < boxCount) return null;
  const publish = (next: string[], nextUsed: number[]) => { setBuilt(next); setUsed(nextUsed); onChoose(JSON.stringify(next)); };
  const add = (tile: string, index: number) => { if (built.length < boxCount) publish([...built, tile], [...used, index]); };
  const undo = () => publish(built.slice(0, -1), used.slice(0, -1));
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Sound box builder">
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Sound box builder</p>
    <p className="mt-2 text-center text-sm text-white/80">Say each sound, then place its sound tile in the next box. You can tap; dragging is never needed.</p>
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
  const [firstWord, setFirstWord] = useState(0);
  const [lastWord, setLastWord] = useState(0);
  const format = question.format.toLowerCase();
  if (!['evidence-highlight', 'clue-highlight', 'evidence-link', 'evidence-rank'].includes(format)) return null;
  const choices = asStringArray(question.body.choices);
  const selectable = asStringArray(question.body.selectable_spans);
  const chunks = asStringArray(question.body.chunks);
  const candidates = choices.length >= 2 ? choices : selectable.length >= 2 ? selectable : chunks;
  const source = typeof question.body.extract === 'string' ? question.body.extract : typeof question.body.text === 'string' ? question.body.text : '';
  const inference = typeof question.body.inference === 'string' ? question.body.inference : typeof question.body.target_inference === 'string' ? question.body.target_inference : typeof question.body.target_mood === 'string' ? question.body.target_mood : '';
  const multi = question.responseKind === 'sequence';
  const words = source.match(/\S+/g) || [];
  const preciseWords = !multi && words.length > 0 ? <fieldset className="mt-4 rounded-xl bg-white/10 p-4">
    <legend className="text-sm font-semibold text-white">Choose an exact phrase from the text</legend>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm text-white">First word of evidence<select value={firstWord} onChange={(event) => setFirstWord(Number(event.target.value))} className="mt-2 min-h-12 w-full rounded-xl bg-[#fff7df] px-3 text-ink">{words.map((word, index) => <option key={index} value={index}>{index + 1}. {word}</option>)}</select></label>
      <label className="text-sm text-white">Last word of evidence<select value={lastWord} onChange={(event) => setLastWord(Number(event.target.value))} className="mt-2 min-h-12 w-full rounded-xl bg-[#fff7df] px-3 text-ink">{words.map((word, index) => <option key={index} value={index}>{index + 1}. {word}</option>)}</select></label>
    </div>
    <button type="button" disabled={lastWord < firstWord} onClick={() => onChoose(words.slice(firstWord, lastWord + 1).join(' ').replace(/^[“"']+|[.,!?;:”"']+$/g, ''))} className="mt-3 min-h-12 w-full rounded-xl bg-sun px-3 font-semibold text-ink disabled:opacity-50">Use selected words</button>
    <label className="mt-3 block text-sm text-white">Your evidence phrase<textarea aria-label="Your evidence phrase" rows={3} value={input} onChange={(event) => onChoose(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl bg-[#fff7df] p-3 text-ink" /></label>
  </fieldset> : null;
  let selected: string[] = [];
  if (multi) {
    try { const value = JSON.parse(input); if (Array.isArray(value) && value.every((item) => typeof item === 'string')) selected = value; } catch { /* no selection yet */ }
  } else if (input) {
    selected = [input];
  }
  const toggle = (candidate: string) => {
    if (multi) {
      const next = selected.includes(candidate) ? selected.filter((item) => item !== candidate) : [...selected, candidate];
      onChoose(JSON.stringify(candidates.filter((item) => next.includes(item))));
      return;
    }
    onChoose(candidate);
  };
  const title = format === 'evidence-rank' ? 'Evidence strength desk' : format === 'evidence-link' ? 'Clue-to-inference link' : format === 'clue-highlight' ? 'Clue finder' : 'Evidence finder';
  const instruction = multi ? 'Select every precise phrase that supports the idea. The order does not matter.' : format === 'evidence-rank' ? 'Choose the evidence that best supports the claim. Re-read before you decide.' : 'Select the most precise evidence. You can revise your choice at any time; there is no timer.';
  if (candidates.length < 2) return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label={title}>
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">{title}</p>
    {inference && <p className="mt-2 rounded-2xl bg-[#fff7df] p-4 text-sm font-semibold leading-6 text-ink">Claim or idea: {inference}</p>}
    {source && <p className="mt-4 rounded-2xl bg-[#fff7df] p-4 text-sm leading-6 text-ink"><span className="font-display text-xs uppercase">Text to inspect</span><br />{source}</p>}
    {preciseWords}
    {!preciseWords && <label className="mt-4 block text-sm font-semibold text-white">Type the exact evidence phrase
      <input value={input} onChange={(event) => onChoose(event.target.value)} className="mt-2 min-h-14 w-full rounded-xl bg-[#fff7df] px-4 text-lg text-ink" aria-label="Evidence phrase" />
    </label>}
  </section>;
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label={title}>
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">{title}</p>
    <p className="mt-2 text-center text-sm text-white/80">{instruction}</p>
    {inference && <p className="mt-4 rounded-2xl bg-[#fff7df] p-4 text-sm font-semibold leading-6 text-ink"><span className="font-display text-xs uppercase">Claim or idea</span><br />{inference}</p>}
    {source && <p className="mt-4 rounded-2xl bg-[#fff7df] p-4 text-sm leading-6 text-ink"><span className="font-display text-xs uppercase">Text to inspect</span><br />{source}</p>}
    <div className="mt-5 grid gap-3" role="group" aria-label="Evidence choices">{candidates.map((candidate, index) => {
      const active = selected.includes(candidate);
      return <button key={`${candidate}-${index}`} type="button" onClick={() => toggle(candidate)} aria-pressed={active} className={`rounded-2xl border-2 p-4 text-left ${active ? 'border-sun bg-[#fff7df] text-ink ring-2 ring-sun' : 'border-white/15 bg-white/5 text-white'}`}><span className="mr-2 font-display text-xs opacity-70">{index + 1}.</span>{candidate}</button>;
    })}</div>
    {preciseWords}
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
function CohesionContextCard({ question }: { question: StudioQuestion }) {
  if (question.format.toLowerCase() !== 'cohesion-edit') return null;
  const meaning = typeof question.body.intended_meaning === 'string' ? question.body.intended_meaning : '';
  const referent = typeof question.body.intended_referent === 'string' ? question.body.intended_referent : '';
  const original = typeof question.body.original === 'string' ? question.body.original : '';
  const context = meaning || referent || (original ? `Repair this original: ${original}` : 'Keep the intended meaning clear.');
  return <aside className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Cohesion repair context"><p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Clarity desk</p><p className="mt-3 rounded-xl bg-[#fff7df] p-4 text-center text-sm font-semibold text-ink">{context}</p><p className="mt-3 text-center text-sm text-white/80">Choose the edit that keeps this meaning clear for the reader.</p></aside>;
}

export const literacyRendererRegistry = {
  "word-build": { family: "literacy", Renderer: ({ question, input, onChoose }) => <WordBuilder key={`word-${question.id}`} question={question} input={input} onChoose={onChoose} /> },
  "noun-phrase-builder": { family: "literacy", Renderer: ({ question, input, onChoose }) => <NounPhraseBuilder key={`noun-${question.id}`} question={question} input={input} onChoose={onChoose} /> },
  "trace-path": { family: "literacy", Renderer: ({ question, onChoose }) => <TraceTrail letter={String(question.body.letter || "")} onComplete={onChoose} /> },
  "sentence-sort": { family: "literacy", Renderer: ({ question, input, onChoose }) => <SentenceBoard question={question} options={choiceOptions(question)} input={input} onChoose={onChoose} /> },
  "paragraph-build": { family: "literacy", Renderer: ({ question, input, onChoose }) => <SentenceBoard question={question} options={choiceOptions(question)} input={input} onChoose={onChoose} /> },
  "theme-choice": { family: "literacy", Renderer: ({ question, input, onChoose }) => <SentenceBoard question={question} options={choiceOptions(question)} input={input} onChoose={onChoose} /> },
  "phoneme-count": { family: "literacy", Renderer: ({ question, input, onChoose }) => <PhonemeCounter question={question} input={input} onChoose={onChoose} /> },
  "sound-box-build": { family: "literacy", Renderer: ({ question, input, onChoose }) => <SoundBoxBuilder key={`sound-box-${question.id}`} question={question} input={input} onChoose={onChoose} /> },
  "oral-segment": { family: "literacy", Renderer: ({ question, input, onChoose }) => <SoundBoxBuilder key={`sound-box-${question.id}`} question={question} input={input} onChoose={onChoose} /> },
  "evidence-explain": { family: "literacy", Renderer: ({ question }) => <EvidenceCard question={question} /> },
  "evidence-highlight": { family: "literacy", Renderer: ({ question, input, onChoose }) => <EvidenceSpanSelector question={question} input={input} onChoose={onChoose} /> },
  "clue-highlight": { family: "literacy", Renderer: ({ question, input, onChoose }) => <EvidenceSpanSelector question={question} input={input} onChoose={onChoose} /> },
  "evidence-link": { family: "literacy", Renderer: ({ question, input, onChoose }) => <EvidenceSpanSelector question={question} input={input} onChoose={onChoose} /> },
  "evidence-rank": { family: "literacy", Renderer: ({ question, input, onChoose }) => <EvidenceSpanSelector question={question} input={input} onChoose={onChoose} /> },
  "feature-tap": { family: "literacy", Renderer: ({ question, input, onChoose }) => <FeatureExplorer question={question} input={input} onChoose={onChoose} /> },
  "meaning-choice": { family: "literacy", Renderer: ({ question }) => <MeaningPurposeCard question={question} /> },
  "paragraph-sort": { family: "literacy", Renderer: ({ question }) => <ParagraphThemeCard question={question} /> },
  "reader-effect-choice": { family: "literacy", Renderer: ({ question, input, onChoose }) => <ReaderEffectBoard question={question} input={input} onChoose={onChoose} /> },
  "sentence-editor": { family: "literacy", Renderer: ({ question, input, onChoose, onSubmit }) => <GrammarWorkshop question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "clause-link-map": { family: "literacy", Renderer: ({ question, input, onChoose, onSubmit }) => <GrammarWorkshop question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "relative-clause-editor": { family: "literacy", Renderer: ({ question, input, onChoose, onSubmit }) => <GrammarWorkshop question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "sentence-combiner": { family: "literacy", Renderer: ({ question, input, onChoose, onSubmit }) => <GrammarWorkshop question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "discipline-context-sort": { family: "literacy", Renderer: ({ question, input, onChoose, onSubmit }) => <DisciplineContextBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "sentence-build": { family: "literacy", Renderer: ({ question, input, onChoose, onSubmit }) => <SentenceBuildBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "paragraph-order": { family: "literacy", Renderer: ({ question }) => <ParagraphRelationshipCard question={question} /> },
  "claim-evidence-explain": { family: "literacy", Renderer: ({ question }) => <ClaimEvidenceTray question={question} /> },
  "cohesion-edit": { family: "literacy", Renderer: ({ question }) => <CohesionContextCard question={question} /> },
} satisfies Record<LiteracyFormat, StudioRendererDefinition>;

export function LiteracyRenderer(props: StudioRendererProps) {
  const Renderer = (literacyRendererRegistry as StudioRendererRegistry)[props.question.format.toLowerCase()]?.Renderer;
  return Renderer ? <Renderer {...props} /> : null;
}

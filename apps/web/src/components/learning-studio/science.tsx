"use client";

import { useState } from "react";
import type { ScienceFormat } from "./formats";
import { asStringArray, choiceOptions, ENERGY_SIMULATOR, type StudioQuestion, type StudioRendererDefinition, type StudioRendererProps, type StudioRendererRegistry } from "./types";

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

export function ForceModelBoard({ question, input, onChoose, onSubmit }: { question: StudioQuestion; input: string; onChoose: (value: string) => void; onSubmit: () => void }) {
  const format = question.format.toLowerCase();
  if (!format.startsWith('fo') && format !== 'mechanism-model') return null;
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
function HealthyChoiceBoard({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  if (question.format.toLowerCase() !== 'healthy-choice-explain') return null;
  const rawChoices = Array.isArray(question.body.choices) ? question.body.choices : [];
  const scalarChoices = rawChoices.filter((choice): choice is string | number => typeof choice === 'string' || typeof choice === 'number').map(String);
  const plateChoices = rawChoices.filter((choice): choice is Array<string | number> => Array.isArray(choice) && choice.every((item) => typeof item === 'string' || typeof item === 'number')).map((choice) => choice.map(String));
  const inclusiveNote = typeof question.body.inclusive_note === 'string' ? question.body.inclusive_note : '';
  if (scalarChoices.length < 2 && plateChoices.length < 2) return null;
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Healthy choice board"><p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Body-care explorer</p>{inclusiveNote && <p className="mt-3 rounded-xl bg-[#fff7df] p-3 text-center text-sm text-ink">{inclusiveNote}</p>}<p className="mt-3 text-center text-sm text-white/80">Choose the option that best supports the body, using evidence and variety.</p>{scalarChoices.length >= 2 && <div className="mt-4 grid gap-2">{scalarChoices.map((choice) => <button key={choice} type="button" onClick={() => onChoose(choice)} aria-pressed={input === choice} className={`min-h-12 rounded-xl border-2 p-3 text-left font-semibold ${input === choice ? 'border-sun bg-[#fff7df] text-ink' : 'border-white/15 bg-white/5 text-white'}`}>{choice}</button>)}</div>}{plateChoices.length >= 2 && <div className="mt-4 grid gap-3">{plateChoices.map((plate) => { const value = JSON.stringify(plate); return <button key={value} type="button" onClick={() => onChoose(value)} aria-pressed={input === value} className={`rounded-2xl border-2 p-4 text-left ${input === value ? 'border-sun bg-[#fff7df] text-ink' : 'border-white/15 bg-white/5 text-white'}`}><span className="font-display text-xs opacity-70">Plate option</span><span className="mt-2 flex flex-wrap gap-2">{plate.map((food, index) => <span key={`${food}-${index}`} className="rounded-lg bg-white/20 px-2 py-1 text-sm">{food}</span>)}</span></button>;})}</div>}</section>;
}

export function RoleAssignmentBoard({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  const format = question.format.toLowerCase();
  if (!format.endsWith('sort') && format !== 'argument-map') return null;
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
  const complete = input === 'closed_loop';
  const options = choiceOptions(question);
  return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Circuit completion board">
    <p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Safe circuit lab</p>
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{components.map((component, index) => <span key={`${component}-${index}`} className="rounded-xl bg-[#fff7df] px-3 py-2 text-sm font-semibold text-ink">{component}</span>)}</div>
    <p className="mt-4 text-center text-sm text-white/80">Inspect the connections before deciding. No real electricity or fine dragging is required.</p>
    {options.length ? <div className="mt-4 grid gap-3">{options.map(option => <button key={option.value} type="button" onClick={() => onChoose(option.value)} aria-pressed={input === option.value} className={`min-h-12 rounded-xl px-4 py-3 text-left font-semibold ${input === option.value ? 'bg-leaf text-white' : 'bg-sun text-ink'}`}>{option.label.replaceAll('_', ' ')}</button>)}</div> : <button type="button" onClick={() => onChoose(complete ? 'open_loop' : 'closed_loop')} aria-pressed={complete} className={`mt-4 min-h-12 w-full rounded-xl px-4 font-semibold ${complete ? 'bg-leaf text-white' : 'bg-sun text-ink'}`}>{complete ? 'Closed loop recorded' : 'Complete closed loop'}</button>}
  </section>;
}

function GraphDataReader({ question }: { question: StudioQuestion }) {
  if (!['graph-reader', 'graph-table-investigation', 'data-detective'].includes(question.format.toLowerCase())) return null;
  const rows = Array.isArray(question.body.data) ? question.body.data.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null && !Array.isArray(row)) : [];
  const points = Array.isArray(question.body.data_points) ? question.body.data_points.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null && !Array.isArray(row)) : [];
  const table = Array.isArray(question.body.data_table) ? question.body.data_table.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null && !Array.isArray(row)) : [];
  const data = rows.length ? rows : points.length ? points : table;
  if (!data.length) return null;
  const columns = Object.keys(data[0]);
  const xAxis = typeof question.body.x_axis === 'string' ? question.body.x_axis : columns[0];
  const yAxis = typeof question.body.y_axis === 'string' ? question.body.y_axis : columns.slice(1).join(' and ');
  return <aside className="mx-auto mt-6 max-w-xl overflow-x-auto rounded-3xl border border-white/10 bg-white/10 p-5" aria-label="Graph data reader"><p className="font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Graph data table</p><p className="mt-2 text-center text-sm text-white/80">Read {xAxis} across, then {yAxis} down. Values are available in this static table.</p><table className="mt-4 w-full border-separate border-spacing-1 text-left text-sm"><thead><tr>{columns.map((column) => <th key={column} className="rounded-lg bg-sun p-2 text-ink">{column}</th>)}</tr></thead><tbody>{data.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column} className="rounded-lg bg-[#fff7df] p-2 text-ink">{String(row[column] ?? '')}</td>)}</tr>)}</tbody></table></aside>;
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
  let saved: { change?: string; measure?: string; keep_same?: string[] } = {};
  try { saved = JSON.parse(input); } catch { /* start fresh */ }
  const [change, setChange] = useState(saved.change ?? '');
  const [measure, setMeasure] = useState(saved.measure ?? '');
  const [controls, setControls] = useState<string[]>(saved.keep_same ?? []);
  if (question.format.toLowerCase() !== 'fair-test-plan') return null;
  const variables = asStringArray(question.body.variable_options);
  if (variables.length < 3) return null;
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

export const scienceRendererRegistry = {
  "audio-sequence": { family: "science", Renderer: ({ question, input, onChoose }) => <SequenceBoard key={`sequence-${question.id}`} question={question} input={input} onChoose={onChoose} /> },
  [ENERGY_SIMULATOR]: { family: "science", Renderer: ({ question, input, onChoose }) => <SequenceBoard key={`sequence-${question.id}`} question={question} input={input} onChoose={onChoose} /> },
  "fossil-sequence": { family: "science", Renderer: ({ question, input, onChoose }) => <SequenceBoard key={`sequence-${question.id}`} question={question} input={input} onChoose={onChoose} /> },
  "growth-sequence": { family: "science", Renderer: ({ question, input, onChoose }) => <SequenceBoard key={`sequence-${question.id}`} question={question} input={input} onChoose={onChoose} /> },
  "hygiene-step-order": { family: "science", Renderer: ({ question, input, onChoose }) => <SequenceBoard key={`sequence-${question.id}`} question={question} input={input} onChoose={onChoose} /> },
  "life-cycle-sequence": { family: "science", Renderer: ({ question, input, onChoose }) => <SequenceBoard key={`sequence-${question.id}`} question={question} input={input} onChoose={onChoose} /> },
  "picture-sequence": { family: "science", Renderer: ({ question, input, onChoose }) => <SequenceBoard key={`sequence-${question.id}`} question={question} input={input} onChoose={onChoose} /> },
  "time-interval-sequence": { family: "science", Renderer: ({ question, input, onChoose }) => <SequenceBoard key={`sequence-${question.id}`} question={question} input={input} onChoose={onChoose} /> },
  "life-status-sort": { family: "science", Renderer: ({ question }) => <LifeEvidenceBoard question={question} /> },
  "classification-key": { family: "science", Renderer: ({ question }) => <ClassificationKeyBoard question={question} /> },
  "shape-evidence-map": { family: "science", Renderer: ({ question, input, onChoose, onSubmit }) => <ReasoningChoiceBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "evidence-explain-choice": { family: "science", Renderer: ({ question, input, onChoose, onSubmit }) => <ReasoningChoiceBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "function-choice": { family: "science", Renderer: ({ question, input, onChoose, onSubmit }) => <ReasoningChoiceBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "component-output-table": { family: "science", Renderer: ({ question, input, onChoose, onSubmit }) => <CircuitEvidenceBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "symbol-diagram-build": { family: "science", Renderer: ({ question, input, onChoose, onSubmit }) => <CircuitEvidenceBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "inheritance-sort": { family: "science", Renderer: ({ question, input, onChoose, onSubmit }) => <EvolutionEvidenceBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "population-simulation": { family: "science", Renderer: ({ question, input, onChoose, onSubmit }) => <EvolutionEvidenceBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "fossil-evidence": { family: "science", Renderer: ({ question, input, onChoose, onSubmit }) => <EvolutionEvidenceBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "cell-label": { family: "science", Renderer: ({ question, input, onChoose, onSubmit }) => <CellLabelBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "force-arrow-model": { family: "science", Renderer: ForceModelBoard },
  "force-simulator": { family: "science", Renderer: ForceModelBoard },
  "mechanism-model": { family: "science", Renderer: ForceModelBoard },
  "healthy-choice-explain": { family: "science", Renderer: ({ question, input, onChoose }) => <HealthyChoiceBoard question={question} input={input} onChoose={onChoose} /> },
  "argument-map": { family: "science", Renderer: RoleAssignmentBoard },
  "variable-sort": { family: "science", Renderer: RoleAssignmentBoard },
  "circuit-builder": { family: "science", Renderer: ({ question, input, onChoose }) => <CircuitCompletionBoard question={question} input={input} onChoose={onChoose} /> },
  "graph-reader": { family: "science", Renderer: ({ question }) => <GraphDataReader question={question} /> },
  "graph-table-investigation": { family: "science", Renderer: ({ question }) => <GraphDataReader question={question} /> },
  "data-detective": { family: "science", Renderer: ({ question }) => <GraphDataReader question={question} /> },
  "prediction-observation-explanation": { family: "science", Renderer: ({ question, input, onChoose }) => <PredictionEvidenceBoard question={question} input={input} onChoose={onChoose} /> },
  "fair-test-plan": { family: "science", Renderer: ({ question, input, onChoose }) => <FairTestPlanner question={question} input={input} onChoose={onChoose} /> },
  "particle-simulation": { family: "science", Renderer: ({ question, input, onChoose }) => <ParticleLab question={question} input={input} onChoose={onChoose} /> },
  "model-sort": { family: "science", Renderer: ({ question, input, onChoose }) => <ParticleLab question={question} input={input} onChoose={onChoose} /> },
  "explain-choice": { family: "science", Renderer: ({ question, input, onChoose }) => <ParticleLab question={question} input={input} onChoose={onChoose} /> },
} satisfies Record<ScienceFormat, StudioRendererDefinition>;

export function ScienceRenderer(props: StudioRendererProps) {
  const Renderer = (scienceRendererRegistry as StudioRendererRegistry)[props.question.format.toLowerCase()]?.Renderer;
  return Renderer ? <Renderer {...props} /> : null;
}

export function CompatibilityRenderer(props: StudioRendererProps) {
  const format = props.question.format.toLowerCase();
  const PrimaryRenderer = (scienceRendererRegistry as StudioRendererRegistry)[format]?.Renderer;
  return (
    <>
      {format.endsWith("sort") && PrimaryRenderer !== RoleAssignmentBoard && <RoleAssignmentBoard {...props} />}
      {format.startsWith("fo") && PrimaryRenderer !== ForceModelBoard && <ForceModelBoard {...props} />}
    </>
  );
}

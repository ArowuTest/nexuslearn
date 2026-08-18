"use client";

import { asStringArray, type StudioQuestion, type StudioRendererProps, type StudioRendererRegistry } from "./types";

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

export const crossCurricularRendererRegistry: StudioRendererRegistry = {
  "meaning-substitute": { family: "cross-curricular", Renderer: ({ question, input, onChoose, onSubmit }) => <ContextChoiceBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "reference-map": { family: "cross-curricular", Renderer: ({ question, input, onChoose, onSubmit }) => <ContextChoiceBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "observation-record": { family: "cross-curricular", Renderer: ({ question, input, onChoose, onSubmit }) => <ContextChoiceBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "noun-pronoun-repair": { family: "cross-curricular", Renderer: ({ question, input, onChoose, onSubmit }) => <ContextChoiceBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "habitat-evidence-map": { family: "cross-curricular", Renderer: ({ question, input, onChoose, onSubmit }) => <ContextChoiceBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "register-slider": { family: "cross-curricular", Renderer: ({ question, input, onChoose, onSubmit }) => <ContextChoiceBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "balance-equation": { family: "mathematics", Renderer: ({ question, input, onChoose, onSubmit }) => <StructuredChoiceBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "weather-sort": { family: "science", Renderer: ({ question, input, onChoose, onSubmit }) => <StructuredChoiceBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "scale-read": { family: "mathematics", Renderer: ({ question, input, onChoose, onSubmit }) => <StructuredChoiceBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
  "fraction-bar-match": { family: "mathematics", Renderer: ({ question, input, onChoose, onSubmit }) => <StructuredChoiceBoard question={question} input={input} onChoose={onChoose} onSubmit={onSubmit} /> },
};

export function CrossCurricularRenderer(props: StudioRendererProps) {
  const Renderer = crossCurricularRendererRegistry[props.question.format.toLowerCase()]?.Renderer;
  return Renderer ? <Renderer {...props} /> : null;
}

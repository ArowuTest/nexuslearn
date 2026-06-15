"use client";

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

function TraceTrail({ letter }: { letter: string }) {
  const shown = letter || "c";
  return (
    <div className="mx-auto mt-6 max-w-md rounded-3xl border border-white/10 bg-white/10 p-5">
      <div className="relative mx-auto h-56 max-w-xs rounded-3xl bg-[#fff7df] text-ink shadow-[inset_0_-18px_42px_rgba(255,191,69,0.18)]">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 260 220" aria-hidden>
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
        </svg>
        <span className="font-display absolute inset-0 flex items-center justify-center text-[160px] font-semibold text-[#17233f]/10">
          {shown}
        </span>
      </div>
      <p className="mt-4 text-center text-sm leading-6 text-white/70">
        Start at the glowing dot, follow the trail, then confirm when your path is complete.
      </p>
    </div>
  );
}

function SentenceBoard({ question, options, input, onChoose }: { question: StudioQuestion; options: Option[]; input: string; onChoose: (value: string) => void }) {
  const isParagraph = ["sentence-sort", "paragraph-build", "theme-choice"].includes(question.format.toLowerCase());
  if (!isParagraph) return null;
  return (
    <div className="mt-6 grid gap-3">
      <div className="rounded-3xl border border-white/10 bg-[#fff7df] p-4 text-ink shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
        <p className="font-display text-xs uppercase tracking-[0.14em] text-[#8b5d16]">Explorer notebook</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {options.map((option, index) => (
            <button
              key={`${option.label}-${index}`}
              onClick={() => onChoose(option.value)}
              className={`sentence-card text-left ${input === option.value ? "sentence-card-selected" : ""}`}
            >
              <span className="font-display text-xs uppercase text-[#8b5d16]/70">Card {index + 1}</span>
              <span className="mt-1 block text-sm font-semibold leading-5">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ParticleLab({ question, input, onChoose }: { question: StudioQuestion; input: string; onChoose: (value: string) => void }) {
  const format = question.format.toLowerCase();
  if (!["particle-simulation", "model-sort", "explain-choice"].includes(format)) return null;
  const options = choiceOptions(question);
  return (
    <div className="mt-6 rounded-3xl border border-white/10 bg-[#102538]/80 p-4 shadow-[0_22px_60px_rgba(0,0,0,0.26)]">
      <div className="grid gap-3 sm:grid-cols-3">
        {["solid", "liquid", "gas"].map((state, index) => (
          <div key={state} className={`particle-chamber particle-${state}`}>
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
          <div className="mt-2 h-3 rounded-full bg-white/15">
            <div className="h-3 w-3/4 rounded-full bg-[var(--world-accent)] shadow-[0_0_18px_var(--world-accent)]" />
          </div>
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
  const sounds = asStringArray(question.body.sounds);
  if (!["audio_blend", "audio-blend", "audio-choice", "listen-read"].includes(question.format.toLowerCase()) && sounds.length === 0) return null;
  return (
    <div className="mx-auto mt-6 max-w-md rounded-3xl border border-white/10 bg-white/10 p-5 text-center">
      <p className="font-display text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Listen and build</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {(sounds.length ? sounds : ["listen", "think", "choose"]).map((sound) => (
          <span key={sound} className="sound-chip">
            {sound}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function LearningStudio({ question, input, showHint, onChoose, onKey, onSubmit }: Props) {
  const format = question.format.toLowerCase();
  const options = choiceOptions(question);
  const isTrace = format === "trace-path";
  const isParticle = ["particle-simulation", "model-sort", "explain-choice"].includes(format);
  const isSentence = ["sentence-sort", "paragraph-build", "theme-choice"].includes(format);
  const isNumeric = typeof question.expected === "number" && !options.length;
  const isChoice = options.length > 0 && !isSentence && !isParticle;

  return (
    <>
      <div className="font-display mt-8 text-center text-4xl font-semibold tracking-wide md:text-5xl">
        {isNumeric && question.a && question.b ? (
          <>
            {question.prompt.replace("What is ", "").replace("?", "")} = <span className="text-sun">{input || "?"}</span>
          </>
        ) : (
          <span className="leading-tight">{question.prompt}</span>
        )}
      </div>

      <div className="mt-3 text-center">
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/62">{formatLabel(question.format)}</span>
      </div>

      <AudioBlend question={question} />
      {isTrace && <TraceTrail letter={String(question.body.letter || "")} />}
      <SentenceBoard question={question} options={options} input={input} onChoose={onChoose} />
      <ParticleLab question={question} input={input} onChoose={onChoose} />

      {showHint && !isTrace && !isSentence && !isParticle && <NumericArray a={question.a} b={question.b} />}

      {isTrace && (
        <div className="mx-auto mt-6 grid max-w-md gap-3 sm:grid-cols-2">
          <button onClick={() => onChoose(String(question.expected))} className={`btn-pop bg-white/15 px-4 py-4 text-white ${input ? "ring-4 ring-[var(--world-accent)]" : ""}`}>
            I traced the path
          </button>
          <button onClick={onSubmit} disabled={!input} className="btn-pop bg-sun px-4 py-4 text-ink disabled:opacity-50">
            Send trace
          </button>
        </div>
      )}

      {(isSentence || isParticle || isChoice) && (
        <div className={`mx-auto mt-8 grid max-w-lg gap-3 ${isChoice ? "sm:grid-cols-3" : ""}`}>
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

      {isNumeric && (
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

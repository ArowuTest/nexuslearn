"use client";

import { LearningActivityRenderer, rendererOwnsSubmission, resolveStudioRenderer } from "./learning-studio/registry";
import { NumericArray } from "./learning-studio/primitives";
import { ENERGY_SIMULATOR, choiceOptions, formatLabel, type LearningStudioProps } from "./learning-studio/types";

export default function LearningStudio({
  question,
  input,
  showHint,
  hintPanel,
  onChoose,
  onKey,
  onSubmit,
  responseMode,
  onResponseModeChange,
}: LearningStudioProps) {
  const format = question.format.toLowerCase();
  const options = choiceOptions(question);
  const isTrace = format === "trace-path";
  const isWordBuild = format === "word-build";
  const isArrayBuild = format === "array-build";
  const isParticle = ["particle-simulation", "model-sort", "explain-choice"].includes(format);
  const isSentence = ["sentence-sort", "paragraph-build", "theme-choice"].includes(format);
  const isSequence = ["audio-sequence", ENERGY_SIMULATOR, "fossil-sequence", "growth-sequence", "hygiene-step-order", "life-cycle-sequence", "picture-sequence", "time-interval-sequence"].includes(format);
  const isCoordinatePlot = format === "coordinate-plot";
  const isSoundBoxBuild = ["sound-box-build", "oral-segment"].includes(format);
  const hasGuidedChoices = ["method-choice", "error-analysis", "prediction-observation-explanation",
    "fair-test-plan", "compare-model", "column-calculate", "operation-model", "problem-map",
    "healthy-choice-explain", "circuit-builder", "reader-effect-choice"].includes(format);
  const isForceModel = format.startsWith("fo") || format === "mechanism-model";
  const ownsSubmission = rendererOwnsSubmission(format);
  const isNumeric = typeof question.expected === "number" && !options.length && !isArrayBuild && !ownsSubmission;
  const isChoice = options.length > 0 && !ownsSubmission && !isSentence && !isParticle && !isWordBuild && !hasGuidedChoices && !isForceModel;
  const needsBuilderSubmit = Boolean(resolveStudioRenderer(format)) && !ownsSubmission
    && !isTrace && !isSentence && !isParticle && !isChoice && !isWordBuild && !isArrayBuild && !isNumeric;
  let builderAnswerReady = Boolean(input.trim()) && input !== "[]" && input !== "{}";
  if (isSoundBoxBuild) {
    try {
      const sounds: unknown = JSON.parse(input);
      builderAnswerReady = Array.isArray(sounds) && sounds.length === Number(question.body.sound_boxes)
        && sounds.every(sound => typeof sound === "string" && sound.trim().length > 0);
    } catch { builderAnswerReady = false; }
  }

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

      {hintPanel}

      <fieldset className="mx-auto mt-5 max-w-lg">
        <legend className="text-center text-sm font-semibold text-white/75">How would you like to answer?</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl bg-white/8 p-2">
          {(["interactive", "keyboard"] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => onResponseModeChange(mode)}
              className={`rounded-xl px-4 py-3 text-sm font-semibold ${responseMode === mode ? "bg-sun text-ink" : "bg-white/8 text-white"}`}
              aria-pressed={responseMode === mode}
            >
              {mode === "interactive" ? "Activity controls" : "Keyboard answer"}
            </button>
          ))}
        </div>
      </fieldset>

      <LearningActivityRenderer
        question={question}
        input={input}
        onChoose={onChoose}
        onSubmit={onSubmit}
        responseMode={responseMode}
      />

      {showHint && responseMode === "interactive" && !isTrace && !isSentence && !isParticle && <NumericArray a={question.a} b={question.b} />}

      {responseMode === "keyboard" && !ownsSubmission && (
        <div className="mx-auto mt-6 max-w-lg rounded-3xl border border-white/10 bg-white/10 p-5">
          <label className="block text-sm font-semibold text-white" htmlFor={`keyboard-answer-${question.id}`}>
            Keyboard answer
          </label>
          {options.length && !hasGuidedChoices ? (
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

      {responseMode === "interactive" && (isWordBuild || isArrayBuild || needsBuilderSubmit) && (
        <div className="mx-auto mt-6 max-w-lg">
          <button
            onClick={onSubmit}
            disabled={needsBuilderSubmit ? !builderAnswerReady : !input}
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

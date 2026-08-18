"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { AudioBlend } from "./primitives";
import {
  asStringArray,
  choiceOptions,
  type StudioRendererDefinition,
  type StudioRendererFamily,
  type StudioRendererProps,
  type StudioRendererRegistry,
} from "./types";

const LiteracyRenderer = dynamic<StudioRendererProps>(() => import("./literacy").then((module) => module.LiteracyRenderer));
const MathematicsRenderer = dynamic<StudioRendererProps>(() => import("./mathematics").then((module) => module.MathematicsRenderer));
const ScienceRenderer = dynamic<StudioRendererProps>(() => import("./science").then((module) => module.ScienceRenderer));
const CrossCurricularRenderer = dynamic<StudioRendererProps>(() => import("./cross-curricular").then((module) => module.CrossCurricularRenderer));
const CompatibilityRenderer = dynamic<StudioRendererProps>(() => import("./science").then((module) => module.CompatibilityRenderer));

const rendererByFamily: Record<StudioRendererFamily, ComponentType<StudioRendererProps>> = {
  literacy: LiteracyRenderer,
  mathematics: MathematicsRenderer,
  science: ScienceRenderer,
  "cross-curricular": CrossCurricularRenderer,
};

const formatFamilies: Record<string, StudioRendererFamily> = {
  "word-build": "literacy",
  "noun-phrase-builder": "literacy",
  "trace-path": "literacy",
  "sentence-sort": "literacy",
  "paragraph-build": "literacy",
  "theme-choice": "literacy",
  "phoneme-count": "literacy",
  "sound-box-build": "literacy",
  "oral-segment": "literacy",
  "evidence-explain": "literacy",
  "evidence-highlight": "literacy",
  "clue-highlight": "literacy",
  "evidence-link": "literacy",
  "evidence-rank": "literacy",
  "feature-tap": "literacy",
  "meaning-choice": "literacy",
  "paragraph-sort": "literacy",
  "reader-effect-choice": "literacy",
  "sentence-editor": "literacy",
  "clause-link-map": "literacy",
  "relative-clause-editor": "literacy",
  "sentence-combiner": "literacy",
  "discipline-context-sort": "literacy",
  "sentence-build": "literacy",
  "paragraph-order": "literacy",
  "claim-evidence-explain": "literacy",
  "cohesion-edit": "literacy",

  "array-build": "mathematics",
  "coordinate-plot": "mathematics",
  "coordinate-read": "mathematics",
  "movement-translation": "mathematics",
  "method-choice": "mathematics",
  "error-analysis": "mathematics",
  "function-machine": "mathematics",
  "part-whole-build": "mathematics",
  "part-whole-family": "mathematics",
  "place-value-chart": "mathematics",
  "fact-family-choice": "mathematics",
  "investigation-planner": "mathematics",
  "fraction-wall": "mathematics",
  "scale-build": "mathematics",
  "pattern-sort": "mathematics",
  "time-line": "mathematics",
  "compare-model": "mathematics",
  "column-calculate": "mathematics",
  "operation-model": "mathematics",
  "problem-map": "mathematics",

  "audio-sequence": "science",
  "energy-transfer-simulator": "science",
  "fossil-sequence": "science",
  "growth-sequence": "science",
  "hygiene-step-order": "science",
  "life-cycle-sequence": "science",
  "picture-sequence": "science",
  "time-interval-sequence": "science",
  "life-status-sort": "science",
  "classification-key": "science",
  "shape-evidence-map": "science",
  "evidence-explain-choice": "science",
  "function-choice": "science",
  "component-output-table": "science",
  "symbol-diagram-build": "science",
  "inheritance-sort": "science",
  "population-simulation": "science",
  "fossil-evidence": "science",
  "cell-label": "science",
  "force-arrow-model": "science",
  "force-simulator": "science",
  "mechanism-model": "science",
  "healthy-choice-explain": "science",
  "argument-map": "science",
  "variable-sort": "science",
  "circuit-builder": "science",
  "graph-reader": "science",
  "graph-table-investigation": "science",
  "data-detective": "science",
  "prediction-observation-explanation": "science",
  "fair-test-plan": "science",
  "particle-simulation": "science",
  "model-sort": "science",
  "explain-choice": "science",

  "meaning-substitute": "cross-curricular",
  "reference-map": "cross-curricular",
  "observation-record": "cross-curricular",
  "noun-pronoun-repair": "cross-curricular",
  "habitat-evidence-map": "cross-curricular",
  "register-slider": "cross-curricular",
  "balance-equation": "mathematics",
  "weather-sort": "science",
  "scale-read": "mathematics",
  "fraction-bar-match": "mathematics",
};

const rendererRegistry = Object.fromEntries(
  Object.entries(formatFamilies).map(([format, family]) => [
    format,
    { family, Renderer: rendererByFamily[family] },
  ]),
) as StudioRendererRegistry;

const interactiveOnlyFormats = new Set([
  "array-build",
  "explain-choice",
  "model-sort",
  "noun-phrase-builder",
  "paragraph-build",
  "particle-simulation",
  "sentence-sort",
  "theme-choice",
  "trace-path",
  "word-build",
]);

export function resolveStudioRenderer(format: string): StudioRendererDefinition | null {
  return rendererRegistry[format.toLowerCase()] ?? null;
}

export function LearningActivityRenderer(props: StudioRendererProps) {
  const format = props.question.format.toLowerCase();
  const definition = resolveStudioRenderer(format);
  const PrimaryRenderer = definition?.Renderer;
  const showPrimaryRenderer = PrimaryRenderer && (props.responseMode === "interactive" || !interactiveOnlyFormats.has(format));
  const includeCompatibilityRenderer = format.endsWith("sort") || format.startsWith("fo");
  const hasRoleAssignmentFallback = format.endsWith("sort")
    && (asStringArray(props.question.body.cards).length >= 2 || asStringArray(props.question.body.sentences).length >= 2)
    && (asStringArray(props.question.body.categories).length >= 2 || asStringArray(props.question.body.roles).length >= 2);
  const hasForceModelFallback = format.startsWith("fo") && choiceOptions(props.question).length >= 2;
  const hasGenericFallback = choiceOptions(props.question).length > 0 || typeof props.question.expected === "number";

  return (
    <>
      <AudioBlend question={props.question} />
      {showPrimaryRenderer && <PrimaryRenderer {...props} />}
      {includeCompatibilityRenderer && <CompatibilityRenderer {...props} />}
      {props.responseMode === "interactive" && !PrimaryRenderer && !hasRoleAssignmentFallback && !hasForceModelFallback && !hasGenericFallback && (
        <p
          className="mx-auto mt-6 max-w-lg rounded-2xl border border-white/15 bg-white/10 p-4 text-center text-sm leading-6 text-white/85"
          role="status"
          aria-label="Activity format status"
        >
          This activity format is not available yet. Choose Keyboard answer to continue with the same question.
        </p>
      )}
    </>
  );
}

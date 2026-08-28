import type { StudioRendererFamily } from "./types";

export const LITERACY_FORMATS = [
  "word-build", "noun-phrase-builder", "trace-path", "sentence-sort",
  "paragraph-build", "theme-choice", "phoneme-count", "sound-box-build",
  "oral-segment", "evidence-explain", "evidence-highlight", "clue-highlight",
  "evidence-link", "evidence-rank", "feature-tap", "meaning-choice",
  "paragraph-sort", "reader-effect-choice", "sentence-editor", "clause-link-map",
  "relative-clause-editor", "sentence-combiner", "discipline-context-sort",
  "sentence-build", "paragraph-order", "claim-evidence-explain", "cohesion-edit",
] as const;

export const MATHEMATICS_FORMATS = [
  "array-build", "coordinate-plot", "coordinate-read", "movement-translation",
  "method-choice", "error-analysis", "function-machine", "part-whole-build",
  "part-whole-family", "place-value-chart", "fact-family-choice",
  "investigation-planner", "fraction-wall", "scale-build", "pattern-sort",
  "time-line", "compare-model", "column-calculate", "operation-model", "problem-map",
] as const;

export const SCIENCE_FORMATS = [
  "audio-sequence", "energy-transfer-simulator", "fossil-sequence",
  "growth-sequence", "hygiene-step-order", "life-cycle-sequence",
  "picture-sequence", "time-interval-sequence", "life-status-sort",
  "classification-key", "shape-evidence-map", "evidence-explain-choice",
  "function-choice", "component-output-table", "symbol-diagram-build",
  "inheritance-sort", "population-simulation", "fossil-evidence", "cell-label",
  "force-arrow-model", "force-simulator", "mechanism-model",
  "healthy-choice-explain", "argument-map", "variable-sort", "circuit-builder",
  "graph-reader", "graph-table-investigation", "data-detective",
  "prediction-observation-explanation", "fair-test-plan", "particle-simulation",
  "model-sort", "explain-choice",
] as const;

export const CROSS_CURRICULAR_FORMATS = [
  "meaning-substitute", "reference-map", "observation-record",
  "noun-pronoun-repair", "habitat-evidence-map", "register-slider",
  "balance-equation", "weather-sort", "scale-read", "fraction-bar-match",
] as const;

export type LiteracyFormat = (typeof LITERACY_FORMATS)[number];
export type MathematicsFormat = (typeof MATHEMATICS_FORMATS)[number];
export type ScienceFormat = (typeof SCIENCE_FORMATS)[number];
export type CrossCurricularFormat = (typeof CROSS_CURRICULAR_FORMATS)[number];

export const FORMAT_FAMILIES: Readonly<Record<string, StudioRendererFamily>> =
  Object.freeze(Object.fromEntries([
    ...LITERACY_FORMATS.map((format) => [format, "literacy"] as const),
    ...MATHEMATICS_FORMATS.map((format) => [format, "mathematics"] as const),
    ...SCIENCE_FORMATS.map((format) => [format, "science"] as const),
    ...CROSS_CURRICULAR_FORMATS.map((format) => [format, "cross-curricular"] as const),
  ]));

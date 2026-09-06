import type { ComponentType, ReactNode } from "react";

export type StudioQuestion = {
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

export type Option = {
  label: string;
  value: string;
  detail?: string;
};

export type LearningStudioProps = {
  question: StudioQuestion;
  input: string;
  showHint: boolean;
  hintPanel?: ReactNode;
  onChoose: (value: string) => void;
  onKey: (key: string) => void;
  onSubmit: () => void;
  responseMode: "interactive" | "keyboard";
  onResponseModeChange: (mode: "interactive" | "keyboard") => void;
};

export type StudioRendererProps = Pick<LearningStudioProps, "question" | "input" | "onChoose" | "onSubmit" | "responseMode">;

export type StudioRendererFamily = "literacy" | "mathematics" | "science" | "cross-curricular";

export type StudioRendererDefinition = {
  family: StudioRendererFamily;
  Renderer: ComponentType<StudioRendererProps>;
};

export type StudioRendererRegistry = Record<string, StudioRendererDefinition>;

export const ENERGY_SIMULATOR = "energy-transfer-simulator";

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string | number => typeof item === "string" || typeof item === "number").map(String)
    : [];
}

export function formatLabel(format: string) {
  return format.replaceAll("_", "-").split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export function choiceOptions(question: StudioQuestion): Option[] {
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

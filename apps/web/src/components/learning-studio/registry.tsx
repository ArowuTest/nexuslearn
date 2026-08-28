"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { FORMAT_FAMILIES } from "./formats";
import { AudioBlend } from "./primitives";
import {
  asStringArray,
  choiceOptions,
  type StudioRendererDefinition,
  type StudioRendererFamily,
  type StudioRendererProps,
  type StudioRendererRegistry,
} from "./types";

const LiteracyRenderer = dynamic<StudioRendererProps>(
  () => import("./literacy").then((module) => module.LiteracyRenderer),
);
const MathematicsRenderer = dynamic<StudioRendererProps>(
  () => import("./mathematics").then((module) => module.MathematicsRenderer),
);
const ScienceRenderer = dynamic<StudioRendererProps>(
  () => import("./science").then((module) => module.ScienceRenderer),
);
const CrossCurricularRenderer = dynamic<StudioRendererProps>(
  () => import("./cross-curricular").then((module) => module.CrossCurricularRenderer),
);
const CompatibilityRenderer = dynamic<StudioRendererProps>(
  () => import("./science").then((module) => module.CompatibilityRenderer),
);

const rendererByFamily: Record<StudioRendererFamily, ComponentType<StudioRendererProps>> = {
  literacy: LiteracyRenderer,
  mathematics: MathematicsRenderer,
  science: ScienceRenderer,
  "cross-curricular": CrossCurricularRenderer,
};

/*
 * FORMAT_FAMILIES is the shared format identity source used to type-check the
 * four implementation registries. The dispatcher retains lazy family imports,
 * so a mission loads only the renderer family it needs.
 */
const rendererRegistry = Object.fromEntries(
  Object.entries(FORMAT_FAMILIES).map(([format, family]) => [
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
  const showPrimaryRenderer =
    PrimaryRenderer && (props.responseMode === "interactive" || !interactiveOnlyFormats.has(format));
  const hasRoleAssignmentFallback =
    format.endsWith("sort") &&
    (asStringArray(props.question.body.cards).length >= 2 ||
      asStringArray(props.question.body.sentences).length >= 2) &&
    (asStringArray(props.question.body.categories).length >= 2 ||
      asStringArray(props.question.body.roles).length >= 2);
  const hasForceModelFallback =
    format.startsWith("fo") && choiceOptions(props.question).length >= 2;
  const includeCompatibilityRenderer =
    !PrimaryRenderer && (hasRoleAssignmentFallback || hasForceModelFallback);
  const hasGenericFallback =
    choiceOptions(props.question).length > 0 || typeof props.question.expected === "number";

  return (
    <>
      <AudioBlend question={props.question} />
      {showPrimaryRenderer && <PrimaryRenderer {...props} />}
      {includeCompatibilityRenderer && <CompatibilityRenderer {...props} />}
      {props.responseMode === "interactive" &&
        !PrimaryRenderer &&
        !hasRoleAssignmentFallback &&
        !hasForceModelFallback &&
        !hasGenericFallback && (
          <p
            className="mx-auto mt-6 max-w-lg rounded-2xl border border-white/15 bg-white/10 p-4 text-center text-sm leading-6 text-white/85"
            role="status"
            aria-label="Activity format status"
          >
            This activity format is not available yet. Choose Keyboard answer to continue with the
            same question.
          </p>
        )}
    </>
  );
}

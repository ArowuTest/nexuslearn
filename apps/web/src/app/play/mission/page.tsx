"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ChildJourneyChrome, { ApiStateCard } from "@/components/ChildJourneyChrome";
import Dino, { type DinoMood } from "@/components/Dino";
import LearningStudio from "@/components/LearningStudio";
import MissionJourney, { type JourneyEntry } from "@/components/MissionJourney";
import MockObjectiveGuidance from "@/components/MockObjectiveGuidance";
import ProgressSnapshot from "@/components/ProgressSnapshot";
import {
  DEFAULT_STUDENT_ID,
  getDiagnosticBaseline,
  getNextActivity,
  getProgress,
  getWorldState,
  pupilSessionHeaders,
  type DiagnosticBaseline,
  type MissionConfig,
  type MockAssessmentSummary,
  type NextActivityDecision,
  type ProgressReport,
} from "@/lib/api";
import { playProducedAudio, sfx, setMuted } from "@/lib/sound";
import { resolveNarrationFields, useNarrationAssets } from "@/lib/narration";

// Shared class groups keep repeated mission surfaces visually consistent.
const missionSubheadingClass = "font-display text-sm font-semibold uppercase tracking-[0.14em] text-[#5a3ca8]";
const missionPanelClass = "rounded-blob border border-white/10 bg-white/10 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur md:p-8";
const missionUnavailableClass = "flex min-h-screen items-center justify-center bg-gradient-to-b from-[#241f56] to-[#1a3a3d] px-6 text-white";
const missionStatusClass = "mission-status-pill rounded-full bg-white/10 px-4 py-1.5 text-white/75";

type Q = {
  id: string;
  questionVersion?: string;
  responseKind?: string;
  a?: number;
  b?: number;
  expected: number | string;
  prompt: string;
  objectiveId: string;
  format: string;
  choices: Array<number | string>;
  hints: string[];
  body: Record<string, unknown>;
  explanation: string;
  selectionReason: string;
};

function questionAudioURL(question: Q | null, narrationAssets: ReturnType<typeof useNarrationAssets>) {
  if (!question) return "";
  return resolveNarrationFields(question.body, narrationAssets);
}

function questionAudioScript(question: Q | null) {
  if (!question) return "";
  for (const key of ["audio_script", "narration_script"]) {
    const value = question.body[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function questionHasAudioReference(question: Q | null) {
  if (!question) return false;
  return ["audio_asset_id", "audio_ref", "whole_audio_asset_id"].some((key) => typeof question.body[key] === "string" && Boolean(String(question.body[key]).trim()))
    || question.body.audio_required === true;
}
type AttemptResult = {
  correct: boolean;
  mastery_gain: number;
  projected_score: number;
  projected_band: string;
  next_review_days: number;
  reward_hook: string;
  animation_hook: string;
  feedback: string;
  explanation: string;
  evidence_event: string;
  companion_prompt: string;
  mock_assessment?: MockAssessmentSummary;
};
type RuntimeFlags = {
  flags: Record<string, boolean>;
};
type MissionRoute = {
  studentId: string;
  worldKey: string;
  activityId: string;
  mockAssessmentId: string;
  assessmentMode: string;
  hasRequestedStudent: boolean;
};
type LessonStep = {
  step_id?: string;
  kind?: string;
  child_prompt?: string;
  learning_purpose?: string;
  audio_script?: string;
  audio_url?: string;
  audio_asset_id?: string;
  audio_ref?: string;
  narration_url?: string;
  visual_model?: string;
  animation_hook?: string;
  estimated_seconds?: number;
};

const API = process.env.NEXT_PUBLIC_API_URL;

function worldReward(year: number) {
  const rewards: Record<number, { symbol: string; building: string; complete: string }> = {
    1: { symbol: "🌱", building: "Growing a wonder seed", complete: "Your wonder seed bloomed!" },
    2: { symbol: "📖", building: "Restoring a storybook", complete: "Your storybook opened!" },
    3: { symbol: "🧭", building: "Charting a new island", complete: "Your new island is mapped!" },
    4: { symbol: "🥚", building: "Charging an invention egg", complete: "Your invention creature hatched!" },
    5: { symbol: "🏙️", building: "Powering an orbit district", complete: "Your orbit district is online!" },
    6: { symbol: "🔷", building: "Forging a mastery crystal", complete: "Your mastery crystal is complete!" },
    7: { symbol: "⚛️", building: "Stabilising a future core", complete: "Your future core is stable!" },
  };
  return rewards[year] || { symbol: "✨", building: "Building your learning world", complete: "Your world has grown!" };
}

function readMissionRoute(): MissionRoute {
  if (typeof window === "undefined") {
    return { studentId: DEFAULT_STUDENT_ID, worldKey: "", activityId: "", mockAssessmentId: "", assessmentMode: "", hasRequestedStudent: false };
  }
  const params = new URLSearchParams(window.location.search);
  const requestedStudent = params.get("studentId") || "";
  return {
    studentId: requestedStudent || DEFAULT_STUDENT_ID,
    worldKey: params.get("world") || "",
    activityId: params.get("activityId") || "",
    mockAssessmentId: params.get("mockAssessmentId") || "",
    assessmentMode: params.get("mode") || "",
    hasRequestedStudent: Boolean(requestedStudent),
  };
}

function supportPlanItems(adaptations: MissionConfig["runtime_adaptations"] | undefined): Array<[string, string]> {
  const reasons = Array.isArray(adaptations?.reasons) ? adaptations.reasons.slice(0, 2) : [];
  return [
    adaptations?.session_length === "short" ? ["Short mission", "A smaller set keeps effort focused and finishable."] : null,
    adaptations?.animation_tier === "static" || adaptations?.reduced_motion ? ["Still mode", "Movement can be replaced with static steps that keep the same learning evidence."] : null,
    adaptations?.animation_tier === "low" && !adaptations?.reduced_motion ? ["Calm movement", "Animations stay quieter so the task remains the focus."] : null,
    adaptations?.audio_support ? ["Audio-first", "Replay teaching audio whenever listening support helps."] : null,
    adaptations?.reading_support || adaptations?.simple_text ? ["Reading support", "Extra plain-language cues stay visible during practice."] : null,
    adaptations?.scaffold_level === "step_by_step" ? ["Step-by-step", "The mission teaches, models and checks before independent practice."] : null,
    adaptations?.scaffold_level === "chunked" || adaptations?.scaffold_level === "high_structure" ? ["Chunked route", "The mission keeps the routine predictable and breaks the task into manageable pieces."] : null,
    adaptations?.visual_guide ? ["Visual guide", "Look, choose or build, then send: the steps stay visible."] : null,
    adaptations?.large_targets ? ["Large controls", "Buttons and choices are easier to hit with touch, mouse, switch or eye-gaze."] : null,
    adaptations?.simplified_controls ? ["Simple controls", "Only the controls needed for this step are emphasised."] : null,
    adaptations?.switch_access ? ["Switch access", "Scanning controls can be turned on from the support bar."] : null,
    adaptations?.high_contrast ? ["High contrast", "Important text and controls use stronger contrast."] : null,
    ...reasons.map((reason) => ["SENCO reason", String(reason)] as [string, string]),
  ].filter((item): item is [string, string] => Boolean(item));
}

function activeSupportBadges(adaptations: MissionConfig["runtime_adaptations"] | undefined) {
  return [
    adaptations?.session_length === "short" ? "short" : "",
    adaptations?.reduced_motion || adaptations?.animation_tier === "static" ? "still" : "",
    adaptations?.audio_support ? "audio" : "",
    adaptations?.reading_support || adaptations?.simple_text ? "reading" : "",
    adaptations?.large_targets ? "large targets" : "",
    adaptations?.switch_access ? "switch" : "",
  ].filter(Boolean);
}

export default function Mission() {
  const [route, setRoute] = useState<MissionRoute>(() => readMissionRoute());
  const studentId = route.studentId;
  const [questions, setQuestions] = useState<Q[] | null>(null);
  const [mission, setMission] = useState<MissionConfig | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "unavailable" | "access-required">("loading");
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [charge, setCharge] = useState(0);
  const [xp, setXp] = useState(0);
  const [confidence, setConfidence] = useState<0 | 2 | 3 | 4>(0);
  const [responseMode, setResponseMode] = useState<"interactive" | "keyboard">("interactive");
  const [projectedBand, setProjectedBand] = useState("Unknown");
  const [mockSummary, setMockSummary] = useState<AttemptResult["mock_assessment"]>(undefined);
  const [lessonIdx, setLessonIdx] = useState(0);
  const [lessonComplete, setLessonComplete] = useState(false);
  const [paused, setPaused] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [mood, setMood] = useState<DinoMood>("idle");
  const [message, setMessage] = useState("Loading configured mission content...");
  const [hintCount, setHintCount] = useState(0);
  const showHint = hintCount > 0;
  const [saveState, setSaveState] = useState<"idle" | "saving" | "uncertain" | "rejected">("idle");
  const [rewardMoment, setRewardMoment] = useState<string | null>(null);
  const [journeyEntries, setJourneyEntries] = useState<JourneyEntry[]>([]);
  const [awaitingContinue, setAwaitingContinue] = useState(false);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [correctFlash, setCorrectFlash] = useState(false);
  const [hatched, setHatched] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [baselineProgress, setBaselineProgress] = useState<DiagnosticBaseline | null>(null);
  const [nextActivity, setNextActivity] = useState<NextActivityDecision | null>(null);
  const [progressReport, setProgressReport] = useState<ProgressReport | null>(null);
  const [progressState, setProgressState] = useState<"not-requested" | "loading" | "ready" | "unavailable">("not-requested");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [readingReduced, setReadingReduced] = useState(false);
  const [visualGuide, setVisualGuide] = useState(false);
  const [switchAccess, setSwitchAccess] = useState(false);
  const [switchLabel, setSwitchLabel] = useState("");
  const [mute, setMute] = useState(false);
  const [sparks, setSparks] = useState<{ id: number; dx: number; dy: number }[]>([]);
  const narrationAssets = useNarrationAssets();
  const startRef = useRef(0);

  const lessonStartRef = useRef(0);
  const sparkId = useRef(0);
  const requestSequence = useRef(0);
  const attemptInFlight = useRef(false);
  // A retry is the same evidence, not a new attempt. Keep the serialized payload
  // (including timing, confidence and support) unchanged until acknowledged.
  const pendingAttempt = useRef<string | null>(null);
  const lessonStepInFlight = useRef(false);
  const completionInFlight = useRef(false);

  const clientRequestId = useCallback((kind: string) => {
    requestSequence.current += 1;
    const uuid = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${requestSequence.current}`;
    return `${kind}-${studentId}-${uuid}`;
  }, [studentId]);

  const recordLearningEvent = useCallback(async (eventType: string, payload: Record<string, unknown>) => {
    if (!API || !studentId) return;
    try {
      await fetch(`${API}/v1/learning/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...pupilSessionHeaders(studentId) },
        body: JSON.stringify({ id: clientRequestId("event"), student_id: studentId, event_type: eventType, payload }),
        keepalive: true,
      });
    } catch {
      // Event telemetry must never interrupt the learning interaction.
    }
  }, [clientRequestId, studentId]);

  function expectedValue(question: MissionConfig["questions"][number]) {
    const answer = question.expected_answer;
    const value = answer?.value;
    if (typeof value === "number" || typeof value === "string") return value;
    const sequence = answer?.sequence ?? value;
    if (Array.isArray(sequence) && sequence.every((item) => typeof item === "string" || typeof item === "number")) {
      if (!answer?.sequence && question.format === "word-build") return sequence.join("");
      return JSON.stringify(question.format === "coordinate-plot" ? sequence : sequence.map(String));
    }
    if (question.format === "fair-test-plan" && typeof answer?.change === "string" && typeof answer?.measure === "string" && Array.isArray(answer?.keep_same)) {
      return JSON.stringify({ change: answer.change, measure: answer.measure, keep_same: answer.keep_same.map(String).sort() });
    }
    if (["pattern-sort", "fraction-wall"].includes(question.format) && value && typeof value === "object" && !Array.isArray(value)) return JSON.stringify(value);
    if (question.format === "trace-path" && Array.isArray(answer?.rubric)) return "trace-path-complete";
    return undefined;
  }

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) setRoute(readMissionRoute()); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadMission() {
      setQuestions(null);
      setMission(null);
      completionInFlight.current = false;
      pendingAttempt.current = null;
      attemptInFlight.current = false;
      setSaveState("idle");
      setHintCount(0);
      setIdx(0);
      setInput("");
      setResults([]);
      setMockSummary(undefined);
      setHatched(false);
      setRewardMoment(null);
      setJourneyEntries([]);
      setAwaitingContinue(false);
      setProgressReport(null);
      setProgressState("not-requested");
      setLoadState("loading");
      setMessage("Loading configured mission content...");
      if (!studentId) {
        if (!cancelled) {
          setLoadState("access-required");
          setMessage("Use a pupil login card or family profile to start a mission.");
        }
        return;
      }
      if (API) {
        try {
          if (!route.hasRequestedStudent) {
            const flagsRes = await fetch(`${API}/v1/runtime/flags`);
            const flags = flagsRes.ok ? ((await flagsRes.json()) as RuntimeFlags) : null;
            if (flags?.flags?.public_demo_learner_enabled !== true) {
              if (!cancelled) {
                setLoadState("access-required");
                setMessage("Use a pupil login card or family profile to start a real mission.");
              }
              return;
            }
          }
          const params = new URLSearchParams({ studentId });
          if (route.mockAssessmentId) params.set("mockAssessmentId", route.mockAssessmentId);
          else if (route.activityId) params.set("activityId", route.activityId);
          else if (route.worldKey) params.set("world", route.worldKey);
          if (route.assessmentMode) params.set("mode", route.assessmentMode);
          const res = await fetch(`${API}/v1/learning/mission?${params.toString()}`, {
            headers: pupilSessionHeaders(studentId),
          });
          if (res.ok) {
            const data = (await res.json()) as MissionConfig;
            const configured = (data.questions || [])
              .map((question) => {
                const body = question.body || {};
                const a = Number(body.a);
                const b = Number(body.b);
                const rawExpected = expectedValue(question);
                const expected = typeof rawExpected === "number" || typeof rawExpected === "string" ? rawExpected : Number(rawExpected);
                const choices = Array.isArray(body.choices) ? body.choices.filter((choice) => typeof choice === "number" || typeof choice === "string") as Array<number | string> : [];
                const hasTextInteraction = typeof expected === "string";
                const hasExplicitNumberInput = body.input === "number" || body.response === "number";
                const hasGraphData = ["graph-reader", "graph-table-investigation"].includes(question.format) && (Array.isArray(body.data) || Array.isArray(body.data_points) || Array.isArray(body.data_table));
                const hasColumnCalculation = question.format === "column-calculate" && Array.isArray(body.operands) && body.operands.length === 2;
                const hasOperationModel = question.format === "operation-model" && (Number.isFinite(Number(body.start)) || typeof body.expression === "string");
                const hasProblemMap = question.format === "problem-map" && Array.isArray(body.quantity_cards) && body.quantity_cards.length > 0;
                const hasPartWholeModel = question.format === "part-whole-build" && Number.isFinite(Number(body.whole)) && Number.isFinite(Number(body.given_part));
                const hasNumericInteraction = Number.isFinite(expected) && ((Number.isFinite(a) && Number.isFinite(b)) || choices.length > 0 || hasExplicitNumberInput || hasGraphData || hasColumnCalculation || hasOperationModel || hasProblemMap || hasPartWholeModel);
                if (!hasTextInteraction && !hasNumericInteraction) return null;
                return {
                  id: question.id,
                  questionVersion: question.question_version,
                  responseKind: question.response_kind,
                  a: Number.isFinite(a) ? a : undefined,
                  b: Number.isFinite(b) ? b : undefined,
                  expected,
                  prompt: String(body.prompt || `${a} x ${b}`),
                  objectiveId: question.objective_id,
                  format: question.format,
                  choices,
                  hints: question.hints || [],
                  body,
                  explanation: question.explanation || "",
                  selectionReason: question.selection_reason || "Chosen to balance challenge, coverage and fresh evidence.",
                };
              })
              .filter(Boolean) as Q[];
            if (!cancelled && configured.length) {
              setMission(data);
              setQuestions(configured);
              void recordLearningEvent("assessment_started", {
                activity_id: data.activity.id,
                objective_id: data.objective.id,
                blueprint: data.assessment_blueprint,
                question_ids: configured.map((question) => question.id),
                runtime_adaptations: data.runtime_adaptations,
              });
              const activeSupports = supportPlanItems(data.runtime_adaptations);
              if (activeSupports.length > 0) {
                void recordLearningEvent("runtime_adaptations_applied", {
                  activity_id: data.activity.id,
                  objective_id: data.objective.id,
                  supports: activeSupports.map(([title]) => title),
                  runtime_adaptations: data.runtime_adaptations,
                });
              }
              const sequence = Array.isArray(data.activity?.interaction?.teaching_sequence)
                ? (data.activity.interaction.teaching_sequence as LessonStep[])
                : [];
              setLessonIdx(0);
              setLessonComplete(sequence.length === 0);
              if (data.runtime_adaptations?.reduced_motion || data.runtime_adaptations?.animation_tier === "low" || data.runtime_adaptations?.animation_tier === "static") {
                setReducedMotion(true);
              }
              setHighContrast(Boolean(data.runtime_adaptations?.high_contrast));
              setReadingReduced(Boolean(data.runtime_adaptations?.simple_text));
              setVisualGuide(Boolean(data.runtime_adaptations?.visual_guide));
              setSwitchAccess(Boolean(data.runtime_adaptations?.switch_access));
              setMessage(String(data.activity?.prompt || "Answer to send energy through the portal."));
              startRef.current = Date.now();
              setLoadState("ready");
              return;
            }
          }
        } catch {
          // The unavailable state is explicit so missing configuration is not hidden by fake content.
        }
      }
      if (!cancelled) {
        setQuestions(null);
        setLoadState("unavailable");
      }
    }
    loadMission();
    return () => {
      cancelled = true;
    };
  }, [recordLearningEvent, route.activityId, route.assessmentMode, route.hasRequestedStudent, route.mockAssessmentId, route.worldKey, studentId]);

  const total = questions?.length ?? 0;
  const q = questions ? questions[Math.min(idx, total - 1)] : null;

  useEffect(() => {
    if (!switchAccess) {
      return;
    }

    let activeIndex = 0;
    let highlightedTarget: HTMLElement | null = null;
    const region = paused ? "[role='dialog']" : "[data-switch-region]";
    const targets = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          `${region} button:not(:disabled), ${region} a[href], ${region} [tabindex='0']`,
        ),
      ).filter((target) => target.offsetParent !== null && !target.closest("[inert], fieldset[disabled]") && target.getAttribute("aria-disabled") !== "true");
    const focusTarget = () => {
      const available = targets();
      if (!available.length) {
        highlightedTarget = null;
        setSwitchLabel("No available controls");
        return;
      }
      activeIndex %= available.length;
      const target = available[activeIndex];
      highlightedTarget = target;
      target.focus({ preventScroll: true });
      setSwitchLabel(target.getAttribute("aria-label") || target.textContent?.trim() || "Current control");
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSwitchAccess(false);
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        if (!event.repeat) {
          const available = targets();
          if (highlightedTarget && available.includes(highlightedTarget)) highlightedTarget.click();
          else focusTarget(); // A removed/disabled control must not activate its replacement.
        }
      }
    };

    focusTarget();
    const scan = window.setInterval(() => {
      activeIndex += 1;
      focusTarget();
    }, 1_200);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.clearInterval(scan);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [switchAccess, q?.id, awaitingContinue, idx, lessonIdx, lessonComplete, saveState, paused]);
  const done = idx >= total;
  const teachingSequence = Array.isArray(mission?.activity?.interaction?.teaching_sequence)
    ? (mission.activity.interaction.teaching_sequence as LessonStep[])
    : [];
  const lessonStep = teachingSequence[Math.min(lessonIdx, Math.max(0, teachingSequence.length - 1))];
  const lessonAudioURL = lessonStep ? resolveNarrationFields(lessonStep as Record<string, unknown>, narrationAssets) : "";
  const inLesson = teachingSequence.length > 0 && !lessonComplete;

  useEffect(() => {
    if (q) void recordLearningEvent("question_seen", { question_id: q.id, objective_id: q.objectiveId, position: idx + 1 });
  }, [idx, q, recordLearningEvent]);

  useEffect(() => {
    lessonStartRef.current = Date.now();
  }, [lessonIdx]);

  useEffect(() => setMuted(mute), [mute]);

  useEffect(() => {
    if (loadState === "ready" && total > 0 && done && !hatched && !completionInFlight.current) {
      completionInFlight.current = true;
      void recordLearningEvent("assessment_completed", {
        activity_id: mission?.activity?.id || "",
        objective_id: mission?.objective?.id || "",
        question_count: total,
        correct_count: results.filter(Boolean).length,
      });
      void Promise.all([
        getDiagnosticBaseline(studentId),
        getNextActivity(studentId),
        getProgress(studentId),
        getWorldState(studentId, mission?.world?.key),
      ]).then(([baseline, next, progress, worldState]) => {
        setBaselineProgress(baseline);
        setNextActivity(next);
        setProgressReport(progress);
        setProgressState(progress ? "ready" : "unavailable");
        if (worldState) {
          setMission((current) => current ? { ...current, world_state: worldState } : current);
        }
      }).catch(() => setProgressState("unavailable"));
      queueMicrotask(() => setProgressState("loading"));
      const t = setTimeout(() => {
        setHatched(true);
        setMood("celebrate");
        sfx.hatch();
      }, 700);
      return () => clearTimeout(t);
    }
  }, [done, hatched, loadState, mission?.activity?.id, mission?.objective?.id, mission?.world?.key, recordLearningEvent, results, studentId, total]);

  const accuracy = useMemo(
    () => (results.length ? Math.round((results.filter(Boolean).length / results.length) * 100) : 0),
    [results]
  );

  function emitSparks() {
    const quietCelebration = mission?.runtime_adaptations?.celebration_intensity === "quiet" || mission?.runtime_adaptations?.animation_tier === "low";
    if (quietCelebration || reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const burst = Array.from({ length: quietCelebration ? 4 : 10 }, () => ({
      id: sparkId.current++,
      dx: (Math.random() - 0.5) * 180,
      dy: -40 - Math.random() * 120,
    }));
    setSparks((s) => [...s, ...burst]);
    setTimeout(() => setSparks((s) => s.slice(burst.length)), 800);
  }

  async function submit() {
    if (done || awaitingContinue || input === "" || !q || attemptInFlight.current) return;
    if (!q.questionVersion) {
      setMessage("This mission is being updated. Please reopen it shortly.");
      setSaveState("rejected");
      return;
    }
    const given = Number(input);
    const isTextAnswer = typeof q.expected === "string";
    const kind = q.responseKind || (isTextAnswer ? "text" : "number");
    let value: unknown;
    if (!pendingAttempt.current) {
      try {
        value = kind === "number" ? given : ["sequence", "mapping"].includes(kind) ? JSON.parse(input) : input;
        if (kind === "number" && (!input.trim() || !Number.isFinite(given))) throw new Error();
        if (kind === "sequence" && (!Array.isArray(value) || !value.length)) throw new Error();
        if (kind === "mapping" && (!value || typeof value !== "object" || Array.isArray(value) || !Object.keys(value).length)) throw new Error();
      } catch {
        setMessage("Please check your answer, or use the activity controls to build it.");
        return;
      }
    }
    attemptInFlight.current = true;
    setSaveState("saving");
    const ms = Date.now() - startRef.current;
    let result: AttemptResult | null = null;

    if (API) {
      try {
        if (!pendingAttempt.current) pendingAttempt.current = JSON.stringify({
            id: clientRequestId("attempt"),
            student_id: studentId,
            objective_id: q.objectiveId,
            question_id: q.id,
            question_version: q.questionVersion,
            response: { kind, value },
            mock_assessment_id: route.mockAssessmentId || undefined,
            format: q.format,
            response_mode: responseMode,
            ms,
            hint_used: showHint,
            confidence,
          });
        const res = await fetch(`${API}/v1/learning/attempt`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...pupilSessionHeaders(studentId) },
          body: pendingAttempt.current,
          signal: AbortSignal.timeout(15_000),
        });
        if (res.ok) {
          const body = await res.json();
          if (typeof body?.correct === "boolean") result = body as AttemptResult;
        } else if ([400, 401, 403, 404, 409, 422].includes(res.status)) {
          const body = await res.json();
          setMessage(typeof body.error === "string" ? body.error : "This answer could not be marked. Please choose another mission.");
          setSaveState("rejected");
          attemptInFlight.current = false;
          return;
        }
      } catch {
        result = null;
      }
    }
    if (!result) {
      setMood("encourage");
      setMessage("I could not confirm that your answer was saved. Your answer is still here. Retry saving before changing it.");
      setSaveState("uncertain");
      attemptInFlight.current = false;
      return;
    }

    pendingAttempt.current = null;
    setSaveState("idle");

    const correct = result.correct;
    if (result.mock_assessment) setMockSummary(result.mock_assessment);
    setProjectedBand(result.projected_band);
    if (correct) {
      setXp((x) => x + result.mastery_gain);
      setCharge((c) => c + 1);
      setResults((r) => [...r, true]);
      setMood(result.animation_hook || result.reward_hook ? "celebrate" : "happy");
      setMessage(result.feedback);
      setRewardMoment(result.reward_hook?.includes("compass") ? "Compass fragment collected" : "Discovery added to your journey");
      setJourneyEntries((entries) => [...entries, { prompt: q.prompt, feedback: result!.explanation || result!.feedback, repaired: showHint }]);
      setCorrectFlash(true);
      setTimeout(() => setCorrectFlash(false), 450);
      emitSparks();
      sfx.correct();
      sfx.charge();
      setAwaitingContinue(true);
    } else {
      setResults((r) => [...r, false]);
      setMood("encourage");
      setMessage(result.feedback || result.companion_prompt || `Try again: ${q.prompt}`);
      setRewardMoment("Repair route opened");
      if (route.mockAssessmentId) {
        setHintCount(0);
        setMessage(result.feedback || "That answer is saved. Let’s use the next question to build a clearer picture.");
        startRef.current = Date.now();
        setConfidence(0);
        setIdx((i) => i + 1);
        setJourneyEntries((entries) => [...entries, { prompt: q.prompt, feedback: result!.feedback, repaired: false }]);
      }
      sfx.gentle();
      setInput("");
    }
    attemptInFlight.current = false;
  }

  useEffect(() => {
    if (switchAccess) return;
    if (awaitingContinue) feedbackRef.current?.focus();
    else if (idx >= total) summaryRef.current?.focus();
    else if (idx > 0) questionRef.current?.focus();
  }, [awaitingContinue, idx, total, switchAccess]);

  function revealHint() {
    if (!q || pendingAttempt.current || attemptInFlight.current || route.mockAssessmentId || hintCount >= q.hints.length) return;
    setHintCount(count => count + 1);
    void recordLearningEvent("hint_opened", { question_id: q.id, objective_id: q.objectiveId, hint_index: hintCount, reason: "pupil_requested" });
  }

  function continueJourney() {
    setAwaitingContinue(false);
    setInput("");
    setHintCount(0);
    setRewardMoment(null);
    setConfidence(0);
    startRef.current = Date.now();
    setIdx((i) => i + 1);
  }

  function key(k: string) {
    if (pendingAttempt.current || attemptInFlight.current) return;
    sfx.tap();
    if (k === "back") setInput((v) => v.slice(0, -1));
    else if (input.length < 4) setInput((v) => v + k);
  }

  function choose(choice: number | string) {
    if (pendingAttempt.current || attemptInFlight.current) return;
    sfx.tap();
    setInput(String(choice));
  }

  function changeResponseMode(mode: "interactive" | "keyboard") {
    if (pendingAttempt.current || attemptInFlight.current) return;
    setResponseMode(mode);
    setInput("");
    void recordLearningEvent("response_mode_changed", {
      activity_id: mission?.activity?.id || "",
      question_id: q?.id || "",
      response_mode: mode,
    });
  }

  function again() {
    completionInFlight.current = false;
    startRef.current = Date.now();
    setIdx(0);
    setInput("");
    setCharge(0);
    setXp(0);
    setConfidence(0);
    setHintCount(0);
    setProjectedBand("Unknown");
    setMockSummary(undefined);
    setRewardMoment(null);
    setJourneyEntries([]);
    setAwaitingContinue(false);
    setLessonIdx(0);
    setLessonComplete(teachingSequence.length === 0);
    setResults([]);
    setNextActivity(null);
    setHatched(false);
    setMood("idle");
    setMessage(mission?.activity?.prompt || "Answer to send energy through the portal.");
    void recordLearningEvent("mission_restarted", { activity_id: mission?.activity?.id || "", objective_id: mission?.objective?.id || "" });
  }

  async function readAloud(audioURL: string) {
    if (!audioURL.trim()) return;
    void recordLearningEvent("audio_replay", { activity_id: mission?.activity?.id || "", question_id: q?.id || "", lesson_step: lessonStep?.step_id || "" });
    const played = await playProducedAudio(audioURL);
    if (!played) {
      setMessage(mute ? "Sound is muted. Turn sound on to hear the studio narration." : "Studio audio did not play. You can try again or keep learning with the text and visual model.");
      void recordLearningEvent("audio_playback_failed", {
        activity_id: mission?.activity?.id || "",
        question_id: q?.id || "",
        lesson_step: lessonStep?.step_id || "",
        muted: mute,
      });
    }
  }

  async function continueLesson() {
    if (!mission || !lessonStep || lessonStepInFlight.current) return;
    lessonStepInFlight.current = true;
    try {
      if (API) {
        try {
        const supportUsed = [
          adaptations?.audio_support ? "audio_support" : "",
          adaptations?.reading_support ? "reading_support" : "",
          adaptations?.reduced_motion ? "reduced_motion" : "",
          adaptations?.scaffold_level && adaptations.scaffold_level !== "standard" ? adaptations.scaffold_level : "",
          focusMode ? "focus_mode" : "",
        ].filter(Boolean);
        const response = await fetch(`${API}/v1/learning/lesson-step`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...pupilSessionHeaders(studentId) },
          body: JSON.stringify({
            id: clientRequestId("lesson-step"),
            student_id: studentId,
            activity_id: mission.activity.id,
            objective_id: mission.objective.id,
            step_id: lessonStep.step_id || `step-${lessonIdx + 1}`,
            step_kind: lessonStep.kind || "",
            status: "completed",
            duration_ms: Math.max(0, Date.now() - lessonStartRef.current),
            support_used: supportUsed,
          }),
        });
          if (!response.ok) {
            setMessage("I could not save this learning step. Please try again.");
            return;
          }
        } catch {
          setMessage("I could not save this learning step. Please try again.");
          return;
        }
      }
      if (lessonIdx + 1 >= teachingSequence.length) {
        setLessonComplete(true);
        setMessage(String(mission?.activity?.prompt || "Now show what you can do."));
        return;
      }
      setLessonIdx((value) => value + 1);
    } finally {
      lessonStepInFlight.current = false;
    }
  }

  if (!q && loadState === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#241f56] to-[#1a3a3d]">
        <Dino mood="thinking" size={140} />
      </main>
    );
  }

  if (!q) {
    if (loadState === "access-required") {
      return (
        <main className={missionUnavailableClass}>
          <section className="max-w-lg rounded-2xl bg-white/10 p-8 text-center backdrop-blur">
            <h1 className="font-display text-3xl font-semibold">Open your child profile first</h1>
            <p className="mt-3 text-sm leading-6 text-white/70">
              NexusLearn keeps live learning behind school, tutor or parent-issued access so the mission can adapt to the right child.
            </p>
            <Link href="/login" className="btn-pop mt-6 inline-block bg-sun px-6 py-3 text-ink">
              Pupil login
            </Link>
          </section>
        </main>
      );
    }
    return (
      <main className={missionUnavailableClass}>
        <section className="max-w-lg rounded-2xl bg-white/10 p-8 text-center backdrop-blur">
          <h1 className="font-display text-3xl font-semibold">Mission content unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-white/70">
            This learner needs a published configured activity with playable numeric questions before the mission can start.
          </p>
          <Link href="/play" className="btn-pop mt-6 inline-block bg-sun px-6 py-3 text-ink">
            Back to worlds
          </Link>
        </section>
      </main>
    );
  }

  const worldAccent = String(mission?.world?.config?.accent || "#ffbf45");
  const realm = String(mission?.world?.config?.realm || mission?.world?.name || "Nexus mission");
  const worldFocus = String(mission?.world?.config?.focus || mission?.world?.theme || "Configured learning mission");
  const adaptations = mission?.runtime_adaptations;
  const reward = worldReward(Number(mission?.world?.year_group || 0));
  const companionName = String(mission?.world?.config?.companion || "Nixi");
  const savedArtefacts = Array.isArray(mission?.world_state?.state?.artefacts) ? mission.world_state.state.artefacts.length : 0;
  const questionAudio = questionAudioURL(q, narrationAssets);
  const questionAudioScriptText = questionAudioScript(q);
  const questionAudioPending = questionHasAudioReference(q);
  const activeSupportPlan = supportPlanItems(adaptations);
  const supportBadges = activeSupportBadges(adaptations);
  const progressPct = total ? Math.round((charge / total) * 100) : 0;
  const missionStyle = {
    "--world-accent": worldAccent,
  } as CSSProperties;
  const nextMissionURL = nextActivity
    ? `/play/mission?${new URLSearchParams({
        studentId,
        activityId: nextActivity.activity_id,
        mode: nextActivity.assessment_mode,
      }).toString()}`
    : "";
  const journeyStage = done ? "grow" : inLesson ? "learn" : "practise";
  const journeyContext = `${mission?.objective?.subject || "Learning"} · Year ${mission?.objective?.year || mission?.world?.year_group || "—"} · ${mission?.objective?.topic || "today's mission"}`;
  const hasLessonAudio = Boolean(lessonAudioURL || lessonStep?.audio_script);
  const hasQuestionAudio = Boolean(questionAudio || questionAudioScriptText || questionAudioPending);

  return (
    <main
      className={`min-h-screen overflow-x-hidden bg-gradient-to-b from-[#241f56] via-[#2e2870] to-[#1a3a3d] px-4 py-6 text-white ${
        reducedMotion ? "reduced-motion" : ""
      } ${
        highContrast ? "high-contrast" : ""
      } ${
        readingReduced ? "reading-reduced" : ""
      } ${
        adaptations?.large_targets ? "large-targets" : ""
      }`}
      style={missionStyle}
    >
      <div className="mission-ambient pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-[8%] top-[12%] h-56 w-56 rounded-full bg-[var(--world-accent)] opacity-12 blur-3xl" />
        <div className="absolute right-[4%] top-[18%] h-72 w-72 rounded-full bg-[#55cbd3] opacity-10 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.08))]" />
      </div>

      <ChildJourneyChrome
        active={journeyStage}
        context={journeyContext}
        backHref="/play"
        backLabel="Exit"
        actionHref="#mission-support"
        actionLabel="Support & audio"
      />

      {/* top bar */}
      <div className="relative z-10 mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <Link
          href="/play"
          onClick={() => void recordLearningEvent("mission_exited", { activity_id: mission?.activity?.id || "", question_id: q?.id || "", completed_questions: results.length })}
          className="btn-pop bg-white/10 px-4 py-2 text-sm"
        >
          Exit
        </Link>
        <div className="font-display order-3 flex w-full flex-wrap items-center justify-center gap-2 text-sm md:gap-3">
          <span className="mission-status-pill rounded-full bg-sun/20 px-4 py-1.5 text-sun">{xp} XP</span>
          <span className="mission-status-pill rounded-full bg-white/10 px-4 py-1.5 text-white/80">{progressPct}% charged</span>
          <span className={missionStatusClass}>{savedArtefacts} world artefacts</span>
          {adaptations?.session_length === "short" && <span className="mission-status-pill rounded-full bg-[#55cbd3]/20 px-4 py-1.5 text-[#9df5fa]">Short mission</span>}
          {(adaptations?.animation_tier === "low" || adaptations?.animation_tier === "static" || adaptations?.reduced_motion) && <span className={missionStatusClass}>Calm mode</span>}
          {adaptations?.large_targets && <span className={missionStatusClass}>Large controls</span>}
          {adaptations?.switch_access && <span className="mission-status-pill rounded-full bg-[#ffdf8a]/18 px-4 py-1.5 text-[#ffdf8a]">Switch ready</span>}
        </div>
        <div className="ml-auto flex max-w-[calc(100%_-_4.5rem)] flex-wrap justify-end gap-2">
          <button
            onClick={() => {
              setPaused(true);
              void recordLearningEvent("mission_paused", { activity_id: mission?.activity?.id || "", question_id: q?.id || "" });
            }}
            className="btn-pop bg-[#3b386f] px-3 py-2 text-sm"
          >
            Pause
          </button>
          {[
            { support: "focus_mode", label: "Focus", enabled: focusMode, update: setFocusMode, activeClass: "bg-sun text-ink" },
            { support: "mute", label: mute ? "Sound off" : "Sound on", enabled: mute, update: setMute, activeClass: "bg-[#3b386f]", ariaLabel: mute ? "Unmute sounds" : "Mute sounds" },
            { support: "reduced_motion", label: "Calm", enabled: reducedMotion, update: setReducedMotion, activeClass: "bg-sun text-ink", title: "Reduced motion" },
            { support: "high_contrast", label: "Contrast", enabled: highContrast, update: setHighContrast, activeClass: "bg-white text-black" },
            { support: "simple_text", label: "Simple text", enabled: readingReduced, update: setReadingReduced, activeClass: "bg-[#55cbd3] text-ink" },
            { support: "visual_guide", label: "Visual guide", enabled: visualGuide, update: setVisualGuide, activeClass: "bg-[#7fe7d7] text-ink" },
            { support: "switch_access", label: "Switch access", enabled: switchAccess, update: setSwitchAccess, activeClass: "bg-[#ffdf8a] text-ink" },
          ].map(control => (
            <button
              key={control.support}
              type="button"
              onClick={() => {
                const enabled = !control.enabled;
                control.update(enabled);
                // State updaters must remain pure; log once in the user event.
                void recordLearningEvent("support_changed", { support: control.support, enabled, source: "child_control" });
              }}
              className={`btn-pop px-3 py-2 text-sm ${control.enabled ? control.activeClass : "bg-[#3b386f]"}`}
              aria-pressed={control.support === "mute" ? undefined : control.enabled}
              aria-label={control.ariaLabel}
              title={control.title}
            >
              {control.label}
            </button>
          ))}
        </div>
      </div>

      <section className="relative z-10 mx-auto mt-5 max-w-6xl overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/8 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.18em] text-[var(--world-accent)]">{realm}</p>
            <h1 className="font-display mt-1 text-2xl font-semibold md:text-4xl">{mission?.activity?.title || "Configured Mission"}</h1>
            <p className="reading-extra mission-world-focus mt-2 inline-block max-w-3xl rounded-xl bg-[#17233f] px-3 py-1.5 text-sm leading-6 text-white">{worldFocus}</p>
          </div>
          <div className="reading-extra grid grid-cols-3 gap-2 text-center">
            {[
              ["Objective", mission?.objective?.topic || "Skill"],
              ["Format", mission?.activity?.template_id || "Activity"],
              ["Review", `${results.length}/${total}`],
            ].map(([label, value]) => (
              <div key={label} className="energy-card rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                <p className="font-display text-xs uppercase tracking-[0.14em] text-white/44">{label}</p>
                <p className="mt-1 max-w-[120px] truncate text-sm font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <nav className="relative z-10 mx-auto mt-4 flex max-w-3xl items-center justify-center gap-2" aria-label="Mission schedule">
        {[
          ["Learn", inLesson],
          ["Practise", !inLesson && !done],
          ["Finish", done],
        ].map(([label, active]) => (
          <span
            key={String(label)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              active ? "bg-[var(--world-accent)] text-ink" : "bg-white/8 text-white/60"
            }`}
            aria-current={active ? "step" : undefined}
          >
            {label}
          </span>
        ))}
      </nav>

      {activeSupportPlan.length > 0 && (
        <section
          className="relative z-10 mx-auto mt-4 max-w-6xl rounded-[1.4rem] border border-[#55cbd3]/35 bg-[#10233f]/82 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)]"
          id="mission-support"
          aria-label="Active support plan"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-display text-xs uppercase tracking-[0.18em] text-[#9df5fa]">Support plan active</p>
              <h2 className="font-display mt-1 text-xl font-semibold text-white">This mission is tuned for you</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-white/72">
                These settings come from the learner profile and can still be adjusted with the support buttons above.
              </p>
              {supportBadges.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2" aria-label="Active support badges">
                  {supportBadges.map((badge) => (
                    <span key={badge} className="rounded-full border border-[#55cbd3]/30 bg-[#55cbd3]/10 px-3 py-1 text-xs font-semibold text-[#c8fbff]">
                      {badge}
                    </span>
                  ))}
                </div>
              )}
              {(hasLessonAudio || hasQuestionAudio) && (
                <div className="mt-3 flex flex-wrap gap-2" aria-label="Audio shortcuts">
                  <a href={`#${inLesson ? "lesson-audio" : "question-audio"}`} className="rounded-full border border-[#ffdf8a]/35 bg-[#ffdf8a]/10 px-3 py-1 text-xs font-semibold text-[#ffdf8a]">
                    Jump to audio replay
                  </a>
                  <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-white/70">Produced studio audio only</span>
                </div>
              )}
            </div>
            <span className="rounded-full bg-[#55cbd3]/18 px-4 py-2 text-sm font-semibold text-[#c8fbff]">
              {activeSupportPlan.length} active support{activeSupportPlan.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {activeSupportPlan.map(([title, detail]) => (
              <article key={`${title}-${detail}`} className="rounded-2xl border border-white/10 bg-white/8 p-3">
                <p className="font-display text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-xs leading-5 text-white/72">{detail}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <details
        className="relative z-10 mx-auto mt-4 max-w-6xl rounded-[1.4rem] border border-white/12 bg-white/8 p-4 text-sm leading-6 text-white/76"
        aria-label="Fair mission promise"
      >
        <summary className="cursor-pointer font-semibold text-white">Your pace. Hints when you need them. No lost progress.</summary>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-[#17233f]/85 p-4">
            <p className="font-display text-sm font-semibold text-[#ffdf8a]">No timer pressure</p>
            <p className="mt-1 text-xs leading-5 text-white/72">Take the thinking time you need. Mastery is never judged by speed.</p>
          </div>
          <div className="rounded-2xl bg-[#17233f]/85 p-4">
            <p className="font-display text-sm font-semibold text-[#ffdf8a]">Mistakes repair the path</p>
            <p className="mt-1 text-xs leading-5 text-white/72">A wrong answer opens a hint, model or retry. You do not lose earned progress.</p>
          </div>
          <div className="rounded-2xl bg-[#17233f]/85 p-4">
            <p className="font-display text-sm font-semibold text-[#ffdf8a]">Use your best route</p>
            <p className="mt-1 text-xs leading-5 text-white/72">Touch, keyboard, switch, pointing, AAC or partner help can all show the same learning.</p>
          </div>
        </div>
      </details>

      <div className={`relative z-10 mx-auto mt-6 grid max-w-6xl items-start gap-8 ${focusMode ? "grid-cols-1" : "md:grid-cols-[0.95fr_1.05fr]"}`}>
        <div className={`relative flex flex-col items-center ${focusMode ? "hidden" : ""}`}>
          <MissionJourney
            key={mission?.activity?.id}
            style={adaptations?.reward_style}
            year={Number(mission?.world?.year_group || 1)}
            total={total}
            entries={journeyEntries}
            currentPrompt={q?.prompt || "Your discoveries are ready to revisit."}
            quiet={reducedMotion || adaptations?.celebration_intensity === "quiet"}
          />
          <div className="pointer-events-none absolute inset-0 z-10" aria-hidden>
            {sparks.map((s) => (
              <span
                key={s.id}
                className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-[var(--world-accent)]"
                style={{
                  "--dx": `${s.dx}px`,
                  "--dy": `${s.dy}px`,
                  animation: "spark 0.8s ease-out forwards",
                } as CSSProperties}
              />
            ))}
          </div>

          <div className="absolute top-12 h-[310px] w-[310px]">
            <div className="portal-ring anim-portal-spin" />
            <div className="portal-ring anim-portal-pulse scale-75 opacity-60" />
            <span className="anim-orbit absolute left-1/2 top-1/2 h-3 w-3 rounded-full bg-[var(--world-accent)] shadow-[0_0_24px_var(--world-accent)]" />
          </div>

          <div className="relative z-10">
            <svg width="280" height="300" viewBox="0 0 280 300" aria-hidden>
              <path d="M40 190 A100 105 0 0 1 240 190 L240 230 L40 230 Z" fill="rgba(140,200,255,0.12)" stroke="rgba(140,200,255,0.45)" strokeWidth="3" />
              <clipPath id="dome"><path d="M40 190 A100 105 0 0 1 240 190 L240 230 L40 230 Z" /></clipPath>
              <rect clipPath="url(#dome)" x="40" y={230 - (145 * charge) / total} width="200" height={(145 * charge) / total} fill="color-mix(in srgb, var(--world-accent), transparent 65%)" style={{ transition: "all 0.6s cubic-bezier(0.34,1.56,0.64,1)" }} />
              <rect className="anim-scan-line" clipPath="url(#dome)" x="48" y="70" width="184" height="18" fill="rgba(255,255,255,0.18)" />
              <rect x="20" y="228" width="240" height="34" rx="12" fill="#3b3470" />
              <rect x="36" y="262" width="208" height="14" rx="7" fill="#2c2757" />
              {Array.from({ length: total }).map((_, i) => (
                <circle key={i} cx={56 + i * 24} cy="245" r="6" fill={i < charge ? worldAccent : "#1d1a3e"} className={i < charge ? "anim-glow" : ""} />
              ))}
            </svg>
            <div className="absolute left-1/2 top-[108px] -translate-x-1/2">
              <div key={`${charge}-${hatched}`} className={`flex h-28 w-28 items-center justify-center rounded-full bg-white/85 text-6xl shadow-[0_18px_48px_rgba(0,0,0,0.22)] ${charge > 0 ? "anim-egg-rock" : ""} ${hatched ? "anim-pop anim-glow" : ""}`} role="img" aria-label={hatched ? reward.complete : `${reward.building}, ${progressPct}% complete`}>
                {reward.symbol}
              </div>
            </div>
          </div>

          {/* companion + speech */}
          <div className="mt-2 flex items-end gap-3">
            <Dino mood={mood} size={110} />
            <div
              className={`max-w-[260px] rounded-2xl rounded-bl-sm bg-white p-4 text-sm font-medium text-ink shadow-card ${
                correctFlash ? "anim-pop" : ""
              }`}
              role="status"
              aria-live="polite"
            >
              {message}
              <span className="mt-2 block text-xs font-semibold text-grape/65">{companionName}</span>
            </div>
          </div>
        </div>

        {/* RIGHT: question + pad, or summary */}
        {inLesson && lessonStep ? (
          <div data-switch-region className={missionPanelClass}>
            <div className="flex items-center justify-between gap-4">
              <span className="font-display text-xs uppercase tracking-[0.16em] text-[var(--world-accent)]">
                {String(lessonStep.kind || "learning step").replaceAll("_", " ")}
              </span>
              <span className="text-sm text-white/55">Step {lessonIdx + 1}/{teachingSequence.length}</span>
            </div>
            <div className="mt-4 flex gap-1.5" aria-label={`Teaching step ${lessonIdx + 1} of ${teachingSequence.length}`}>
              {teachingSequence.map((_, stepIndex) => (
                <span key={stepIndex} className={`h-2 flex-1 rounded-full ${stepIndex <= lessonIdx ? "bg-[var(--world-accent)]" : "bg-white/15"}`} />
              ))}
            </div>
            <h2 className="font-display mt-7 text-3xl font-semibold leading-tight text-white">
              {lessonStep.child_prompt || "Let’s learn this idea together."}
            </h2>
            {lessonStep.visual_model && (
              <div className="mt-6 rounded-3xl border border-white/10 bg-white/8 p-6">
                <p className="font-display text-sm font-semibold text-[var(--world-accent)]">Watch and notice</p>
                <p className="mt-2 text-base leading-7 text-white/80">{lessonStep.visual_model}</p>
              </div>
            )}
            {adaptations?.scaffold_level === "step_by_step" && lessonStep.learning_purpose && (
              <p className="mt-5 rounded-2xl bg-[#55cbd3]/12 p-4 text-sm leading-6 text-[#c8fbff]">
                We are practising: {lessonStep.learning_purpose}
              </p>
            )}
            <div id="lesson-audio" className="mt-7 flex flex-wrap gap-3">
              {lessonAudioURL && (
                <button
                  type="button"
                  onClick={() => readAloud(lessonAudioURL)}
                  className="btn-pop bg-white/12 px-5 py-3 text-white"
                >
                  Read this aloud
                </button>
              )}
              <button type="button" onClick={continueLesson} className="btn-pop bg-sun px-6 py-3 text-ink">
                {lessonIdx + 1 >= teachingSequence.length ? "Start practice" : "Next step"}
              </button>
            </div>
            {!lessonAudioURL && lessonStep.audio_script && (
              <p className="mt-4 rounded-2xl border border-white/10 bg-white/8 p-3 text-xs leading-5 text-white/72">
                Studio narration is being prepared for this step. We keep the text and visual model available, and we do not use browser text-to-speech as a robotic fallback.
              </p>
            )}
          </div>
        ) : awaitingContinue ? (
          <div data-switch-region ref={feedbackRef} tabIndex={-1} className="journey-feedback" data-testid="mission-reward-moment" aria-label="Discovery saved">
            <p className="journey-eyebrow">Step {idx + 1} explored</p>
            <h2>{rewardMoment}</h2>
            <p>{message}</p>
            {journeyEntries.at(-1)?.feedback !== message && <p>{journeyEntries.at(-1)?.feedback}</p>}
            {hasQuestionAudio && <button type="button" className="btn-pop bg-white/15 px-4 py-3 text-white" onClick={() => readAloud(questionAudio)}>Listen to the question again</button>}
            <button type="button" className="btn-pop bg-sun px-6 py-3 text-ink" onClick={continueJourney}>
              {idx + 1 >= total ? "See my discoveries" : "Next discovery"}
            </button>
          </div>
        ) : !done ? (
          <div ref={questionRef} tabIndex={-1} role="region" aria-label="Mission question" className={missionPanelClass}>
            {rewardMoment === "Repair route opened" && <p className="journey-repair" data-testid="mission-reward-moment" role="status">{message} You can try again or ask for a hint.</p>}
            <div className="flex items-center justify-between text-sm text-white/60">
              <span className="font-display">
              Mission: {mission?.activity?.title || "Configured Mission"} - Q{idx + 1}/{total}
              </span>
              <span>{mission?.world?.name || "World"} - {mission?.objective?.topic || "Configured topic"}</span>
            </div>

            {/* progress dots */}
            <div className="mt-3 flex gap-1.5">
              {Array.from({ length: total }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 flex-1 rounded-full transition-colors ${
                    i < idx ? "bg-leaf" : i === idx && showHint ? "bg-sun" : "bg-white/15"
                  }`}
                />
              ))}
            </div>

            <div className="reading-extra mt-5 grid gap-2 sm:grid-cols-3">
              {[
                ["Recall", "Answer from memory first"],
                ["Repair", showHint ? "Scaffold is open" : "Hint waits if needed"],
                ["Mastery", "Saved to evidence"],
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl bg-[#17233f] px-4 py-3">
                  <p className="font-display text-sm font-semibold text-[#ffdf8a]">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-white/80">{body}</p>
                </div>
              ))}
            </div>

            <details className="reading-extra mt-5 rounded-2xl border border-white/15 bg-[#17233f] px-4 py-3">
              <summary className="cursor-pointer font-display text-sm font-semibold text-[#ffdf8a]">
                Why this question?
              </summary>
              <p className="mt-2 text-xs leading-5 text-white/80">{q.selectionReason}</p>
              {mission?.assessment_blueprint && (
                <p className="mt-2 text-xs leading-5 text-white/75">
                  {mission.assessment_blueprint.mode.replaceAll("_", " ")} set · target challenge {mission.assessment_blueprint.target_difficulty}/10 ·{" "}
                  {mission.assessment_blueprint.formats.length} response format{mission.assessment_blueprint.formats.length === 1 ? "" : "s"}
                </p>
              )}
            </details>

            {(questionAudio || questionAudioScriptText || questionAudioPending) && (
              <div id="question-audio" className="mt-5 rounded-2xl border border-[#7fe7d7]/45 bg-[#17233f] p-4" aria-label="Question audio support">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-sm font-semibold text-[#7fe7d7]">Listen to the question</p>
                    <p className="mt-1 text-xs leading-5 text-white/70">Replay the approved studio narration as often as you need.</p>
                  </div>
                  {questionAudio && (
                    <button type="button" onClick={() => void readAloud(questionAudio)} className="btn-pop bg-white/12 px-4 py-2 text-sm text-white">
                      Hear question
                    </button>
                  )}
                </div>
                {!questionAudio && (questionAudioScriptText || questionAudioPending) && (
                  <p className="mt-3 rounded-xl border border-white/10 bg-white/8 p-3 text-xs leading-5 text-white/75">
                    Studio narration is being prepared for this question. The text and visual route remain available; browser text-to-speech is not used as a robotic fallback.
                  </p>
                )}
              </div>
            )}

            {visualGuide && (
              <div className="mt-5 rounded-2xl border border-[#7fe7d7]/60 bg-[#17233f] p-4" role="group" aria-label="Visual task steps">
                <p className="font-display text-sm font-semibold text-[#7fe7d7]">Three steps</p>
                <ol className="mt-3 grid gap-2 sm:grid-cols-3">
                  {[
                    ["👀", "Look", "Find the important clue."],
                    [
                      "✋",
                      q.format === "trace-path" ? "Trace" : ["word-build", "array-build"].includes(q.format) ? "Build" : "Choose",
                      "Use the activity controls.",
                    ],
                    ["✓", "Send", "Check it, then send."],
                  ].map(([icon, title, detail]) => (
                    <li key={title} className="rounded-xl border border-white/15 bg-black/20 p-3">
                      <span className="text-2xl" aria-hidden="true">{icon}</span>
                      <span className="font-display ml-2 font-semibold text-white">{title}</span>
                      <span className="mt-1 block text-xs leading-5 text-white/80">{detail}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <fieldset className="mt-5 rounded-2xl border border-white/20 bg-[#17233f] p-4">
              <legend className="font-display text-sm font-semibold text-white">
                How sure do you feel? <span className="font-sans font-normal text-white/85">(optional)</span>
              </legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  [2, "Not sure"],
                  [3, "Think so"],
                  [4, "Sure"],
                ].map(([value, label]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setConfidence(value as 2 | 3 | 4)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                      confidence === value ? "border-[#ffdf8a] bg-white text-ink" : "border-white/25 bg-[#17233f] text-white"
                    }`}
                    aria-pressed={confidence === value}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            {switchAccess && (
              <p className="mt-5 rounded-2xl border border-[#ffdf8a]/60 bg-[#17233f] px-4 py-3 text-sm text-white" role="status" aria-live="polite">
                Switch scanning: <strong className="text-[#ffdf8a]">{switchLabel}</strong>. Press Space to choose. Press Escape to stop.
              </p>
            )}
            <div data-switch-region>
              {(saveState === "rejected" || saveState === "uncertain") && (
                <div role="alert" aria-label="Answer saving" className="mt-5 rounded-2xl border border-sun bg-[#17233f] p-4 text-white">
                  <p>{message}</p>
                  {saveState === "rejected"
                    ? <Link href="/play" className="btn-pop mt-3 inline-block bg-sun px-5 py-3 text-ink">Choose another mission</Link>
                    : <button type="button" onClick={submit} className="btn-pop mt-3 bg-sun px-5 py-3 text-ink">Retry saving answer</button>}
                </div>
              )}
              {saveState === "saving" && <p role="status" className="mt-4 text-white">Saving your answer…</p>}
              <fieldset disabled={saveState !== "idle"} aria-label="Answer controls" className="min-w-0">
              <LearningStudio
                key={`${q.id}-${responseMode}`}
                question={q}
                input={input}
                showHint={showHint}
                hintPanel={!route.mockAssessmentId && q.hints.length > 0 ? (
                  <section aria-label="Question hints" className="mx-auto mt-5 max-w-lg rounded-2xl border border-white/20 bg-[#17233f] p-4 text-white">
                    {hintCount > 0 && <ol className="space-y-2" aria-live="polite">{q.hints.slice(0, hintCount).map((hint, index) => <li key={index}>{hint}</li>)}</ol>}
                    {hintCount < q.hints.length && <button type="button" onClick={revealHint} className="btn-pop mt-2 bg-white px-4 py-3 text-ink">{hintCount ? "Show next hint" : "Show a hint"}</button>}
                  </section>
                ) : undefined}
                onChoose={choose}
                onKey={key}
                onSubmit={submit}
                responseMode={responseMode}
                onResponseModeChange={changeResponseMode}
              />
              </fieldset>
            </div>
          </div>
        ) : (
          <div data-switch-region ref={summaryRef} tabIndex={-1} className="anim-pop rounded-blob bg-white p-8 text-ink shadow-card">
            <h2 className="font-display text-center text-3xl font-semibold">
              {hatched ? reward.complete : "Saving your world progress..."}
            </h2>
            <div className="mt-6 grid grid-cols-3 gap-4 text-center">
              <div className="rounded-2xl bg-cream p-4">
                <p className="font-display text-3xl font-semibold text-grape">{xp}</p>
                <p className="text-xs text-ink/75">XP earned</p>
              </div>
              <div className="rounded-2xl bg-cream p-4">
                <p className="font-display text-3xl font-semibold text-[#236846]">{accuracy}%</p>
                <p className="text-xs text-ink/75">Accuracy</p>
              </div>
              <div className="rounded-2xl bg-cream p-4">
                <p className="font-display text-lg font-semibold text-[#2d5f9e]">{projectedBand}</p>
                <p className="text-xs text-ink/75">Saved evidence band</p>
              </div>
            </div>
            {route.mockAssessmentId && mockSummary && (
              <div className="mt-5 rounded-2xl border border-grape/15 bg-[#f3efff] p-4 text-center" aria-label="Mock assessment result">
                <p className={missionSubheadingClass}>Subject check result</p>
                <p className="mt-2 text-sm text-ink/72">
                  {mockSummary.status === "completed"
                    ? `${mockSummary.correct_count} of ${mockSummary.question_count} answers correct.`
                    : `${mockSummary.answered_count} of ${mockSummary.question_count} answers saved so far.`}
                </p>
                <p className="mt-1 font-display text-3xl font-semibold text-[#5a3ca8]">{mockSummary.score}%</p>
                <p className="text-xs text-ink/65">Saved to the learner report. A subject check never restricts progress in another subject.</p>
                <MockObjectiveGuidance results={mockSummary.objective_results || []} />
              </div>
            )}
            <p className="mt-5 text-center text-sm text-ink/75">
              Objective: {mission?.objective?.statement || "recall multiplication facts up to 12 x 12"} Nixi will
              bring these back later to make them stick.
            </p>
            {baselineProgress && (
              <div className="mt-5 rounded-2xl border border-grape/15 bg-[#f3efff] p-4 text-center">
                <p className={missionSubheadingClass}>
                  {baselineProgress.status === "completed" ? "Baseline complete" : "Baseline journey"}
                </p>
                <p className="mt-2 text-sm text-ink/72">
                  {baselineProgress.completed_items} of {baselineProgress.total_items} checkpoints complete.
                  {baselineProgress.status === "completed"
                    ? " Your starting evidence is ready to guide future missions."
                    : " The next short checkpoint is ready when you are."}
                </p>
                <div
                  className="mx-auto mt-3 flex max-w-sm gap-1.5"
                  role="progressbar"
                  aria-label="Baseline checkpoints"
                  aria-valuemin={0}
                  aria-valuemax={baselineProgress.total_items}
                  aria-valuenow={baselineProgress.completed_items}
                >
                  {baselineProgress.items.map((item) => (
                    <span
                      key={item.objective_id}
                      className={`h-2 flex-1 rounded-full ${item.status === "completed" ? "bg-[#5a3ca8]" : "bg-[#d8cff4]"}`}
                    />
                  ))}
                </div>
              </div>
            )}
            {progressState === "loading" && (
              <div className="mt-5">
                <ApiStateCard kind="loading" title="Updating your growth view" body="We are combining this mission with your cross-subject evidence so the next route reflects what you can already do." />
              </div>
            )}
            {progressState === "ready" && progressReport && (
              <div className="mt-5 overflow-hidden rounded-2xl border border-[#17233f]/10 bg-white">
                <div className="border-b border-[#17233f]/10 bg-[#f3efff] px-5 py-4">
                  <p className={missionSubheadingClass}>Your growth across subjects</p>
                  <p className="mt-1 text-sm text-ink/70">A strong subject can move ahead independently; another subject can keep its own revision route.</p>
                </div>
                <ProgressSnapshot progress={progressReport} empty="No cross-subject evidence is available yet." tone="navy" />
              </div>
            )}
            {progressState === "unavailable" && (
              <div className="mt-5">
                <ApiStateCard kind="unavailable" title="Growth view is temporarily unavailable" body="This mission was saved, but the wider progress report did not return. Your evidence is not being replaced with a guessed score." />
              </div>
            )}
            <div className="mt-6 flex justify-center gap-3">
              {nextMissionURL ? (
                <a href={nextMissionURL} className="btn-pop bg-sun px-6 py-3 text-ink">
                  {baselineProgress?.status === "in_progress" ? "Next checkpoint" : "Next mission"}
                </a>
              ) : (
                <button onClick={again} className="btn-pop bg-sun px-6 py-3 text-ink">
                  Play again
                </button>
              )}
              <Link href="/play" className="btn-pop bg-[#5840a6] px-6 py-3 text-white">
                Back to worlds
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* confetti on hatch */}
      {hatched && !reducedMotion && (
        <div className="pointer-events-none fixed inset-0" aria-hidden>
          {Array.from({ length: 28 }).map((_, i) => (
            <span
              key={i}
              className="absolute text-xl"
              style={{
                left: `${(i * 37) % 100}%`,
                animation: `confetti-fall ${2.4 + (i % 5) * 0.5}s linear ${(i % 7) * 0.25}s forwards`,
              }}
            >
              {["*", "+", "*", "+", "*"][i % 5]}
            </span>
          ))}
        </div>
      )}

      {paused && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#15123b]/90 px-6 backdrop-blur" role="dialog" aria-modal="true" aria-labelledby="pause-title">
          <section className="w-full max-w-md rounded-3xl bg-white p-8 text-center text-ink shadow-card">
            <div className="text-5xl" aria-hidden>🌿</div>
            <h2 id="pause-title" className="font-display mt-4 text-3xl font-semibold">Take a quiet pause</h2>
            <p className="mt-3 text-sm leading-6 text-ink/65">Nothing is lost. Breathe, stretch, or look away from the screen, then return when you are ready.</p>
            <button
              autoFocus
              onClick={() => {
                setPaused(false);
                void recordLearningEvent("mission_resumed", { activity_id: mission?.activity?.id || "", question_id: q?.id || "" });
              }}
              className="btn-pop mt-6 bg-sun px-7 py-3 text-ink"
            >
              Continue mission
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

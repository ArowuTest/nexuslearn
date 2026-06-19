"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Dino, { type DinoMood } from "@/components/Dino";
import LearningStudio from "@/components/LearningStudio";
import { DEFAULT_STUDENT_ID, pupilSessionHeaders, type MissionConfig } from "@/lib/api";
import { sfx, setMuted } from "@/lib/sound";

type Q = {
  id: string;
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
type AttemptResult = {
  correct: boolean;
  mastery_gain: number;
  projected_score: number;
  projected_band: string;
  next_review_days: number;
  feedback: string;
  explanation: string;
  companion_prompt: string;
};
type RuntimeFlags = {
  flags: Record<string, boolean>;
};
type MissionRoute = {
  studentId: string;
  worldKey: string;
  activityId: string;
  assessmentMode: string;
  hasRequestedStudent: boolean;
};
type LessonStep = {
  step_id?: string;
  kind?: string;
  child_prompt?: string;
  learning_purpose?: string;
  audio_script?: string;
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
    return { studentId: DEFAULT_STUDENT_ID, worldKey: "", activityId: "", assessmentMode: "", hasRequestedStudent: false };
  }
  const params = new URLSearchParams(window.location.search);
  const requestedStudent = params.get("studentId") || "";
  return {
    studentId: requestedStudent || DEFAULT_STUDENT_ID,
    worldKey: params.get("world") || "",
    activityId: params.get("activityId") || "",
    assessmentMode: params.get("mode") || "",
    hasRequestedStudent: Boolean(requestedStudent),
  };
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
  const [projectedBand, setProjectedBand] = useState("Unknown");
  const [lessonIdx, setLessonIdx] = useState(0);
  const [lessonComplete, setLessonComplete] = useState(false);
  const [paused, setPaused] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [mood, setMood] = useState<DinoMood>("idle");
  const [message, setMessage] = useState("Loading configured mission content...");
  const [showHint, setShowHint] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [correctFlash, setCorrectFlash] = useState(false);
  const [hatched, setHatched] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mute, setMute] = useState(false);
  const [sparks, setSparks] = useState<{ id: number; dx: number; dy: number }[]>([]);
  const startRef = useRef(Date.now());
  const lessonStartRef = useRef(Date.now());
  const sparkId = useRef(0);

  function expectedValue(question: MissionConfig["questions"][number]) {
    const value = question.expected_answer?.value;
    if (typeof value === "number" || typeof value === "string") return value;
    if (Array.isArray(value) && value.every((item) => typeof item === "string" || typeof item === "number")) return value.join("");
    if (question.format === "trace-path" && Array.isArray(question.expected_answer?.rubric)) return "trace-path-complete";
    return undefined;
  }

  useEffect(() => {
    setRoute(readMissionRoute());
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadMission() {
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
          if (route.activityId) params.set("activityId", route.activityId);
          else if (route.worldKey) params.set("world", route.worldKey);
          if (route.assessmentMode) params.set("mode", route.assessmentMode);
          const res = await fetch(`${API}/v1/learning/mission?${params.toString()}`, {
            headers: pupilSessionHeaders(studentId),
          });
          if (res.ok) {
            const data = (await res.json()) as MissionConfig;
            const configured = (data.questions || [])
              .map((question) => {
                const a = Number(question.body?.a);
                const b = Number(question.body?.b);
                const rawExpected = expectedValue(question);
                const expected = typeof rawExpected === "number" || typeof rawExpected === "string" ? rawExpected : Number(rawExpected);
                const choices = Array.isArray(question.body?.choices) ? question.body.choices.filter((choice) => typeof choice === "number" || typeof choice === "string") as Array<number | string> : [];
                const hasTextInteraction = typeof expected === "string";
                const hasExplicitNumberInput = question.body?.input === "number" || question.body?.response === "number";
                const hasNumericInteraction = Number.isFinite(expected) && ((Number.isFinite(a) && Number.isFinite(b)) || choices.length > 0 || hasExplicitNumberInput);
                if (!hasTextInteraction && !hasNumericInteraction) return null;
                return {
                  id: question.id,
                  a: Number.isFinite(a) ? a : undefined,
                  b: Number.isFinite(b) ? b : undefined,
                  expected,
                  prompt: String(question.body?.prompt || `${a} x ${b}`),
                  objectiveId: question.objective_id,
                  format: question.format,
                  choices,
                  hints: question.hints || [],
                  body: question.body || {},
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
              });
              const sequence = Array.isArray(data.activity?.interaction?.teaching_sequence)
                ? (data.activity.interaction.teaching_sequence as LessonStep[])
                : [];
              setLessonIdx(0);
              setLessonComplete(sequence.length === 0);
              if (data.runtime_adaptations?.reduced_motion || data.runtime_adaptations?.animation_tier === "low" || data.runtime_adaptations?.animation_tier === "static") {
                setReducedMotion(true);
              }
              setMessage(String(data.activity?.prompt || "Answer to send energy through the portal."));
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
  }, [route.activityId, route.assessmentMode, route.hasRequestedStudent, route.worldKey, studentId]);

  const total = questions?.length ?? 0;
  const q = questions ? questions[Math.min(idx, total - 1)] : null;
  const done = idx >= total;
  const teachingSequence = Array.isArray(mission?.activity?.interaction?.teaching_sequence)
    ? (mission.activity.interaction.teaching_sequence as LessonStep[])
    : [];
  const lessonStep = teachingSequence[Math.min(lessonIdx, Math.max(0, teachingSequence.length - 1))];
  const inLesson = teachingSequence.length > 0 && !lessonComplete;

  useEffect(() => {
    startRef.current = Date.now();
    setShowHint(false);
    setConfidence(0);
  }, [idx]);

  useEffect(() => {
    if (q) void recordLearningEvent("question_seen", { question_id: q.id, objective_id: q.objectiveId, position: idx + 1 });
  }, [idx, q?.id]);

  useEffect(() => {
    lessonStartRef.current = Date.now();
  }, [lessonIdx]);

  useEffect(() => setMuted(mute), [mute]);

  useEffect(() => {
    if (loadState === "ready" && total > 0 && done && !hatched) {
      void recordLearningEvent("assessment_completed", {
        activity_id: mission?.activity?.id || "",
        objective_id: mission?.objective?.id || "",
        question_count: total,
        correct_count: results.filter(Boolean).length,
      });
      const t = setTimeout(() => {
        setHatched(true);
        setMood("celebrate");
        sfx.hatch();
      }, 700);
      return () => clearTimeout(t);
    }
  }, [done, hatched, loadState, total]);

  const accuracy = useMemo(
    () => (results.length ? Math.round((results.filter(Boolean).length / results.length) * 100) : 0),
    [results]
  );

  function emitSparks() {
    const quietCelebration = mission?.runtime_adaptations?.celebration_intensity === "quiet" || mission?.runtime_adaptations?.animation_tier === "low";
    const burst = Array.from({ length: quietCelebration ? 4 : 10 }, () => ({
      id: sparkId.current++,
      dx: (Math.random() - 0.5) * 180,
      dy: -40 - Math.random() * 120,
    }));
    setSparks((s) => [...s, ...burst]);
    setTimeout(() => setSparks((s) => s.slice(burst.length)), 800);
  }

  async function submit() {
    if (done || input === "" || !q) return;
    const given = parseInt(input, 10);
    const ms = Date.now() - startRef.current;
    let result: AttemptResult | null = null;

    if (API) {
      try {
        const isTextAnswer = typeof q.expected === "string";
        const res = await fetch(`${API}/v1/learning/attempt`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...pupilSessionHeaders(studentId) },
          body: JSON.stringify({
            student_id: studentId,
            objective_id: q.objectiveId,
            question_id: q.id,
            format: q.format,
            given: isTextAnswer ? 0 : given,
            expected: isTextAnswer ? 0 : Number(q.expected),
            given_text: isTextAnswer ? input : "",
            expected_text: isTextAnswer ? String(q.expected) : "",
            ms,
            hint_used: showHint,
            confidence,
          }),
        });
        if (res.ok) result = (await res.json()) as AttemptResult;
      } catch {
        result = null;
      }
    }
    if (!result) {
      setMood("encourage");
      setMessage("I could not save that answer. Please try again in a moment.");
      setInput("");
      return;
    }

    const correct = result.correct;
    setProjectedBand(result.projected_band || "Unknown");
    if (correct) {
      setXp((x) => x + result.mastery_gain);
      setCharge((c) => c + 1);
      setResults((r) => [...r, true]);
      setMood("happy");
      setMessage(result.feedback);
      setCorrectFlash(true);
      setTimeout(() => setCorrectFlash(false), 450);
      emitSparks();
      sfx.correct();
      sfx.charge();
      setInput("");
      setIdx((i) => i + 1);
    } else {
      setResults((r) => [...r, false]);
      setMood("encourage");
      setMessage(
        result.feedback || `Almost. ${q.prompt} needs another try.`
      );
      setWrongFlash(true);
      setTimeout(() => setWrongFlash(false), 400);
      setShowHint(true);
      void recordLearningEvent("hint_opened", { question_id: q.id, objective_id: q.objectiveId, reason: "incorrect_response" });
      sfx.gentle();
      setInput("");
    }
  }

  function key(k: string) {
    sfx.tap();
    if (k === "back") setInput((v) => v.slice(0, -1));
    else if (input.length < 4) setInput((v) => v + k);
  }

  function choose(choice: number | string) {
    sfx.tap();
    setInput(String(choice));
  }

  function again() {
    setIdx(0);
    setInput("");
    setCharge(0);
    setXp(0);
    setConfidence(0);
    setProjectedBand("Unknown");
    setLessonIdx(0);
    setLessonComplete(teachingSequence.length === 0);
    setResults([]);
    setHatched(false);
    setMood("idle");
    setMessage(mission?.activity?.prompt || "Answer to send energy through the portal.");
    void recordLearningEvent("mission_restarted", { activity_id: mission?.activity?.id || "", objective_id: mission?.objective?.id || "" });
  }

  function readAloud(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) return;
    void recordLearningEvent("audio_replay", { activity_id: mission?.activity?.id || "", question_id: q?.id || "", lesson_step: lessonStep?.step_id || "" });
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.88;
    utterance.pitch = 1.03;
    window.speechSynthesis.speak(utterance);
  }

  async function recordLearningEvent(eventType: string, payload: Record<string, unknown>) {
    if (!API || !studentId) return;
    try {
      await fetch(`${API}/v1/learning/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...pupilSessionHeaders(studentId) },
        body: JSON.stringify({ student_id: studentId, event_type: eventType, payload }),
        keepalive: true,
      });
    } catch {
      // Event telemetry must never interrupt the learning interaction.
    }
  }

  async function continueLesson() {
    if (!mission || !lessonStep) return;
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
        <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#241f56] to-[#1a3a3d] px-6 text-white">
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
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#241f56] to-[#1a3a3d] px-6 text-white">
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
  const reward = worldReward(Number(mission?.world?.year_group || 0));
  const companionName = String(mission?.world?.config?.companion || "Nixi");
  const savedArtefacts = Array.isArray(mission?.world_state?.state?.artefacts) ? mission.world_state.state.artefacts.length : 0;
  const adaptations = mission?.runtime_adaptations;
  const progressPct = total ? Math.round((charge / total) * 100) : 0;
  const missionStyle = {
    "--world-accent": worldAccent,
  } as CSSProperties;

  return (
    <main
      className={`min-h-screen overflow-x-hidden bg-gradient-to-b from-[#241f56] via-[#2e2870] to-[#1a3a3d] px-4 py-6 text-white ${
        reducedMotion ? "reduced-motion" : ""
      }`}
      style={missionStyle}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-[8%] top-[12%] h-56 w-56 rounded-full bg-[var(--world-accent)] opacity-12 blur-3xl" />
        <div className="absolute right-[4%] top-[18%] h-72 w-72 rounded-full bg-[#55cbd3] opacity-10 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.08))]" />
      </div>

      {/* top bar */}
      <div className="relative z-10 mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <Link
          href="/play"
          onClick={() => void recordLearningEvent("mission_exited", { activity_id: mission?.activity?.id || "", question_id: q?.id || "", completed_questions: results.length })}
          className="btn-pop bg-white/10 px-4 py-2 text-sm"
        >
          Exit
        </Link>
        <div className="font-display order-3 flex w-full flex-wrap items-center justify-center gap-2 text-sm md:order-none md:w-auto md:gap-3">
          <span className="rounded-full bg-sun/20 px-4 py-1.5 text-sun">{xp} XP</span>
          <span className="rounded-full bg-white/10 px-4 py-1.5 text-white/80">{progressPct}% charged</span>
          <span className="rounded-full bg-white/10 px-4 py-1.5 text-white/75">{savedArtefacts} world artefacts</span>
          {adaptations?.session_length === "short" && <span className="rounded-full bg-[#55cbd3]/20 px-4 py-1.5 text-[#9df5fa]">Short mission</span>}
          {adaptations?.animation_tier === "low" && <span className="rounded-full bg-white/10 px-4 py-1.5 text-white/75">Calm mode</span>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setPaused(true);
              void recordLearningEvent("mission_paused", { activity_id: mission?.activity?.id || "", question_id: q?.id || "" });
            }}
            className="btn-pop bg-white/10 px-3 py-2 text-sm"
          >
            Pause
          </button>
          <button
            onClick={() => setFocusMode((value) => !value)}
            className={`btn-pop px-3 py-2 text-sm ${focusMode ? "bg-sun text-ink" : "bg-white/10"}`}
            aria-pressed={focusMode}
          >
            Focus
          </button>
          <button
            onClick={() => setMute((m) => !m)}
            className="btn-pop bg-white/10 px-3 py-2 text-sm"
            aria-label={mute ? "Unmute sounds" : "Mute sounds"}
          >
            {mute ? "Sound off" : "Sound on"}
          </button>
          <button
            onClick={() => setReducedMotion((r) => !r)}
            className={`btn-pop px-3 py-2 text-sm ${reducedMotion ? "bg-sun text-ink" : "bg-white/10"}`}
            aria-pressed={reducedMotion}
            title="Reduced motion"
          >
            Calm
          </button>
        </div>
      </div>

      <section className="relative z-10 mx-auto mt-5 max-w-6xl overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/8 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.18em] text-[var(--world-accent)]">{realm}</p>
            <h1 className="font-display mt-1 text-2xl font-semibold md:text-4xl">{mission?.activity?.title || "Configured Mission"}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/68">{worldFocus}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
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

      <div className={`relative z-10 mx-auto mt-6 grid max-w-6xl items-center gap-8 ${focusMode ? "grid-cols-1" : "md:grid-cols-[0.95fr_1.05fr]"}`}>
        {/* LEFT: incubator scene */}
        <div className={`relative flex flex-col items-center ${focusMode ? "hidden" : ""}`}>
          {/* sparks */}
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

          {/* incubator */}
          <div className="relative z-10">
            <svg width="280" height="300" viewBox="0 0 280 300" aria-hidden>
              {/* glass dome */}
              <path
                d="M40 190 A100 105 0 0 1 240 190 L240 230 L40 230 Z"
                fill="rgba(140,200,255,0.12)"
                stroke="rgba(140,200,255,0.45)"
                strokeWidth="3"
              />
              {/* energy fill */}
              <clipPath id="dome">
                <path d="M40 190 A100 105 0 0 1 240 190 L240 230 L40 230 Z" />
              </clipPath>
              <rect
                clipPath="url(#dome)"
                x="40"
                y={230 - (145 * charge) / total}
                width="200"
                height={(145 * charge) / total}
                fill="color-mix(in srgb, var(--world-accent), transparent 65%)"
                style={{ transition: "all 0.6s cubic-bezier(0.34,1.56,0.64,1)" }}
              />
              <rect className="anim-scan-line" clipPath="url(#dome)" x="48" y="70" width="184" height="18" fill="rgba(255,255,255,0.18)" />
              {/* base */}
              <rect x="20" y="228" width="240" height="34" rx="12" fill="#3b3470" />
              <rect x="36" y="262" width="208" height="14" rx="7" fill="#2c2757" />
              {/* charge lights */}
              {Array.from({ length: total }).map((_, i) => (
                <circle
                  key={i}
                  cx={56 + i * 24}
                  cy="245"
                  r="6"
                  fill={i < charge ? worldAccent : "#1d1a3e"}
                  className={i < charge ? "anim-glow" : ""}
                />
              ))}
            </svg>

            {/* age-specific world reward inside the energy vessel */}
            <div className="absolute left-1/2 top-[108px] -translate-x-1/2">
              <div
                key={`${charge}-${hatched}`}
                className={`flex h-28 w-28 items-center justify-center rounded-full bg-white/85 text-6xl shadow-[0_18px_48px_rgba(0,0,0,0.22)] ${
                  charge > 0 ? "anim-egg-rock" : ""
                } ${hatched ? "anim-pop anim-glow" : ""}`}
                role="img"
                aria-label={hatched ? reward.complete : `${reward.building}, ${progressPct}% complete`}
              >
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
          <div className="rounded-blob border border-white/10 bg-white/10 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur md:p-8">
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
            <div className="mt-7 flex flex-wrap gap-3">
              {(adaptations?.audio_support || lessonStep.audio_script) && (
                <button
                  type="button"
                  onClick={() => readAloud(lessonStep.audio_script || lessonStep.child_prompt || "")}
                  className="btn-pop bg-white/12 px-5 py-3 text-white"
                >
                  Read this aloud
                </button>
              )}
              <button type="button" onClick={continueLesson} className="btn-pop bg-sun px-6 py-3 text-ink">
                {lessonIdx + 1 >= teachingSequence.length ? "Start practice" : "Next step"}
              </button>
            </div>
          </div>
        ) : !done ? (
          <div className={`rounded-blob border border-white/10 bg-white/10 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur md:p-8 ${wrongFlash ? "anim-shake" : ""}`}>
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
                    i < results.length ? (results[i] ? "bg-leaf" : "bg-sun") : "bg-white/15"
                  }`}
                />
              ))}
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {[
                ["Recall", "Answer from memory first"],
                ["Repair", showHint ? "Scaffold is open" : "Hint waits if needed"],
                ["Mastery", "Saved to evidence"],
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl bg-white/8 px-4 py-3">
                  <p className="font-display text-sm font-semibold text-[var(--world-accent)]">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-white/55">{body}</p>
                </div>
              ))}
            </div>

            <details className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <summary className="cursor-pointer font-display text-sm font-semibold text-[var(--world-accent)]">
                Why this question?
              </summary>
              <p className="mt-2 text-xs leading-5 text-white/65">{q.selectionReason}</p>
              {mission?.assessment_blueprint && (
                <p className="mt-2 text-xs leading-5 text-white/50">
                  {mission.assessment_blueprint.mode.replaceAll("_", " ")} set · target challenge {mission.assessment_blueprint.target_difficulty}/10 ·{" "}
                  {mission.assessment_blueprint.formats.length} response format{mission.assessment_blueprint.formats.length === 1 ? "" : "s"}
                </p>
              )}
            </details>

            <fieldset className="mt-5">
              <legend className="font-display text-sm font-semibold text-white">
                How sure do you feel? <span className="font-sans font-normal text-white/55">(optional)</span>
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
                      confidence === value ? "border-[var(--world-accent)] bg-white text-ink" : "border-white/15 bg-white/5 text-white"
                    }`}
                    aria-pressed={confidence === value}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            <LearningStudio question={q} input={input} showHint={showHint} onChoose={choose} onKey={key} onSubmit={submit} />
          </div>
        ) : (
          <div className="anim-pop rounded-blob bg-white p-8 text-ink shadow-card">
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
            <p className="mt-5 text-center text-sm text-ink/75">
              Objective: {mission?.objective?.statement || "recall multiplication facts up to 12 x 12"} Nixi will
              bring these back later to make them stick.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button onClick={again} className="btn-pop bg-sun px-6 py-3 text-ink">
                Play again
              </button>
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

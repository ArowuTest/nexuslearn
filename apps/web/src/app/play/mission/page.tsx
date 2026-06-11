"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Dino, { type DinoMood } from "@/components/Dino";
import { sfx, setMuted } from "@/lib/sound";

/* ------------------------------------------------------------------ */
/* Mission data — mirrors the API's demo mission; falls back locally    */
/* so the game always works even if the API is cold-starting.           */
/* ------------------------------------------------------------------ */

type Q = { a: number; b: number };

function makeQuestions(): Q[] {
  const tables = [3, 4, 6, 7, 8];
  return Array.from({ length: 8 }, () => ({
    a: tables[Math.floor(Math.random() * tables.length)],
    b: 2 + Math.floor(Math.random() * 11),
  }));
}

const API = process.env.NEXT_PUBLIC_API_URL;

const PRAISE = [
  "Brilliant recall!",
  "Super speedy!",
  "The lab powered up!",
  "That fact is getting stronger!",
  "Rex is impressed!",
];

const TOTAL = 8;

export default function Mission() {
  // Generated after mount: questions are random, so creating them during
  // render would make server and client HTML disagree (hydration mismatch).
  const [questions, setQuestions] = useState<Q[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [charge, setCharge] = useState(0); // 0..TOTAL
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [mood, setMood] = useState<DinoMood>("idle");
  const [message, setMessage] = useState("Power the Dino Lab machine. Answer to send energy.");
  const [showHint, setShowHint] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [correctFlash, setCorrectFlash] = useState(false);
  const [hatched, setHatched] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mute, setMute] = useState(false);
  const [sparks, setSparks] = useState<{ id: number; dx: number; dy: number }[]>([]);
  const startRef = useRef(Date.now());
  const sparkId = useRef(0);

  useEffect(() => {
    setQuestions(makeQuestions());
  }, []);

  const q = questions ? questions[Math.min(idx, TOTAL - 1)] : null;
  const done = idx >= TOTAL;

  useEffect(() => {
    startRef.current = Date.now();
    setShowHint(false);
  }, [idx]);

  useEffect(() => setMuted(mute), [mute]);

  useEffect(() => {
    if (done && !hatched) {
      const t = setTimeout(() => {
        setHatched(true);
        setMood("celebrate");
        sfx.hatch();
      }, 700);
      return () => clearTimeout(t);
    }
  }, [done, hatched]);

  const accuracy = useMemo(
    () => (results.length ? Math.round((results.filter(Boolean).length / results.length) * 100) : 0),
    [results]
  );

  function emitSparks() {
    const burst = Array.from({ length: 10 }, () => ({
      id: sparkId.current++,
      dx: (Math.random() - 0.5) * 180,
      dy: -40 - Math.random() * 120,
    }));
    setSparks((s) => [...s, ...burst]);
    setTimeout(() => setSparks((s) => s.slice(burst.length)), 800);
  }

  function submit() {
    if (done || input === "" || !q) return;
    const given = parseInt(input, 10);
    const correct = given === q.a * q.b;
    const ms = Date.now() - startRef.current;

    // fire-and-forget evidence log to the API (Slice 2 makes this canonical)
    if (API) {
      fetch(`${API}/v1/learning/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: `demo-${idx}`,
          given,
          expected: q.a * q.b,
          ms,
          hint_used: showHint,
        }),
      }).catch(() => {});
    }

    if (correct) {
      const fast = ms < 6000;
      const gain = (showHint ? 6 : 10) + (fast ? 2 : 0);
      setXp((x) => x + gain);
      setCharge((c) => c + 1);
      setStreak((s) => s + 1);
      setResults((r) => [...r, true]);
      setMood("happy");
      setMessage(PRAISE[Math.floor(Math.random() * PRAISE.length)]);
      setCorrectFlash(true);
      setTimeout(() => setCorrectFlash(false), 450);
      emitSparks();
      sfx.correct();
      sfx.charge();
      setInput("");
      setIdx((i) => i + 1);
    } else {
      setStreak(0);
      setResults((r) => [...r, false]);
      setMood("encourage");
      setMessage(
        `Almost. ${q.a} x ${q.b} means ${q.a} groups of ${q.b}. Let's build it together.`
      );
      setWrongFlash(true);
      setTimeout(() => setWrongFlash(false), 400);
      setShowHint(true);
      sfx.gentle();
      setInput("");
    }
  }

  function key(k: string) {
    sfx.tap();
    if (k === "back") setInput((v) => v.slice(0, -1));
    else if (input.length < 3) setInput((v) => v + k);
  }

  function again() {
    setQuestions(makeQuestions());
    setIdx(0);
    setInput("");
    setCharge(0);
    setXp(0);
    setStreak(0);
    setResults([]);
    setHatched(false);
    setMood("idle");
    setMessage("Power the Dino Lab machine. Answer to send energy.");
  }

  if (!q) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#241f56] to-[#1a3a3d]">
        <Dino mood="thinking" size={140} />
      </main>
    );
  }

  const masteryBand =
    accuracy >= 90 ? "Secure" : accuracy >= 75 ? "Expected Standard" : accuracy >= 50 ? "Developing" : "Keep practising";

  return (
    <main
      className={`min-h-screen bg-gradient-to-b from-[#241f56] via-[#2e2870] to-[#1a3a3d] px-4 py-6 text-white ${
        reducedMotion ? "reduced-motion" : ""
      }`}
    >
      {/* top bar */}
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <Link href="/play" className="btn-pop bg-white/10 px-4 py-2 text-sm">
          Exit
        </Link>
        <div className="font-display flex items-center gap-3 text-sm">
          <span className="rounded-full bg-sun/20 px-4 py-1.5 text-sun">{xp} XP</span>
          {streak >= 2 && (
            <span className="anim-pop rounded-full bg-coral/30 px-4 py-1.5 text-coral">
              {streak} streak
            </span>
          )}
        </div>
        <div className="flex gap-2">
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

      <div className="mx-auto mt-6 grid max-w-5xl items-center gap-8 md:grid-cols-2">
        {/* LEFT: incubator scene */}
        <div className="relative flex flex-col items-center">
          {/* sparks */}
          <div className="pointer-events-none absolute inset-0 z-10" aria-hidden>
            {sparks.map((s) => (
              <span
                key={s.id}
                className="absolute left-1/2 top-1/2 text-xl"
                style={{
                  // @ts-expect-error css custom props
                  "--dx": `${s.dx}px`,
                  "--dy": `${s.dy}px`,
                  animation: "spark 0.8s ease-out forwards",
                }}
              >
                *
              </span>
            ))}
          </div>

          {/* incubator */}
          <div className="relative">
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
                y={230 - (145 * charge) / TOTAL}
                width="200"
                height={(145 * charge) / TOTAL}
                fill="rgba(255,184,48,0.30)"
                style={{ transition: "all 0.6s cubic-bezier(0.34,1.56,0.64,1)" }}
              />
              {/* base */}
              <rect x="20" y="228" width="240" height="34" rx="12" fill="#3b3470" />
              <rect x="36" y="262" width="208" height="14" rx="7" fill="#2c2757" />
              {/* charge lights */}
              {Array.from({ length: TOTAL }).map((_, i) => (
                <circle
                  key={i}
                  cx={56 + i * 24}
                  cy="245"
                  r="6"
                  fill={i < charge ? "#ffb830" : "#1d1a3e"}
                  className={i < charge ? "anim-glow" : ""}
                />
              ))}
            </svg>

            {/* egg / hatchling inside the dome */}
            <div className="absolute left-1/2 top-[108px] -translate-x-1/2">
              {!hatched ? (
                <div
                  key={charge}
                  className={`${charge > 0 ? "anim-egg-rock" : ""} ${charge >= TOTAL - 1 ? "anim-glow" : ""}`}
                >
                  <svg width="86" height="104" viewBox="0 0 86 104" aria-hidden>
                    <ellipse cx="43" cy="58" rx="38" ry="44" fill="#fdf3df" />
                    <ellipse cx="43" cy="58" rx="38" ry="44" fill="url(#eggshade)" />
                    <defs>
                      <linearGradient id="eggshade" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#fff" stopOpacity="0.6" />
                        <stop offset="1" stopColor="#e8b96f" stopOpacity="0.35" />
                      </linearGradient>
                    </defs>
                    <circle cx="30" cy="44" r="5" fill="#7fd4a8" opacity="0.7" />
                    <circle cx="54" cy="66" r="7" fill="#7fd4a8" opacity="0.55" />
                    <circle cx="40" cy="84" r="4" fill="#7fd4a8" opacity="0.6" />
                    {/* crack appears near full charge */}
                    {charge >= TOTAL - 2 && (
                      <path
                        d="M28 30 l8 8 l-5 7 l9 6"
                        stroke="#b98a4a"
                        strokeWidth="2.5"
                        fill="none"
                        strokeLinecap="round"
                      />
                    )}
                  </svg>
                </div>
              ) : (
                <div className="anim-pop">
                  <Dino mood="celebrate" size={110} />
                </div>
              )}
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
            </div>
          </div>
        </div>

        {/* RIGHT: question + pad, or summary */}
        {!done ? (
          <div className={`rounded-blob bg-white/10 p-6 backdrop-blur md:p-8 ${wrongFlash ? "anim-shake" : ""}`}>
            <div className="flex items-center justify-between text-sm text-white/60">
              <span className="font-display">
              Mission: Power the Dino Lab - Q{idx + 1}/{TOTAL}
              </span>
              <span>Year 4 - Times tables</span>
            </div>

            {/* progress dots */}
            <div className="mt-3 flex gap-1.5">
              {Array.from({ length: TOTAL }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 flex-1 rounded-full transition-colors ${
                    i < results.length ? (results[i] ? "bg-leaf" : "bg-sun") : "bg-white/15"
                  }`}
                />
              ))}
            </div>

            <div className="font-display mt-8 text-center text-6xl font-semibold tracking-wide">
              {q.a} x {q.b} = <span className="text-sun">{input || "?"}</span>
            </div>

            {/* array hint */}
            {showHint && (
              <div className="anim-pop mx-auto mt-5 w-fit rounded-2xl bg-white/10 p-4">
                <p className="mb-2 text-center text-xs text-white/70">
                  {q.a} rows of {q.b}
                </p>
                <div className="flex flex-col gap-1">
                  {Array.from({ length: q.a }).map((_, r) => (
                    <div key={r} className="flex gap-1">
                      {Array.from({ length: q.b }).map((_, c) => (
                        <span key={c} className="h-3 w-3 rounded-full bg-lagoon" />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* number pad */}
            <div className="mx-auto mt-8 grid max-w-xs grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0"].map((k) => (
                <button
                  key={k}
                  onClick={() => key(k)}
                  className="btn-pop bg-white/15 py-4 text-2xl text-white hover:bg-white/25"
                >
                  {k === "back" ? "Del" : k}
                </button>
              ))}
              <button
                onClick={submit}
                className="btn-pop bg-sun py-4 text-2xl text-ink"
                aria-label="Submit answer"
              >
                Go
              </button>
            </div>
          </div>
        ) : (
          <div className="anim-pop rounded-blob bg-white p-8 text-ink shadow-card">
            <h2 className="font-display text-center text-3xl font-semibold">
              {hatched ? "Your dino hatched!" : "Charging complete..."}
            </h2>
            <div className="mt-6 grid grid-cols-3 gap-4 text-center">
              <div className="rounded-2xl bg-cream p-4">
                <p className="font-display text-3xl font-semibold text-grape">{xp}</p>
                <p className="text-xs text-ink/60">XP earned</p>
              </div>
              <div className="rounded-2xl bg-cream p-4">
                <p className="font-display text-3xl font-semibold text-leaf">{accuracy}%</p>
                <p className="text-xs text-ink/60">Accuracy</p>
              </div>
              <div className="rounded-2xl bg-cream p-4">
                <p className="font-display text-lg font-semibold text-sky">{masteryBand}</p>
                <p className="text-xs text-ink/60">Mastery</p>
              </div>
            </div>
            <p className="mt-5 text-center text-sm text-ink/60">
              Objective: recall multiplication facts up to 12 x 12. Rex will
              bring these back tomorrow to make them stick.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button onClick={again} className="btn-pop bg-sun px-6 py-3 text-ink">
                Play again
              </button>
              <Link href="/parents" className="btn-pop bg-grape px-6 py-3 text-white">
                See parent view
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
    </main>
  );
}

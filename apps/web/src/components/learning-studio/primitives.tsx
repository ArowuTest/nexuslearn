"use client";

import { useState } from "react";
import { playProducedAudio } from "@/lib/sound";
import { resolveNarrationAsset, resolveNarrationAssetMap, useNarrationAssets } from "@/lib/narration";
import { asStringArray, type StudioQuestion } from "./types";

export function NumericArray({ a = 0, b = 0 }: { a?: number; b?: number }) {
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
export function AudioBlend({ question }: { question: StudioQuestion }) {
  const [audioStatus, setAudioStatus] = useState("");
  const narrationAssets = useNarrationAssets();
  const sounds = asStringArray(question.body.sounds);
  const audioAssets = resolveNarrationAssetMap(question.body.audio_assets, narrationAssets);
  const promptAudio = resolveNarrationAsset(question.body.prompt_audio_url, narrationAssets);
  if (!["audio_blend", "audio-blend", "audio-choice", "listen-read"].includes(question.format.toLowerCase()) && sounds.length === 0) return null;

  function audioFor(sound: string) {
    return audioAssets[`phoneme-${sound}`] || audioAssets[sound] || "";
  }

  async function playClip(audioURL: string, label: string) {
    if (!audioURL) {
      setAudioStatus(`${label} studio audio is being prepared.`);
      return;
    }
    const played = await playProducedAudio(audioURL);
    setAudioStatus(played ? "" : `${label} studio audio did not play. Try again, or keep learning with the visual prompt.`);
  }

  return (
    <div className="mx-auto mt-6 max-w-md rounded-3xl border border-white/10 bg-white/10 p-5 text-center" role="group" aria-label="Sound blending controls">
      <p className="font-display text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]">Listen and build</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {(sounds.length ? sounds : ["listen", "think", "choose"]).map((sound) => {
          const audioURL = audioFor(sound);
          return (
            <button
              key={sound}
              type="button"
              className="sound-chip disabled:cursor-not-allowed disabled:opacity-55"
              onClick={() => void playClip(audioURL, sound)}
              aria-label={audioURL ? `Hear ${sound}` : `${sound} studio audio unavailable`}
              disabled={!audioURL}
            >
              {sound}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => void playClip(promptAudio, "Whole prompt")}
        className="mt-4 rounded-full bg-white/12 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55"
        disabled={!promptAudio}
      >
        Hear the whole prompt
      </button>
      {audioStatus && <p className="mt-3 text-xs leading-5 text-white/80" aria-live="polite">{audioStatus}</p>}
      {!promptAudio && Object.keys(audioAssets).length === 0 && (
        <p className="mt-3 text-xs leading-5 text-white/80">Studio audio is being prepared. You can keep learning with the visual prompt.</p>
      )}
    </div>
  );
}

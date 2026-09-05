"use client";

import { useState } from "react";

export type JourneyEntry = { prompt: string; feedback: string; repaired: boolean };

const themes: Record<string, { title: string; step: string; invitation: string }> = {
  collecting: { title: "Collection route", step: "Discovery", invitation: "Collect a discovery with each answer. Open it again to remember what you learned." },
  story: { title: "Story route", step: "Chapter", invitation: "Your answers move the story forward. Revisit a chapter to find your learning clues." },
  challenge: { title: "Challenge route", step: "Checkpoint", invitation: "Build your expedition journal. Your ideas and second tries count." },
  world_building: { title: "World growth route", step: "Build", invitation: "Build your world one idea at a time. Every step holds something you learned." },
};

export default function MissionJourney({ style, year, total, entries, currentPrompt, quiet }: {
  style?: string; year: number; total: number; entries: JourneyEntry[]; currentPrompt: string; quiet: boolean;
}) {
  const [inspected, setInspected] = useState<number | null>(null);
  const theme = themes[style || ""] || themes.world_building;
  const completed = Math.min(entries.length, total);
  const selected = Math.min(inspected ?? completed, Math.max(0, total - 1));
  const entry = entries[selected];
  return (
    <section className="mission-journey" data-theme={style} data-quiet={quiet} data-testid="mission-reward-track" aria-label="Your learning journey">
      <header>
        <p className="journey-eyebrow">{year <= 2 ? "Your adventure" : "Expedition journal"}</p>
        <h2>{theme.title}</h2>
        <p>{year <= 2 ? "Learn. Collect. Look back!" : theme.invitation}</p>
      </header>
      <label className="journey-progress">{completed} of {total} steps explored
        <progress value={completed} max={Math.max(1, total)} />
      </label>
      <ol className="journey-steps">
        {Array.from({ length: total }, (_, index) => (
          <li key={index}>
            <button type="button" disabled={index > completed} aria-pressed={selected === index}
              aria-label={`${theme.step} ${index + 1}: ${index < completed ? "explored" : index === completed ? "up next" : "not explored yet"}`}
              onClick={() => setInspected(index)}>
              <span className="journey-step-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <span>{theme.step} {index + 1}</span>
              <small>{index < completed ? "Open discovery" : index === completed ? "You are here" : "Coming next"}</small>
            </button>
          </li>
        ))}
      </ol>
      <div className="journey-notebook" aria-live="polite" aria-atomic="true">
        <h3>{entry ? `${theme.step} ${selected + 1} · explored` : "Your next discovery"}</h3>
        <p>{entry?.prompt || currentPrompt}</p>
        {entry && <p>{entry.feedback}</p>}
        {entry?.repaired && <p className="journey-repair">You tried again and found a way forward.</p>}
      </div>
    </section>
  );
}

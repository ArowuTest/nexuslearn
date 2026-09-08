"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Dino from "@/components/Dino";
import { clearPupilSession } from "@/lib/api";
import { currentPupilId, loadPupilJourney, pupilMissionURL, type PupilJourneyView } from "@/lib/pupil-journey";
import styles from "./today.module.css";

const subjectSymbols: Record<string, string> = { English: "✦", Mathematics: "+", Science: "◌" };
const yearSymbols = ["🌱", "📖", "🧭", "⚙", "🏙", "◆", "⚛"];

export default function PupilToday() {
  const [view, setView] = useState<PupilJourneyView>({ kind: "loading" });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const pupilId = currentPupilId();
    void loadPupilJourney(controller.signal).then(result => { if (active) setView(result); }).catch(() => { if (active) setView({ kind: "access" }); });
    const revisit = () => { setView({ kind: "loading" }); setVersion(value => value + 1); };
    const visible = () => { if (document.visibilityState === "visible") revisit(); };
    const restored = (event: PageTransitionEvent) => { if (event.persisted) revisit(); };
    const checkAccess = () => { if (!currentPupilId() || currentPupilId() !== pupilId) { active = false; controller.abort(); setView({ kind: "access" }); } };
    const accessTimer = window.setInterval(checkAccess, 30_000);
    window.addEventListener("pageshow", restored);
    document.addEventListener("visibilitychange", visible);
    return () => { active = false; controller.abort(); clearInterval(accessTimer); window.removeEventListener("pageshow", restored); document.removeEventListener("visibilitychange", visible); };
  }, [version]);

  const data = view.kind === "ready" ? view.data : null;
  const adaptations = data?.next?.runtime_adaptations;
  const quiet = !adaptations || adaptations.reduced_motion || ["low", "static"].includes(adaptations.animation_tier ?? "") || adaptations.celebration_intensity === "quiet";
  const missionURL = data ? pupilMissionURL(data) : "";
  const review = data?.next?.assessment_mode === "review";
  const check = ["diagnostic", "assessment"].includes(data?.next?.assessment_mode ?? "");
  const savedState = data?.world?.state;
  const artefacts = savedState && typeof savedState === "object" && !Array.isArray(savedState)
    ? savedState.artefacts === undefined ? [] : Array.isArray(savedState.artefacts) ? savedState.artefacts.filter((item): item is string => typeof item === "string") : null
    : null;
  const symbol = yearSymbols[Math.max(0, Math.min(6, (data?.profile.year_group ?? 1) - 1))];
  const supports = [
    quiet && "Calm movement", adaptations?.audio_support && "Audio replay", adaptations?.simple_text && "Simple text",
    adaptations?.visual_guide && "Visual steps", adaptations?.session_length === "short" && "Short steps",
    adaptations?.high_contrast && "High contrast", adaptations?.switch_access && "Switch access",
  ].filter(Boolean);
  const retry = () => { setView({ kind: "loading" }); setVersion(value => value + 1); };
  function switchCard() { clearPupilSession(); setView({ kind: "access" }); setVersion(value => value + 1); }

  return (
    <main className={`${styles.today} ${quiet ? "reduced-motion" : ""} ${adaptations?.high_contrast ? "high-contrast" : ""}`} data-testid="pupil-today">
      <div className={styles.wrap}>
        <a className={styles.skip} href="#today-route">Skip to my route</a>
        <header className={styles.header}>
          <Link href="/" aria-label="NexusLearn home">NexusLearn<span>YOUR LEARNING ADVENTURE</span></Link>
          {view.kind !== "access" && <button type="button" onClick={switchCard}>Use a different card</button>}
        </header>

        {!data ? <section id="today-route" className={styles.state} aria-live="polite">
          <Dino mood="idle" size={100} />
          <h1>{view.kind === "loading" ? "Opening your learning route" : view.kind === "access" ? "Your adventure starts with your card" : view.kind === "paused" ? "Your world is taking a short break" : "We couldn't open your route"}</h1>
          <p>{view.kind === "loading" ? "Finding your next step…" : view.kind === "access" ? "Use your school or family card to find your learning." : view.kind === "paused" ? "An adult is preparing your learning world. Please try again later." : "Your progress hasn't been changed. Check your connection and try again."}</p>
          {view.kind === "access" && <Link className={styles.primary} href="/login">Use my access card</Link>}
          {view.kind === "unavailable" && <button className={styles.primary} type="button" onClick={retry}>Try again</button>}
          <Link className={styles.quietLink} href="/play">Explore learning worlds</Link>
        </section> : <>
          <section className={styles.welcome} aria-labelledby="today-heading">
            <div><p className={styles.eyebrow}>TODAY IS A NEW DISCOVERY</p><h1 id="today-heading">Ready, {data.profile.display_name || "explorer"}?</h1><p>{data.profile.year_group <= 3 ? "One small step. Something new to discover." : "Follow your curiosity. Build your next discovery."}</p></div>
            <div className={styles.companion}><Dino mood={quiet ? "idle" : "happy"} size={110} /><span>{data.profile.companion_name || "Your companion"} is with you</span></div>
          </section>

          <ol id="today-route" aria-label="Today's learning route" className={styles.route}>
            {[
              ["01", "Warm up", review ? "An earlier idea is ready to revisit." : "Review returns when an earlier idea is due."],
              ["02", "Mission", "Notice. Try. Find a way forward."],
              ["03", "Grow", "Keep discoveries. Come back to remember."],
            ].map(([number, title, detail], index) => <li key={number} aria-current={missionURL && index === (review ? 0 : 1) ? "step" : undefined}>
              <span aria-hidden="true">{number}</span><div><h2>{title}</h2><p>{detail}</p></div>
            </li>)}
          </ol>

          <div className={styles.mainGrid}>
            <section className={styles.mission} aria-labelledby="next-heading">
              <p className={styles.eyebrow}>{review ? "REMEMBER & RECONNECT" : check ? "FIND YOUR NEXT STEP" : "YOUR NEXT ADVENTURE"}</p>
              <h2 id="next-heading">{missionURL ? data.next?.activity_title || data.next?.realm || "Your next learning step" : "Your next step is being prepared"}</h2>
              {missionURL && data.next?.subject && <p className={styles.small}>{data.next.subject}</p>}
              {missionURL && data.next?.learning_focus && <p>{data.next.learning_focus}</p>}
              <p>{missionURL ? review ? "Revisit an idea you have met before. Your next activity will follow what you show today." : check ? "Show what you know. Take your time: this helps choose what to learn next." : "Explore an idea, practise and show what you can do. Mistakes help us find a useful next step." : "We couldn't confirm a learning activity. No guessed mission has been opened."}</p>
              {missionURL ? <Link href={missionURL} className={styles.primary}>{review ? "Start warm-up" : check ? "Start my check" : "Start mission"}</Link> : <button className={styles.primary} type="button" onClick={retry}>Check my route again</button>}
              {missionURL && <Link className={styles.quietLink} href={`${missionURL}#mission-support`}>Audio & learning tools</Link>}
              {missionURL && <details className={styles.details}><summary>Why this step?</summary><p>{review ? "Remembering an earlier idea helps it stay with you." : check ? "What you show helps us find a useful starting point." : "This step is chosen from your learning route. You can use support and take your time."}</p></details>}
              {supports.length > 0 && <div className={styles.supports} aria-label="Your learning supports">{supports.map(support => <span key={String(support)}>{support}</span>)}</div>}
              <p className={styles.small}>Support helps you take part. It never takes away your chance to explore.</p>
            </section>

            <section className={styles.growth} aria-label="Your world growth">
              <p className={styles.eyebrow}>BUILT BY YOUR LEARNING</p>
              <div className={styles.world} aria-hidden="true"><span>{symbol}</span><i /><i /><i /></div>
              <h2>{data.worldName}</h2>
              {artefacts ? <><p className={styles.discoveryCount}>{artefacts.length} {artefacts.length === 1 ? "discovery" : "discoveries"} saved</p><p>{artefacts.length ? "Your saved discoveries stay with you, even when an idea needs another try." : "Your first discovery is still to come. There is no rush."}</p>
                {artefacts.length > 0 && <details className={styles.details}><summary>Open my discoveries</summary><ul>{artefacts.map((item, index) => <li key={`${item}-${index}`}><span aria-hidden="true">✦ </span>{item.replaceAll(/[_-]/g, " ")}</li>)}</ul></details>}
              </> : <p>Your saved discoveries are unavailable right now. Nothing has been reset.</p>}
            </section>
          </div>

          <section className={styles.subjects} aria-labelledby="subjects-heading">
            <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>YOUR OWN PACE, IN EVERY SUBJECT</p><h2 id="subjects-heading">See how your learning grows</h2></div><p>A strong subject can move ahead. Other subjects keep their own next steps, with earlier ideas returning for practice.</p></div>
            {Array.isArray(data.progress?.subjects) && data.progress.subjects.length > 0 ? <div className={styles.subjectGrid}>{data.progress.subjects.map(subject => <section key={subject.subject} aria-label={`${subject.subject} progress`} className={styles.subject}>
              <span className={styles.subjectSymbol} aria-hidden="true">{subjectSymbols[subject.subject] || "✦"}</span><h3>{subject.subject}</h3>
              <p>{subject.years?.some(year => year.year === subject.working_year && year.sampled_objectives > 0) ? `Exploring Year ${subject.working_year}` : subject.stretch_allowed ? `Ready to explore Year ${subject.stretch_year}` : subject.sampled_objectives > 0 ? `Exploring Year ${subject.current_year}` : "Ready for a first discovery"}</p>
              {subject.sampled_objectives > 0 && <p className={styles.small}>Year {subject.current_year}: {subject.secure_objectives} {subject.secure_objectives === 1 ? "idea" : "ideas"} secure for now · {subject.sampled_objectives} explored</p>}
              {subject.years?.filter(year => year.year === subject.working_year && year.year !== subject.current_year && year.sampled_objectives > 0).map(year => <p className={styles.small} key={year.year}>Year {year.year}: {year.secure_objectives} {year.secure_objectives === 1 ? "idea" : "ideas"} secure for now · {year.sampled_objectives} explored</p>)}
            </section>)}</div> : <p>{data.progress ? "Your first learning discoveries will appear here." : "Your subject progress is unavailable right now."}</p>}
            <p className={styles.small}>This shows the ideas explored here, not completion of a whole year&apos;s curriculum.</p>
          </section>
          <footer className={styles.footer}><p>Want a separate practice check? It doesn&apos;t change your learning route.</p><Link href={`/play/mock?studentId=${encodeURIComponent(data.studentId)}`}>Build a subject check</Link><button type="button" onClick={retry}>Refresh my route</button></footer>
        </>}
      </div>
    </main>
  );
}

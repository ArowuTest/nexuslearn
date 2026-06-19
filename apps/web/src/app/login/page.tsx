"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import Dino from "@/components/Dino";
import { pupilLogin, storePupilSession, type PupilLoginResult } from "@/lib/api";

const picturePool = ["star", "book", "sun", "tree", "rocket", "moon", "shell", "key"];

export default function PupilLoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <PupilLoginContent />
    </Suspense>
  );
}

function PupilLoginContent() {
  const params = useSearchParams();
  const initialPupil = params.get("pupil") ?? "";
  const initialCode = params.get("code") ?? "";
  const card = params.get("card") ?? "";
  const requestedWorld = params.get("world") ?? "";
  const [studentRef, setStudentRef] = useState(initialPupil);
  const [loginCode, setLoginCode] = useState(initialCode);
  const [pictures, setPictures] = useState<string[]>([]);
  const [result, setResult] = useState<PupilLoginResult | null>(null);
  const [message, setMessage] = useState(initialCode ? "QR card found. Choose your pictures in order." : "Use the login card from your school or parent.");
  const [saving, setSaving] = useState(false);

  const launchURL = useMemo(() => {
    if (!result?.student?.external_ref) return "/play";
    const query = new URLSearchParams({ studentId: result.student.external_ref });
    if (result.next_activity?.activity_id) {
      query.set("activityId", result.next_activity.activity_id);
      query.set("mode", result.next_activity.assessment_mode);
    }
    else if (requestedWorld) query.set("world", requestedWorld);
    return `/play/mission?${query.toString()}`;
  }, [requestedWorld, result]);

  async function submit() {
    setSaving(true);
    setMessage("Checking your card...");
    setResult(null);
    try {
      const loggedIn = await pupilLogin({
        student_external_ref: studentRef.trim(),
        login_code: loginCode.trim().toUpperCase(),
        picture_password: pictures,
        qr_secret_hash: card,
      });
      setResult(loggedIn);
      storePupilSession(loggedIn);
      setMessage(`Welcome ${loggedIn.student.display_name || "learner"}. Your mission is ready.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not log in.");
    } finally {
      setSaving(false);
    }
  }

  function choosePicture(value: string) {
    if (pictures.length >= 6) return;
    setPictures([...pictures, value]);
  }

  return (
    <main className="min-h-screen bg-[#111a33] text-white">
      <div className="mx-auto max-w-6xl px-5 py-5">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="font-display text-xl font-semibold">NexusLearn</Link>
          <Link href="/play" className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold">Play worlds</Link>
        </nav>

        <section className="grid items-start gap-6 py-8 lg:grid-cols-[0.72fr_1.28fr]">
          <aside className="rounded-lg border border-white/10 bg-white/8 p-6">
            <p className="font-display text-sm uppercase tracking-[0.18em] text-[#ffdf8a]">Pupil login</p>
            <h1 className="font-display mt-3 text-4xl font-semibold leading-tight md:text-5xl">Open your learning card.</h1>
            <p className="mt-4 leading-7 text-white/70">
              Children can use a school card, login code and picture password without needing an email account.
            </p>
            <div className="mt-6 flex justify-center">
              <Dino mood={result ? "celebrate" : "happy"} size={170} />
            </div>
          </aside>

          <section className="overflow-hidden rounded-lg bg-white text-[#17233f] shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
            <div className="border-b border-[#17233f]/10 bg-[#f7f0df] p-6">
              <p className="font-display text-sm uppercase tracking-[0.16em] text-[#7357c9]">Card details</p>
              <h2 className="font-display mt-2 text-3xl font-semibold">School-safe access</h2>
              <p className="mt-2 text-sm leading-6 text-[#17233f]/62">{message}</p>
            </div>

            <div className="grid gap-0 border-b border-[#17233f]/10 md:grid-cols-2">
              <Field label="Pupil ID" value={studentRef} onChange={setStudentRef} />
              <Field label="Login code" value={loginCode} onChange={(value) => setLoginCode(value.toUpperCase())} />
            </div>

            <div className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-2xl font-semibold">Picture password</h3>
                  <p className="mt-1 text-sm text-[#17233f]/58">Choose the pictures from your card in the same order.</p>
                </div>
                <button onClick={() => setPictures([])} className="rounded-lg bg-[#f7f0df] px-4 py-2 text-sm font-semibold">Clear</button>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
                {picturePool.map((picture) => (
                  <button key={picture} onClick={() => choosePicture(picture)} className="tile-press rounded-lg border border-[#17233f]/10 bg-[#f7f0df] px-3 py-3 text-sm font-semibold">
                    {labelForPicture(picture)}
                  </button>
                ))}
              </div>
              <div className="mt-4 min-h-12 rounded-lg border border-[#17233f]/10 bg-white p-3">
                {pictures.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {pictures.map((picture, index) => (
                      <span key={`${picture}-${index}`} className="rounded-lg bg-[#55cbd3]/20 px-3 py-2 text-sm font-semibold text-[#155d64]">{index + 1}. {labelForPicture(picture)}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#17233f]/48">No pictures selected yet.</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#17233f]/10 bg-[#fbfaf6] p-6">
              <p className="max-w-xl text-sm leading-6 text-[#17233f]/62">
                The platform checks the login code and picture sequence, then routes the child to their configured mission.
              </p>
              {result ? (
                <Link href={launchURL} className="btn-pop bg-[#ffbf45] px-6 py-4 text-sm text-[#17233f]">Start mission</Link>
              ) : (
                <button onClick={submit} disabled={!studentRef || !loginCode || saving} className="btn-pop bg-[#ffbf45] px-6 py-4 text-sm disabled:opacity-50">
                  {saving ? "Checking" : "Log in"}
                </button>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function LoginShell() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#111a33] px-5 text-white">
      <section className="rounded-lg border border-white/10 bg-white/8 p-8 text-center">
        <p className="font-display text-sm uppercase tracking-[0.18em] text-[#ffdf8a]">Pupil login</p>
        <h1 className="font-display mt-3 text-4xl font-semibold">Opening your card...</h1>
      </section>
    </main>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block p-6">
      <span className="text-sm font-semibold text-[#17233f]/70">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border border-[#17233f]/14 px-4 py-3 text-sm outline-none focus:border-[#7357c9]" />
    </label>
  );
}

function labelForPicture(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import Dino from "@/components/Dino";
import LoginPicture from "@/components/LoginPicture";
import { clearPupilSession, pupilLogin, storePupilSession, type PupilLoginResult } from "@/lib/api";

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
  return <PupilLoginForm key={params.toString()} initialPupil={params.get("pupil") ?? ""} initialCode={params.get("code") ?? ""} card={params.get("card") ?? ""} />;
}

function PupilLoginForm({ initialPupil, initialCode, card }: { initialPupil: string; initialCode: string; card: string }) {
  const [studentRef, setStudentRef] = useState(initialPupil);
  const [loginCode, setLoginCode] = useState(initialCode);
  const [pictures, setPictures] = useState<string[]>([]);
  const [result, setResult] = useState<PupilLoginResult | null>(null);
  const [message, setMessage] = useState(initialCode ? "QR card found. Choose your pictures in order." : "Use the login card from your school or parent.");
  const [saving, setSaving] = useState(false);
  const [qrSecret, setQrSecret] = useState(card);
  const requestVersion = useRef(0);

  useEffect(() => {
    clearPupilSession();
    return () => { requestVersion.current += 1; };
  }, []);

  function invalidateCard() {
    requestVersion.current += 1;
    clearPupilSession();
    setResult(null);
    setSaving(false);
    setMessage("Choose your pictures, then log in.");
  }

  function changeIdentity(field: "pupil" | "code", value: string) {
    invalidateCard();
    setPictures([]);
    setQrSecret("");
    if (field === "pupil") setStudentRef(value);
    else setLoginCode(value.toUpperCase());
  }

  async function submit() {
    const request = ++requestVersion.current;
    setSaving(true);
    setMessage("Checking your card...");
    setResult(null);
    try {
      // A failed attempt with a different card must not retain the old child.
      clearPupilSession();
      const loggedIn = await pupilLogin({
        student_external_ref: studentRef.trim(),
        login_code: loginCode.trim().toUpperCase(),
        picture_password: pictures,
        qr_secret_hash: qrSecret,
      });
      if (request !== requestVersion.current) return;
      setResult(loggedIn);
      storePupilSession(loggedIn);
      setMessage(`Welcome ${loggedIn.student.display_name || "learner"}. Your learning route is ready.`);
    } catch (error) {
      if (request === requestVersion.current) setMessage(error instanceof Error ? error.message : "Could not log in.");
    } finally {
      if (request === requestVersion.current) setSaving(false);
    }
  }

  function choosePicture(value: string) {
    if (pictures.length >= 6) return;
    invalidateCard();
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
              <Field label="Pupil ID" value={studentRef} onChange={(value) => changeIdentity("pupil", value)} />
              <Field label="Login code" value={loginCode} onChange={(value) => changeIdentity("code", value)} />
            </div>

            <div className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-2xl font-semibold">Picture password</h3>
                  <p className="mt-1 text-sm text-[#17233f]/58">Choose the pictures from your card in the same order.</p>
                </div>
                <button onClick={() => { invalidateCard(); setPictures([]); }} className="rounded-lg bg-[#f7f0df] px-4 py-2 text-sm font-semibold">Clear</button>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
                {picturePool.map((picture) => (
                  <button key={picture} aria-label={labelForPicture(picture)} onClick={() => choosePicture(picture)} className="tile-press flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border border-[#17233f]/10 bg-[#f7f0df] px-1 py-3 text-xs font-semibold">
                    <LoginPicture picture={picture} />
                    <span aria-hidden="true">{labelForPicture(picture)}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 min-h-12 rounded-lg border border-[#17233f]/10 bg-white p-3">
                {pictures.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {pictures.map((picture, index) => (
                      <span key={`${picture}-${index}`} className="flex items-center gap-2 rounded-lg bg-[#55cbd3]/20 px-3 py-2 text-sm font-semibold text-[#155d64]">{index + 1}. <LoginPicture picture={picture} size={24} /><span aria-hidden="true">{labelForPicture(picture)}</span></span>
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
                <div className="flex flex-wrap gap-2">
                  <Link href="/play/today" className="btn-pop bg-[#ffbf45] px-6 py-4 text-sm text-[#17233f]">See my route</Link>
                </div>
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

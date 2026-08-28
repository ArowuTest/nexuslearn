"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import QRCode from "qrcode";
import { loginCardURL } from "@/components/role-workspaces/loginCardURL.mjs";

type StudentCredential = {
  student_external_ref: string;
  display_name?: string;
  login_code: string;
  picture_password: string[];
  qr_secret_hash?: string;
};

const subscribeToStaticOrigin = () => () => {};

export function Panel({ id, title, children, action = null }: { id?: string; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 overflow-hidden rounded-lg bg-white shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-[#17233f]/10 p-5">
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        {action}
      </div>
      <div className="divide-y divide-[#17233f]/10">{children}</div>
    </section>
  );
}

export function LoginCard({ credential, schoolName }: { credential: StudentCredential; schoolName: string }) {
  const picturePassword = credential.picture_password ?? [];
  const currentOrigin = useSyncExternalStore(subscribeToStaticOrigin, () => window.location.origin, () => "");
  const loginURL = loginCardURL(credential, currentOrigin, process.env.NEXT_PUBLIC_APP_ORIGIN);
  return (
    <article className="break-inside-avoid rounded-lg border-2 border-[#17233f] bg-white p-5 text-[#17233f]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.16em] text-[#7357c9]">NexusLearn</p>
          <h3 className="font-display mt-1 text-2xl font-semibold">{credential.display_name || credential.student_external_ref}</h3>
          <p className="mt-1 text-xs text-[#17233f]/56">{schoolName}</p>
        </div>
        {loginURL ? <QRCodeMark value={loginURL} /> : <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-[#17233f]/20 bg-[#f7f0df] p-2 text-center text-[10px] font-semibold text-[#17233f]/58" role="status">QR available after secure page load</div>}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Info label="Login code" value={credential.login_code || "Picture login"} />
        <Info label="Pupil ID" value={credential.student_external_ref} />
      </div>
      <div className="mt-4 rounded-lg bg-[#f7f0df] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#17233f]/50">Picture password</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {picturePassword.length > 0 ? picturePassword.map((item, index) => <span key={`${item}-${index}`} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold shadow-sm">{friendly(item)}</span>) : <span className="text-sm text-[#17233f]/58">Use the login code shown above.</span>}
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-[#17233f]/58">Scan the QR code or go to NexusLearn, enter the code, then choose the pictures in order. Do not share this card outside the learner&apos;s trusted adults.</p>
    </article>
  );
}

function QRCodeMark({ value }: { value: string }) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) if (qr.modules.get(x, y)) cells.push([x, y]);
  return <svg viewBox={`0 0 ${size} ${size}`} className="h-24 w-24 shrink-0 rounded-lg border border-[#17233f]/20 bg-white p-1" role="img" aria-label="QR login code" data-login-url={value}><rect width={size} height={size} fill="#ffffff" />{cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#17233f" />)}</svg>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-[#17233f]/12 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#17233f]/48">{label}</p><p className="mt-1 break-words font-display text-lg font-semibold">{value}</p></div>;
}

export function Field({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (value: string) => void; type?: "text" | "number" | "password" | "datetime-local" }) {
  return <label className="block p-5"><span className="text-sm font-semibold text-[#17233f]/70">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border border-[#17233f]/14 px-4 py-3 text-sm outline-none focus:border-[#7357c9]" /></label>;
}

export function PurposeSelect({ value, values, onChange }: { value: string; values: string[]; onChange: (value: string) => void }) {
  return <LabeledSelect label="Purpose" value={value} values={values} onChange={onChange} />;
}

export function LabeledSelect({ label, value, values, labels = {}, onChange }: { label: string; value: string; values: string[]; labels?: Record<string, string>; onChange: (value: string) => void }) {
  return <label className="block p-5"><span className="text-sm font-semibold text-[#17233f]/70">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border border-[#17233f]/14 px-4 py-3 text-sm outline-none focus:border-[#7357c9]">{values.map((item) => <option key={item || "blank"} value={item}>{labels[item] || friendly(item) || "Select..."}</option>)}</select></label>;
}

export function ChoiceGrid({ label, hint, values, selected, onChange }: { label: string; hint?: string; values: string[]; selected: string[]; onChange: (values: string[]) => void }) {
  return <fieldset className="p-5"><legend className="text-sm font-semibold text-[#17233f]/70">{label}</legend>{hint ? <p className="mt-1 text-xs leading-5 text-[#17233f]/52">{hint}</p> : null}<div className="mt-3 grid gap-2 sm:grid-cols-2">{values.map((value) => <label key={value} className="flex items-center gap-3 rounded-lg border border-[#17233f]/12 px-3 py-2 text-sm"><input type="checkbox" checked={selected.includes(value)} onChange={(event) => onChange(event.target.checked ? [...selected, value] : selected.filter((item) => item !== value))} className="h-4 w-4 accent-[#7357c9]" /><span>{friendly(value)}</span></label>)}</div></fieldset>;
}

export function BooleanField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex items-center gap-3 p-5 text-sm font-semibold text-[#17233f]/70"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-[#7357c9]" />{label}</label>;
}

export function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block p-5"><span className="text-sm font-semibold text-[#17233f]/70">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="mt-2 w-full rounded-lg border border-[#17233f]/14 px-4 py-3 text-sm outline-none focus:border-[#7357c9]" /></label>;
}

export function Row({ title, meta, body, onClick, action = null }: { title: string; meta: string; body: string; onClick?: () => void; action?: ReactNode }) {
  return <div className="flex w-full flex-wrap items-start justify-between gap-4 p-5 text-left hover:bg-[#f7f0df]"><button onClick={onClick} disabled={!onClick} className="min-w-0 flex-1 text-left disabled:cursor-default"><div className="flex items-start justify-between gap-3"><p className="font-semibold">{title}</p><span className="rounded-lg bg-[#7357c9]/12 px-3 py-1 text-xs font-semibold text-[#4d3690]">{meta}</span></div><p className="mt-2 text-sm text-[#17233f]/58">{body}</p></button>{action}</div>;
}

export function Actions({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return <div className="flex justify-end p-5"><button onClick={onClick} disabled={disabled} className="btn-pop bg-[#ffbf45] px-5 py-3 text-sm disabled:opacity-50">{label}</button></div>;
}

export function LearnerScopeNotice({ purpose, learner }: { purpose: string; learner?: { external_ref: string; display_name: string; year_group: number } }) {
  return (
    <div className="p-5">
      <p className="rounded-xl border border-[#55cbd3]/30 bg-[#f3fbfc] p-4 text-sm font-semibold text-[#155d64]">
        {learner ? `Selected school learner for ${purpose}: ${learner.display_name} / Year ${learner.year_group}` : `Choose the selected school learner above before using this ${purpose} tool.`}
      </p>
    </div>
  );
}

function friendly(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

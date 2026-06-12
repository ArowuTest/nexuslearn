"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

type Student = { external_ref: string; display_name: string; year_group: number };
type ClassGroup = { id?: string; school_urn?: string; name: string; year_group: number; students?: Student[] };
type LearningGroup = { id?: string; class_id: string; class_name?: string; name: string; purpose: string; students?: Student[] };
type StudentCredential = { student_external_ref: string; display_name?: string; login_code: string; picture_password: string[] };
type SchoolPortal = {
  school?: { urn: string; name: string; status: string };
  classes?: ClassGroup[];
  groups?: LearningGroup[];
  student_credentials?: StudentCredential[];
};

const API = process.env.NEXT_PUBLIC_API_URL;
const picturePool = ["star", "book", "sun", "tree", "rocket", "moon", "shell", "key"];

export default function SchoolAdminPage() {
  const [schoolURN, setSchoolURN] = useState("");
  const [loginID, setLoginID] = useState("");
  const [password, setPassword] = useState("");
  const [portal, setPortal] = useState<SchoolPortal | null>(null);
  const [message, setMessage] = useState("Use the school login details issued by platform admin.");
  const [saving, setSaving] = useState(false);
  const [student, setStudent] = useState<Student>({ external_ref: "", display_name: "", year_group: 1 });
  const [classDraft, setClassDraft] = useState<ClassGroup>({ id: "", name: "", year_group: 1, students: [] });
  const [assignment, setAssignment] = useState({ class_id: "", student_external_ref: "" });
  const [group, setGroup] = useState<LearningGroup>({ id: "", class_id: "", name: "", purpose: "intervention", students: [] });

  const totals = useMemo(() => {
    const students = new Set<string>();
    (portal?.classes ?? []).forEach((item) => (item.students ?? []).forEach((learner) => students.add(learner.external_ref)));
    return [
      ["Classes", portal?.classes?.length ?? 0],
      ["Groups", portal?.groups?.length ?? 0],
      ["Pupils", students.size],
      ["Login packs", portal?.student_credentials?.length ?? 0],
    ];
  }, [portal]);

  function headers() {
    return {
      "Content-Type": "application/json",
      "X-School-URN": schoolURN,
      "X-School-Login": loginID,
      "X-School-Password": password,
    };
  }

  async function apiFetch(path: string, options: RequestInit = {}) {
    if (!API) throw new Error("API is not configured.");
    const res = await fetch(`${API}${path}`, { ...options, headers: { ...headers(), ...(options.headers ?? {}) } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? "Request failed.");
    return body;
  }

  async function load() {
    await guarded("Loading school workspace...", async () => {
      const data = await apiFetch("/v1/school/config");
      setPortal(data as SchoolPortal);
      setMessage("School workspace loaded.");
    });
  }

  async function saveStudent() {
    await guarded("Creating pupil...", async () => {
      await apiFetch(`/v1/school/students/${slug(student.external_ref)}`, {
        method: "PUT",
        body: JSON.stringify({ display_name: student.display_name, year_group: Number(student.year_group) }),
      });
      setStudent({ external_ref: "", display_name: "", year_group: 1 });
      await load();
    });
  }

  async function saveClass() {
    await guarded("Saving class...", async () => {
      await apiFetch(`/v1/school/classes/${classDraft.id || slug(classDraft.name)}`, {
        method: "PUT",
        body: JSON.stringify({ name: classDraft.name, year_group: Number(classDraft.year_group) }),
      });
      setClassDraft({ id: "", name: "", year_group: 1, students: [] });
      await load();
    });
  }

  async function assignStudent() {
    await guarded("Adding pupil to class...", async () => {
      await apiFetch(`/v1/school/classes/${assignment.class_id}/students/${slug(assignment.student_external_ref)}`, { method: "PUT", body: "{}" });
      setAssignment({ class_id: assignment.class_id, student_external_ref: "" });
      await load();
    });
  }

  async function generateCredentials(classID: string) {
    await guarded("Generating login cards...", async () => {
      await apiFetch(`/v1/school/classes/${classID}/credentials`, {
        method: "PUT",
        body: JSON.stringify({ overwrite: false, picture_pool: picturePool }),
      });
      await load();
    });
  }

  async function saveGroup() {
    await guarded("Saving group...", async () => {
      await apiFetch(`/v1/school/groups/${group.id || slug(group.name)}`, {
        method: "PUT",
        body: JSON.stringify({ class_id: group.class_id, name: group.name, purpose: group.purpose }),
      });
      setGroup({ id: "", class_id: "", name: "", purpose: "intervention", students: [] });
      await load();
    });
  }

  async function guarded(progress: string, action: () => Promise<void>) {
    setSaving(true);
    setMessage(progress);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f0df] px-5 py-8 text-[#17233f]">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.18em] text-[#7357c9]">School workspace</p>
            <h1 className="font-display mt-2 text-4xl font-semibold">Classes, groups and pupil access</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#17233f]/64">
              Schools manage their own internal structure here. Pupils use generated login codes and picture passwords, not email accounts.
            </p>
          </div>
          <Link href="/" className="btn-pop bg-white px-5 py-3 text-sm shadow-card">Home</Link>
        </div>

        <section className="mt-8 grid gap-4 rounded-lg bg-white p-5 shadow-card md:grid-cols-[1fr_1fr_1fr_auto]">
          <Field label="School URN" value={schoolURN} onChange={setSchoolURN} />
          <Field label="Login ID" value={loginID} onChange={setLoginID} />
          <Field label="Temporary password" value={password} onChange={setPassword} type="password" />
          <button onClick={load} disabled={!schoolURN || !loginID || !password || saving} className="btn-pop self-end bg-[#ffbf45] px-5 py-3 text-sm disabled:opacity-50">
            Load
          </button>
        </section>

        <p className="mt-4 rounded-lg bg-white/72 px-4 py-3 text-sm text-[#17233f]/66">{message}</p>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          {totals.map(([label, value]) => (
            <article key={label} className="rounded-lg bg-white p-5 shadow-card">
              <p className="font-display text-3xl font-semibold">{value}</p>
              <p className="mt-1 text-sm text-[#17233f]/58">{label}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 grid items-start gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="grid gap-6">
            <Panel title="Classes">
              {(portal?.classes ?? []).map((item) => (
                <Row key={item.id} title={item.name} meta={`Year ${item.year_group}`} body={`${(item.students ?? []).length} pupils / ID ${item.id}`} onClick={() => {
                  setClassDraft({ ...item });
                  setAssignment({ ...assignment, class_id: item.id ?? "" });
                  setGroup({ ...group, class_id: item.id ?? "" });
                }} />
              ))}
            </Panel>
            <Panel title="Pupil Login Packs">
              {(portal?.student_credentials ?? []).map((credential) => (
                <article key={credential.student_external_ref} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="font-semibold">{credential.display_name || credential.student_external_ref}</p>
                    <span className="rounded-lg bg-[#55cbd3]/20 px-3 py-1 text-xs font-semibold text-[#155d64]">{credential.login_code}</span>
                  </div>
                  <p className="mt-2 text-sm text-[#17233f]/58">{credential.picture_password.join(" / ")}</p>
                </article>
              ))}
            </Panel>
          </div>

          <div className="grid gap-6">
            <Panel title="Create Pupil">
              <Field label="Pupil ID" value={student.external_ref} onChange={(external_ref) => setStudent({ ...student, external_ref: slug(external_ref) })} />
              <Field label="Display name" value={student.display_name} onChange={(display_name) => setStudent({ ...student, display_name })} />
              <Field label="Year group" type="number" value={student.year_group} onChange={(year_group) => setStudent({ ...student, year_group: Number(year_group) })} />
              <Actions label="Create pupil" disabled={!student.external_ref || !student.display_name || saving} onClick={saveStudent} />
            </Panel>
            <Panel title="Create Class">
              <Field label="Class ID" value={classDraft.id ?? ""} onChange={(id) => setClassDraft({ ...classDraft, id: slug(id) })} />
              <Field label="Class name" value={classDraft.name} onChange={(name) => setClassDraft({ ...classDraft, name })} />
              <Field label="Year group" type="number" value={classDraft.year_group} onChange={(year_group) => setClassDraft({ ...classDraft, year_group: Number(year_group) })} />
              <Actions label="Save class" disabled={!classDraft.name || saving} onClick={saveClass} />
            </Panel>
            <Panel title="Class Access">
              <Field label="Class ID" value={assignment.class_id} onChange={(class_id) => setAssignment({ ...assignment, class_id })} />
              <Field label="Pupil ID" value={assignment.student_external_ref} onChange={(student_external_ref) => setAssignment({ ...assignment, student_external_ref: slug(student_external_ref) })} />
              <div className="flex flex-wrap justify-end gap-3 p-5">
                <button onClick={assignStudent} disabled={!assignment.class_id || !assignment.student_external_ref || saving} className="btn-pop bg-[#55cbd3] px-5 py-3 text-sm disabled:opacity-50">Add pupil</button>
                <button onClick={() => generateCredentials(assignment.class_id)} disabled={!assignment.class_id || saving} className="btn-pop bg-[#ffbf45] px-5 py-3 text-sm disabled:opacity-50">Generate logins</button>
              </div>
            </Panel>
            <Panel title="Teaching Group">
              <Field label="Group ID" value={group.id ?? ""} onChange={(id) => setGroup({ ...group, id: slug(id) })} />
              <Field label="Class ID" value={group.class_id} onChange={(class_id) => setGroup({ ...group, class_id })} />
              <Field label="Group name" value={group.name} onChange={(name) => setGroup({ ...group, name })} />
              <Select value={group.purpose} values={["intervention", "challenge", "phonics", "fluency", "senco", "teacher-defined"]} onChange={(purpose) => setGroup({ ...group, purpose })} />
              <Actions label="Save group" disabled={!group.class_id || !group.name || saving} onClick={saveGroup} />
            </Panel>
          </div>
        </section>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg bg-white shadow-card">
      <div className="border-b border-[#17233f]/10 p-5">
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
      </div>
      <div className="divide-y divide-[#17233f]/10">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (value: string) => void; type?: "text" | "number" | "password" }) {
  return (
    <label className="block p-5">
      <span className="text-sm font-semibold text-[#17233f]/70">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border border-[#17233f]/14 px-4 py-3 text-sm outline-none focus:border-[#7357c9]" />
    </label>
  );
}

function Select({ value, values, onChange }: { value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block p-5">
      <span className="text-sm font-semibold text-[#17233f]/70">Purpose</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border border-[#17233f]/14 px-4 py-3 text-sm outline-none focus:border-[#7357c9]">
        {values.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  );
}

function Row({ title, meta, body, onClick }: { title: string; meta: string; body: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="block w-full p-5 text-left hover:bg-[#f7f0df]">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">{title}</p>
        <span className="rounded-lg bg-[#7357c9]/12 px-3 py-1 text-xs font-semibold text-[#4d3690]">{meta}</span>
      </div>
      <p className="mt-2 text-sm text-[#17233f]/58">{body}</p>
    </button>
  );
}

function Actions({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <div className="flex justify-end p-5">
      <button onClick={onClick} disabled={disabled} className="btn-pop bg-[#ffbf45] px-5 py-3 text-sm disabled:opacity-50">{label}</button>
    </div>
  );
}

function slug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

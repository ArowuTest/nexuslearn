import type { ReactNode } from "react";

export function EditorGrid({ left, right }: { left: ReactNode; right: ReactNode }) {
  return <section className="mt-6 grid items-start gap-6 lg:grid-cols-[0.9fr_1.1fr]">{left}{right}</section>;
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden bg-white shadow-card">
      <div className="border-b border-[#1d1a3e]/8 p-5">
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
      </div>
      <div className="divide-y divide-[#1d1a3e]/8">{children}</div>
    </section>
  );
}

export function PickRow({ title, meta, body, onClick }: { title: string; meta: string; body: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="block w-full p-5 text-left transition-colors hover:bg-[#f6f3ea]">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">{title}</p>
        <span className="bg-[#55cbd3]/20 px-3 py-1 text-xs font-semibold text-[#155d64]">{meta}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#1d1a3e]/58">{body}</p>
    </button>
  );
}

export function AdminListPager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="flex items-center justify-between gap-3 border-t border-[#1d1a3e]/8 p-4 text-xs" aria-label="List pagination">
      <span className="text-[#1d1a3e]/58">Page {page + 1} of {totalPages}</span>
      <div className="flex gap-2">
        <button type="button" onClick={() => onChange(page - 1)} disabled={page === 0} className="btn-pop bg-[#f6f3ea] px-3 py-2 disabled:cursor-not-allowed disabled:opacity-45">Previous</button>
        <button type="button" onClick={() => onChange(page + 1)} disabled={page >= totalPages - 1} className="btn-pop bg-[#f6f3ea] px-3 py-2 disabled:cursor-not-allowed disabled:opacity-45">Next</button>
      </div>
    </nav>
  );
}

export function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#1d1a3e]/10 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#1d1a3e]/42">{label}</p>
      <p className="mt-1 break-words font-semibold text-[#1d1a3e]/78">{value}</p>
    </div>
  );
}

export function Field({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (value: string) => void; type?: "text" | "number" | "password" }) {
  return (
    <label className="block p-5">
      <span className="text-sm font-semibold text-[#1d1a3e]/70">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full border border-[#1d1a3e]/14 bg-white px-4 py-3 text-sm outline-none focus:border-[#7357c9]" />
    </label>
  );
}

export function JsonField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block p-5">
      <span className="text-sm font-semibold text-[#1d1a3e]/70">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={6} spellCheck={false} className="mt-2 w-full resize-y border border-[#1d1a3e]/14 bg-[#fbfaf6] px-4 py-3 font-mono text-xs leading-5 outline-none focus:border-[#7357c9]" />
    </label>
  );
}

export function Select({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block p-5">
      <span className="text-sm font-semibold text-[#1d1a3e]/70">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full border border-[#1d1a3e]/14 bg-white px-4 py-3 text-sm outline-none focus:border-[#7357c9]">
        {values.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 p-5">
      <span className="text-sm font-semibold text-[#1d1a3e]/70">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-[#7357c9]" />
    </label>
  );
}

export function Actions({ disabled, onSave, onNew }: { disabled: boolean; onSave: () => void; onNew: () => void }) {
  return (
    <div className="flex flex-wrap justify-end gap-3 p-5">
      <button type="button" onClick={onNew} className="btn-pop bg-[#f6f3ea] px-5 py-3 text-sm">New</button>
      <button type="button" onClick={onSave} disabled={disabled} className="btn-pop bg-[#ffbf45] px-5 py-3 text-sm text-[#1d1a3e] disabled:cursor-not-allowed disabled:opacity-50">Save</button>
    </div>
  );
}

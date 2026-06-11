"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";

type AdminConfig = {
  feature_flags?: Array<{ key: string; enabled: boolean; description: string; updated_at: string }>;
  worlds?: Array<{ key: string; name: string; year_group: number; theme: string; enabled: boolean }>;
  activities?: Array<{ id: string; objective_id: string; title: string; world_key: string; status: string }>;
  questions?: Array<{ id: string; activity_id: string; objective_id: string; format: string; status: string }>;
};

const API = process.env.NEXT_PUBLIC_API_URL;

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("");
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [message, setMessage] = useState("Enter the Render ADMIN_API_KEY to inspect platform configuration.");
  const [loading, setLoading] = useState(false);

  const totals = useMemo(
    () => [
      { label: "Feature flags", value: config?.feature_flags?.length ?? 0 },
      { label: "Worlds", value: config?.worlds?.length ?? 0 },
      { label: "Activities", value: config?.activities?.length ?? 0 },
      { label: "Questions", value: config?.questions?.length ?? 0 },
    ],
    [config],
  );

  async function loadConfig() {
    if (!API) {
      setMessage("NEXT_PUBLIC_API_URL is not configured.");
      return;
    }
    setLoading(true);
    setMessage("Loading configuration...");
    try {
      const res = await fetch(`${API}/v1/admin/config`, {
        headers: { "X-Admin-Key": adminKey },
      });
      const body = await res.json();
      if (!res.ok) {
        setConfig(null);
        setMessage(body.error ?? "Admin request failed.");
        return;
      }
      setConfig(body as AdminConfig);
      setMessage("Configuration loaded from the live API.");
    } catch {
      setConfig(null);
      setMessage("Could not reach the API.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f3ea] px-5 py-8 text-[#1d1a3e]">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.18em] text-[#7357c9]">Platform admin</p>
            <h1 className="font-display mt-2 text-4xl font-semibold">Configuration control room</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#1d1a3e]/62">
              Inspect the configurable layer for curriculum, feature flags, worlds, activities and question content.
            </p>
          </div>
          <Link href="/" className="btn-pop bg-white px-5 py-3 text-sm shadow-card">
            Home
          </Link>
        </div>

        <section className="mt-8 grid gap-4 rounded-2xl bg-white p-5 shadow-card md:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="text-sm font-semibold">Admin API key</span>
            <input
              value={adminKey}
              onChange={(event) => setAdminKey(event.target.value)}
              type="password"
              className="mt-2 w-full rounded-xl border border-[#1d1a3e]/15 px-4 py-3 outline-none focus:border-[#7357c9]"
              placeholder="X-Admin-Key"
            />
          </label>
          <button
            onClick={loadConfig}
            disabled={loading || !adminKey}
            className="btn-pop self-end bg-[#ffbf45] px-6 py-3 text-[#1d1a3e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Loading" : "Load config"}
          </button>
        </section>

        <p className="mt-4 rounded-xl bg-white/70 px-4 py-3 text-sm text-[#1d1a3e]/66">{message}</p>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          {totals.map((item) => (
            <article key={item.label} className="rounded-2xl bg-white p-5 shadow-card">
              <p className="font-display text-3xl font-semibold">{item.value}</p>
              <p className="mt-1 text-sm text-[#1d1a3e]/58">{item.label}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel title="Feature Flags">
            {(config?.feature_flags ?? []).map((flag) => (
              <Row key={flag.key} title={flag.key} meta={flag.enabled ? "Enabled" : "Disabled"} body={flag.description} />
            ))}
          </Panel>

          <Panel title="Worlds">
            {(config?.worlds ?? []).map((world) => (
              <Row key={world.key} title={world.name} meta={`Year ${world.year_group || "all"} - ${world.enabled ? "enabled" : "disabled"}`} body={world.theme} />
            ))}
          </Panel>

          <Panel title="Activities">
            {(config?.activities ?? []).map((activity) => (
              <Row key={activity.id} title={activity.title || activity.id} meta={activity.status} body={`${activity.world_key} / ${activity.objective_id}`} />
            ))}
          </Panel>

          <Panel title="Questions">
            {(config?.questions ?? []).map((question) => (
              <Row key={question.id} title={question.id} meta={question.status} body={`${question.format} / ${question.objective_id}`} />
            ))}
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-card">
      <div className="border-b border-[#1d1a3e]/8 p-5">
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
      </div>
      <div className="divide-y divide-[#1d1a3e]/8">{children}</div>
    </section>
  );
}

function Row({ title, meta, body }: { title: string; meta: string; body: string }) {
  return (
    <article className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">{title}</p>
        <span className="rounded-full bg-[#55cbd3]/20 px-3 py-1 text-xs font-semibold text-[#155d64]">{meta}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#1d1a3e]/58">{body}</p>
    </article>
  );
}

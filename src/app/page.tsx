"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ProjectSummaryDTO } from "@/lib/types";

export default function HomePage() {
  const [projects, setProjects] = useState<ProjectSummaryDTO[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [sourceLocale, setSourceLocale] = useState("id-ID");
  const [targetLocales, setTargetLocales] = useState("en-MY, en-PH");
  const [localeGroup, setLocaleGroup] = useState("en-variants");
  const [creating, setCreating] = useState(false);

  function load() {
    setLoadError(null);
    fetch("/api/projects")
      .then((r) => {
        if (!r.ok) throw new Error(`Server responded ${r.status}`);
        return r.json();
      })
      .then(setProjects)
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Failed to load projects"));
  }

  useEffect(load, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sourceLocale,
          targetLocales: targetLocales.split(",").map((s) => s.trim()).filter(Boolean),
          localeGroup,
        }),
      });
      if (res.ok) {
        const { id } = await res.json();
        window.location.href = `/projects/${id}`;
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Localize</h1>
          <p className="mt-1 text-sm text-slate-500">
            Flip UX Writing localization workspace — manage source strings, translations, and exports across locales.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          {showForm ? "Cancel" : "New project"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createProject} className="mt-6 rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Project name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ID → MY/PH — Payment Flow"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Source locale</label>
              <input
                required
                value={sourceLocale}
                onChange={(e) => setSourceLocale(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Target locales (comma-separated)</label>
              <input
                required
                value={targetLocales}
                onChange={(e) => setTargetLocales(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Locale group (optional)</label>
            <input
              value={localeGroup}
              onChange={(e) => setLocaleGroup(e.target.value)}
              placeholder="en-variants"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create project"}
          </button>
        </form>
      )}

      <div className="mt-8 space-y-3">
        {loadError && (
          <div className="flex items-center justify-between rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <span>Couldn&apos;t load projects: {loadError}</span>
            <button onClick={load} className="font-medium text-rose-700 underline hover:text-rose-800">
              Retry
            </button>
          </div>
        )}
        {projects === null && !loadError && <p className="text-sm text-slate-500">Loading…</p>}
        {projects?.length === 0 && (
          <p className="text-sm text-slate-500">No projects yet. Create one to get started.</p>
        )}
        {projects?.map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-brand-500 hover:shadow-sm transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-medium">{p.name}</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {p.sourceLocale} → {p.targetLocales.join(", ")}
                  {p.localeGroup ? ` · ${p.localeGroup}` : ""}
                </p>
              </div>
              <span className="text-xs text-slate-400">{p.keyCount} keys</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}

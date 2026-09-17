"use client";

import { useState } from "react";
import type { GlossaryTermDTO } from "@/lib/types";

interface Props {
  projectId: string;
  targetLocales: string[];
  terms: GlossaryTermDTO[];
  onClose: () => void;
  onChange: () => void;
}

export default function GlossaryPanel({ projectId, targetLocales, terms, onClose, onChange }: Props) {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [locale, setLocale] = useState(targetLocales[0] ?? "");
  const [approved, setApproved] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = terms.filter((t) =>
    (t.term + t.approvedTranslation).toLowerCase().includes(search.toLowerCase())
  );

  async function addTerm() {
    if (!term.trim() || !approved.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/projects/${projectId}/glossary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term, locale, approvedTranslation: approved, notes }),
      });
      setTerm("");
      setApproved("");
      setNotes("");
      onChange();
    } finally {
      setSaving(false);
    }
  }

  async function removeTerm(id: string) {
    await fetch(`/api/glossary/${id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Glossary</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Approved term translations sourced from Flip&apos;s glossary — reference while translating, not
            auto-enforced yet.
          </p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search terms…"
        className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />

      <div className="mt-4 space-y-2">
        {filtered.length === 0 && <p className="text-sm text-slate-400">No matching terms.</p>}
        {filtered.map((t) => (
          <div key={t.id} className="rounded-md border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{t.term}</p>
                <p className="text-xs text-slate-500">
                  <span className="font-medium text-slate-600">{t.locale}</span>: {t.approvedTranslation}
                </p>
                {t.notes && <p className="mt-1 text-xs text-slate-400">{t.notes}</p>}
              </div>
              <button
                onClick={() => removeTerm(t.id)}
                className="shrink-0 text-xs text-slate-400 hover:text-rose-500"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-md border border-dashed border-slate-300 p-3">
        <span className="text-sm font-medium text-slate-600">Add term</span>
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Source term"
          className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <div className="mt-2 flex gap-2">
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          >
            {targetLocales.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <input
            value={approved}
            onChange={(e) => setApproved(e.target.value)}
            placeholder="Approved translation"
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <button
          onClick={addTerm}
          disabled={saving || !term.trim() || !approved.trim()}
          className="mt-3 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          Add term
        </button>
      </div>
    </div>
  );
}

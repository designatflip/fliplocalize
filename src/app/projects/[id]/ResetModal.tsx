"use client";

import { useState } from "react";
import type { StringKeyDTO } from "@/lib/types";

interface Props {
  projectId: string;
  keys: StringKeyDTO[];
  targetLocales: string[];
  requestedBy: string;
  onClose: () => void;
  onDone: () => void;
}

const ALL = "__all__";

export default function ResetModal({ projectId, keys, targetLocales, requestedBy, onClose, onDone }: Props) {
  const [locale, setLocale] = useState(ALL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filledCount = keys.reduce(
    (n, k) =>
      n +
      k.translations.filter(
        (t) => (locale === ALL || t.locale === locale) && !(t.text === "" && t.status === "untranslated")
      ).length,
    0
  );

  async function handleReset() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: locale === ALL ? undefined : locale, by: requestedBy }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Reset failed");
      }
      onDone();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Reset translations</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">✕</button>
        </div>

        <div className="mt-4 space-y-4">
          <p className="text-sm text-neutral-600">
            Clears every filled translation back to empty and sets its status to Untranslated —
            including Approved and Exported ones. Source text, reference text, context, and comments
            are kept. This can&apos;t be undone from the app.
          </p>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Locale</label>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              disabled={loading}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              <option value={ALL}>All locales</option>
              {targetLocales.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <p className="text-sm font-medium text-neutral-700">
            {filledCount} translation{filledCount === 1 ? "" : "s"} will be reset.
          </p>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="w-full rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReset}
              disabled={loading || filledCount === 0}
              className="w-full rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {loading ? "Resetting…" : "Reset"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

interface Props {
  projectId: string;
  targetLocales: string[];
  onClose: () => void;
  onDone: () => void;
}

interface BatchResult {
  batch: { attempted: number; suggested: number; failed: number };
  remaining: number;
  errors: string[];
}

interface Totals {
  suggested: number;
  failed: number;
  attempted: number;
}

const MAX_ITERATIONS = 200; // safety valve against a pathological infinite loop

export default function AutoTranslateModal({ projectId, targetLocales, onClose, onDone }: Props) {
  const [locale, setLocale] = useState(targetLocales[0] ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<(Totals & { remaining: number }) | null>(null);
  const [result, setResult] = useState<{ summary: Totals; errors: string[] } | null>(null);

  async function handleRun() {
    setError(null);
    setProgress(null);
    setLoading(true);

    const totals: Totals = { suggested: 0, failed: 0, attempted: 0 };
    let allErrors: string[] = [];
    let remaining = Infinity;
    let iterations = 0;

    try {
      while (remaining > 0 && iterations < MAX_ITERATIONS) {
        iterations++;
        const res = await fetch(`/api/projects/${projectId}/suggest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Auto-translate failed");
        }
        const data: BatchResult = await res.json();
        totals.suggested += data.batch.suggested;
        totals.failed += data.batch.failed;
        totals.attempted += data.batch.attempted;
        allErrors = [...allErrors, ...data.errors].slice(0, 50);
        remaining = data.remaining;
        setProgress({ ...totals, remaining });
        onDone(); // refresh the underlying table after every batch, not just at the end

        if (data.batch.attempted === 0 && remaining > 0) break; // nothing processed — stop rather than spin
      }
      setResult({ summary: totals, errors: allErrors });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auto-translate failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">✨ Auto-translate untranslated strings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {result ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-600">Auto-translate complete for {locale}.</p>
            <ul className="rounded-md bg-slate-50 p-3 text-sm space-y-1">
              <li>✨ Suggested: <strong>{result.summary.suggested}</strong></li>
              <li>⚠️ Failed: <strong>{result.summary.failed}</strong></li>
              <li className="text-slate-400">Attempted {result.summary.attempted} strings</li>
            </ul>
            {result.errors.length > 0 && (
              <ul className="max-h-32 overflow-y-auto rounded-md bg-rose-50 p-2 text-xs text-rose-600 space-y-0.5">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
            <button
              onClick={onClose}
              className="w-full rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-slate-500">
              Generates AI first-draft translations (marked as drafts, requiring review) for every string
              in the selected locale that&apos;s still untranslated, using Flip&apos;s glossary and writing
              guidelines as context. Strings that already have any text or a status past
              &ldquo;untranslated&rdquo; are never touched. Runs in small batches, so large projects are
              processed progressively rather than in one long request.
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700">Locale</label>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                disabled={loading}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
              >
                {targetLocales.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            {progress && (
              <p className="text-xs text-slate-500">
                Translated {progress.suggested} so far, {progress.remaining} remaining…
              </p>
            )}
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button
              onClick={handleRun}
              disabled={loading || !locale}
              className="w-full rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {loading ? "Generating…" : "Run auto-translate"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

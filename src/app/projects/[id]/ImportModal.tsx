"use client";

import { useState } from "react";

interface Props {
  projectId: string;
  targetLocales: string[];
  onClose: () => void;
  onImported: () => void;
  importedBy: string;
}

async function readJsonFile(file: File): Promise<Record<string, unknown>> {
  const text = await file.text();
  return JSON.parse(text);
}

export default function ImportModal({ projectId, targetLocales, onClose, onImported, importedBy }: Props) {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [translationFiles, setTranslationFiles] = useState<Record<string, File | null>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);

  async function handleImport() {
    if (!sourceFile) {
      setError("Source JSON is required.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const sourceJson = await readJsonFile(sourceFile);
      const referenceJson = referenceFile ? await readJsonFile(referenceFile) : undefined;
      const translations: Record<string, Record<string, unknown>> = {};
      for (const locale of targetLocales) {
        const f = translationFiles[locale];
        if (f) translations[locale] = await readJsonFile(f);
      }

      const res = await fetch(`/api/projects/${projectId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceJson, referenceJson, translations, importedBy }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Import failed");
      }

      const { summary } = await res.json();
      setSummary(summary);
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed — check that files are valid JSON.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Import JSON</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">✕</button>
        </div>

        {summary ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-neutral-600">Import complete.</p>
            <ul className="rounded-xl bg-neutral-50 p-3 text-sm space-y-1">
              <li>🆕 New keys: <strong>{summary.newKeys}</strong></li>
              <li>✏️ Changed keys: <strong>{summary.changedKeys}</strong></li>
              <li>♻️ Revived keys: <strong>{summary.revivedKeys}</strong></li>
              <li>➖ Unchanged keys: <strong>{summary.unchangedKeys}</strong></li>
              <li>🗑️ Removed keys: <strong>{summary.removedKeys}</strong></li>
              <li>🌐 Translations seeded: <strong>{summary.translationsSeeded}</strong></li>
              {summary.translationsSkipped > 0 && (
                <li className="text-neutral-400">Skipped (already in progress): {summary.translationsSkipped}</li>
              )}
            </ul>
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-neutral-500">
              Upload the source JSON (required). Existing keys will be diffed against this project&apos;s
              current strings — new, changed, and removed keys will be flagged automatically.
            </p>

            <div>
              <label className="block text-sm font-medium text-neutral-700">
                Source JSON <span className="text-rose-500">*</span>
              </label>
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => setSourceFile(e.target.files?.[0] ?? null)}
                className="mt-1 w-full text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700">
                Reference JSON (existing English copy, optional)
              </label>
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => setReferenceFile(e.target.files?.[0] ?? null)}
                className="mt-1 w-full text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-neutral-700">
                Existing translation JSON per locale (optional)
              </label>
              {targetLocales.map((locale) => (
                <div key={locale} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-neutral-500">{locale}</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) =>
                      setTranslationFiles((prev) => ({ ...prev, [locale]: e.target.files?.[0] ?? null }))
                    }
                    className="w-full text-sm"
                  />
                </div>
              ))}
            </div>

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <button
              onClick={handleImport}
              disabled={loading}
              className="w-full rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {loading ? "Importing…" : "Import"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

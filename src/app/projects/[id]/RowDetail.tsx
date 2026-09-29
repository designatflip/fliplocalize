"use client";

import { useState } from "react";
import type { StringKeyDTO, TranslationStatus } from "@/lib/types";
import { STATUS_ORDER, STATUS_LABEL } from "@/lib/types";
import { StatusBadge, AiBadge } from "./StatusBadge";
import AutoGrowTextarea from "./AutoGrowTextarea";

interface Props {
  keyEntry: StringKeyDTO;
  targetLocales: string[];
  currentUser: string;
  onClose: () => void;
  onKeyPatch: (patch: Partial<{
    referenceText: string | null;
    screen: string | null;
    component: string | null;
    notes: string | null;
    charLimit: number | null;
    placeholders: string[];
  }>) => void;
  onTranslationPatch: (translationId: string, patch: { text?: string; status?: string; reviewer?: string | null }) => void;
  onAddComment: (translationId: string, text: string) => void;
  onSuggest: (translationId: string) => void;
  onUseReference: (translationId: string, text: string) => void;
  suggestingIds: Set<string>;
  usingReferenceIds: Set<string>;
}

export default function RowDetail({
  keyEntry,
  targetLocales,
  currentUser,
  onClose,
  onKeyPatch,
  onTranslationPatch,
  onAddComment,
  onSuggest,
  onUseReference,
  suggestingIds,
  usingReferenceIds,
}: Props) {
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [showHistoryFor, setShowHistoryFor] = useState<string | null>(null);

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white shadow-xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <h2 className="font-mono text-sm font-semibold text-slate-700">{keyEntry.key}</h2>
          <p className="text-xs text-slate-400">
            Last changed {new Date(keyEntry.lastChangedAt).toLocaleString()}
          </p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
      </div>

      <div className="px-6 py-5 space-y-6">
        <section>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Source ({"source"})
          </label>
          <p className="mt-1 rounded-md bg-slate-50 p-3 text-sm">{keyEntry.sourceText}</p>
        </section>

        <section>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Reference (existing English)
          </label>
          <AutoGrowTextarea
            defaultValue={keyEntry.referenceText ?? ""}
            onBlur={(e) => onKeyPatch({ referenceText: e.target.value || null })}
            rows={2}
            className="mt-1 w-full rounded-md border border-slate-300 p-3 text-sm"
          />
        </section>

        <section className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Screen</label>
            <input
              defaultValue={keyEntry.screen ?? ""}
              onBlur={(e) => onKeyPatch({ screen: e.target.value || null })}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Component</label>
            <input
              defaultValue={keyEntry.component ?? ""}
              onBlur={(e) => onKeyPatch({ component: e.target.value || null })}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Char limit</label>
            <input
              type="number"
              defaultValue={keyEntry.charLimit ?? ""}
              onBlur={(e) => onKeyPatch({ charLimit: e.target.value ? Number(e.target.value) : null })}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
        </section>

        <section>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Notes (context, since design files aren&apos;t always available)
          </label>
          <AutoGrowTextarea
            defaultValue={keyEntry.notes ?? ""}
            onBlur={(e) => onKeyPatch({ notes: e.target.value || null })}
            rows={2}
            placeholder="e.g. Appears after user reviews amount + recipient"
            className="mt-1 w-full rounded-md border border-slate-300 p-3 text-sm"
          />
        </section>

        {keyEntry.placeholders.length > 0 && (
          <section>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Placeholders</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {keyEntry.placeholders.map((p) => (
                <span key={p} className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                  {p}
                </span>
              ))}
            </div>
          </section>
        )}

        <hr className="border-slate-200" />

        {targetLocales.map((locale) => {
          const t = keyEntry.translations.find((tr) => tr.locale === locale);
          if (!t) return null;
          const overLimit = keyEntry.charLimit != null && t.text.length > keyEntry.charLimit;
          const suggesting = suggestingIds.has(t.id);
          const usingReference = usingReferenceIds.has(t.id);
          const finished = t.status === "approved" || t.status === "exported";
          const suggestDisabled = suggesting || usingReference || finished;
          const useReferenceDisabled = usingReference || suggesting || finished;

          return (
            <section key={locale} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{locale}</span>
                <div className="flex items-center gap-1.5">
                  {t.aiGenerated && <AiBadge model={t.aiModel} />}
                  <StatusBadge status={t.status} />
                </div>
              </div>

              <AutoGrowTextarea
                key={`${t.id}-${t.updatedAt}`}
                defaultValue={t.text}
                onBlur={(e) => onTranslationPatch(t.id, { text: e.target.value })}
                rows={2}
                className={`mt-2 w-full rounded-md border p-3 text-sm ${
                  overLimit ? "border-rose-400 bg-rose-50" : "border-slate-300"
                }`}
              />
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className={overLimit ? "font-medium text-rose-600" : "text-slate-400"}>
                  {t.text.length}
                  {keyEntry.charLimit != null ? ` / ${keyEntry.charLimit}` : ""} chars
                  {overLimit ? " — over limit" : ""}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onSuggest(t.id)}
                    disabled={suggestDisabled}
                    title="Suggest an AI first-draft translation"
                    className="text-brand-600 hover:underline disabled:text-slate-300"
                  >
                    {suggesting ? "Suggesting…" : "✨ Suggest"}
                  </button>
                  {keyEntry.referenceText && (
                    <button
                      onClick={() => onUseReference(t.id, keyEntry.referenceText as string)}
                      disabled={useReferenceDisabled}
                      title="Use the existing English reference text for this field"
                      className="text-brand-600 hover:underline disabled:text-slate-300"
                    >
                      {usingReference ? "Using…" : "📋 Use existing"}
                    </button>
                  )}
                  <button
                    onClick={() => setShowHistoryFor(showHistoryFor === t.id ? null : t.id)}
                    className="text-brand-600 hover:underline"
                  >
                    {t.history.length} revision{t.history.length === 1 ? "" : "s"}
                  </button>
                </div>
              </div>

              {showHistoryFor === t.id && (
                <ul className="mt-2 space-y-1 rounded-md bg-slate-50 p-2 text-xs">
                  {t.history.length === 0 && <li className="text-slate-400">No history yet.</li>}
                  {t.history.map((h) => (
                    <li key={h.id} className="text-slate-500">
                      <span className="font-medium text-slate-600">{h.by ?? "unknown"}</span>{" "}
                      · {new Date(h.at).toLocaleString()} — &ldquo;{h.text}&rdquo;
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex items-center gap-2">
                <label className="text-xs text-slate-500">Status</label>
                <select
                  value={t.status}
                  onChange={(e) =>
                    onTranslationPatch(t.id, {
                      status: e.target.value,
                      ...(e.target.value === "approved" ? { reviewer: currentUser } : {}),
                    })
                  }
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                >
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
                {t.reviewer && <span className="text-xs text-slate-400">reviewed by {t.reviewer}</span>}
              </div>

              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Comments</p>
                <ul className="mt-1 space-y-1.5">
                  {t.comments.map((c) => (
                    <li key={c.id} className="rounded-md bg-slate-50 p-2 text-xs">
                      <span className="font-medium text-slate-600">{c.author ?? "anon"}</span>{" "}
                      <span className="text-slate-400">{new Date(c.createdAt).toLocaleString()}</span>
                      <p className="mt-0.5 text-slate-700">{c.text}</p>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex gap-2">
                  <input
                    value={commentDrafts[t.id] ?? ""}
                    onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                    placeholder="Leave a review comment…"
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                  />
                  <button
                    onClick={() => {
                      const text = commentDrafts[t.id]?.trim();
                      if (!text) return;
                      onAddComment(t.id, text);
                      setCommentDrafts((prev) => ({ ...prev, [t.id]: "" }));
                    }}
                    className="shrink-0 rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
                  >
                    Comment
                  </button>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

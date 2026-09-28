"use client";

import type { StringKeyDTO } from "@/lib/types";
import { StatusBadge, ChangePill, AiBadge } from "./StatusBadge";
import AutoGrowTextarea from "./AutoGrowTextarea";

interface Props {
  keys: StringKeyDTO[];
  rowNumbers: Map<string, number>;
  targetLocales: string[];
  onOpenRow: (keyId: string) => void;
  onTranslationPatch: (translationId: string, patch: { text?: string }) => void;
  onSuggest: (translationId: string) => void;
  suggestingIds: Set<string>;
}

export default function StringTable({
  keys,
  rowNumbers,
  targetLocales,
  onOpenRow,
  onTranslationPatch,
  onSuggest,
  suggestingIds,
}: Props) {
  if (keys.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
        No strings match the current filter.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="w-12 px-3 py-2 text-right">#</th>
            <th className="w-64 px-3 py-2">Key</th>
            <th className="w-56 px-3 py-2">Source</th>
            {targetLocales.map((locale) => (
              <th key={locale} className="px-3 py-2">{locale}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr
              key={k.id}
              className={`border-b border-slate-100 align-top hover:bg-slate-50 ${
                k.changeStatus === "removed" ? "opacity-50" : ""
              }`}
            >
              <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-slate-400">
                {rowNumbers.get(k.id)}
              </td>
              <td className="px-3 py-2">
                <button
                  onClick={() => onOpenRow(k.id)}
                  className="text-left font-mono text-xs text-slate-700 hover:text-brand-600 hover:underline"
                >
                  {k.key}
                </button>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <ChangePill status={k.changeStatus} />
                  {k.charLimit != null && (
                    <span className="text-[10px] text-slate-400">limit {k.charLimit}</span>
                  )}
                  {(k.screen || k.component) && (
                    <span className="text-[10px] text-slate-400">
                      {[k.screen, k.component].filter(Boolean).join(" / ")}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2 text-slate-600">
                <p>{k.sourceText}</p>
                {k.referenceText && (
                  <p className="mt-1 text-xs italic text-slate-400">{k.referenceText}</p>
                )}
              </td>
              {targetLocales.map((locale) => {
                const t = k.translations.find((tr) => tr.locale === locale);
                if (!t) return <td key={locale} className="px-3 py-2 text-xs text-slate-300">—</td>;
                const overLimit = k.charLimit != null && t.text.length > k.charLimit;
                const suggesting = suggestingIds.has(t.id);
                const suggestDisabled = suggesting || t.status === "approved" || t.status === "exported";
                return (
                  <td key={locale} className="px-3 py-2">
                    <AutoGrowTextarea
                      key={`${t.id}-${t.updatedAt}`}
                      defaultValue={t.text}
                      onBlur={(e) => {
                        if (e.target.value !== t.text) onTranslationPatch(t.id, { text: e.target.value });
                      }}
                      rows={2}
                      className={`w-full rounded-md border p-1.5 text-sm ${
                        overLimit ? "border-rose-400 bg-rose-50" : "border-slate-200"
                      }`}
                    />
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        <StatusBadge status={t.status} />
                        {t.aiGenerated && <AiBadge model={t.aiModel} />}
                      </div>
                      {overLimit && (
                        <span className="text-[10px] font-medium text-rose-600">
                          {t.text.length}/{k.charLimit}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => onSuggest(t.id)}
                      disabled={suggestDisabled}
                      title="Suggest an AI first-draft translation"
                      className="mt-1 text-[10px] text-brand-600 hover:underline disabled:text-slate-300"
                    >
                      {suggesting ? "Suggesting…" : "✨ Suggest"}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

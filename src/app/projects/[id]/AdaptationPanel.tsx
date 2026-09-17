"use client";

import { useState } from "react";
import type { AdaptationRuleDTO } from "@/lib/types";

interface Props {
  projectId: string;
  targetLocales: string[];
  rules: AdaptationRuleDTO[];
  onClose: () => void;
  onChange: () => void;
}

export default function AdaptationPanel({ projectId, targetLocales, rules, onClose, onChange }: Props) {
  const [newDimension, setNewDimension] = useState("");
  const [newValues, setNewValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function addRule() {
    if (!newDimension.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/projects/${projectId}/adaptation-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dimension: newDimension.trim(), values: newValues }),
      });
      setNewDimension("");
      setNewValues({});
      onChange();
    } finally {
      setSaving(false);
    }
  }

  async function updateValue(ruleId: string, dimension: string, values: Record<string, string>, locale: string, value: string) {
    const nextValues = { ...values, [locale]: value };
    await fetch(`/api/adaptation-rules/${ruleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dimension, values: nextValues }),
    });
    onChange();
  }

  async function removeRule(id: string) {
    await fetch(`/api/adaptation-rules/${id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Locale adaptation rules</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Documented differences between locales sharing a base translation — visible while translating.
          </p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
      </div>

      <div className="mt-5 space-y-4">
        {rules.length === 0 && (
          <p className="text-sm text-slate-400">No adaptation rules yet. Add one below.</p>
        )}
        {rules.map((rule) => (
          <div key={rule.id} className="rounded-md border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{rule.dimension}</span>
              <button
                onClick={() => removeRule(rule.id)}
                className="text-xs text-slate-400 hover:text-rose-500"
              >
                Remove
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {targetLocales.map((locale) => (
                <div key={locale} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-xs text-slate-500">{locale}</span>
                  <input
                    defaultValue={rule.values[locale] ?? ""}
                    onBlur={(e) => updateValue(rule.id, rule.dimension, rule.values, locale, e.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="rounded-md border border-dashed border-slate-300 p-3">
          <span className="text-sm font-medium text-slate-600">Add dimension</span>
          <input
            value={newDimension}
            onChange={(e) => setNewDimension(e.target.value)}
            placeholder="e.g. Currency, Payment rails, Spelling convention"
            className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <div className="mt-2 space-y-2">
            {targetLocales.map((locale) => (
              <div key={locale} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs text-slate-500">{locale}</span>
                <input
                  value={newValues[locale] ?? ""}
                  onChange={(e) => setNewValues((prev) => ({ ...prev, [locale]: e.target.value }))}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </div>
            ))}
          </div>
          <button
            onClick={addRule}
            disabled={saving || !newDimension.trim()}
            className="mt-3 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            Add rule
          </button>
        </div>
      </div>
    </div>
  );
}

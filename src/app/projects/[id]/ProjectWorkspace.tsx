"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ProjectDTO } from "@/lib/types";
import StringTable from "./StringTable";
import RowDetail from "./RowDetail";
import ImportModal from "./ImportModal";
import AdaptationPanel from "./AdaptationPanel";
import GlossaryPanel from "./GlossaryPanel";
import AutoTranslateModal from "./AutoTranslateModal";
import ResetModal from "./ResetModal";

const CURRENT_USER = "payment_design@flip.id";
const CHANGE_FILTERS = ["all", "new", "changed", "removed"] as const;

export default function ProjectWorkspace({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectDTO | null>(null);
  const [search, setSearch] = useState("");
  const [changeFilter, setChangeFilter] = useState<(typeof CHANGE_FILTERS)[number]>("all");
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showAdaptation, setShowAdaptation] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [showAutoTranslate, setShowAutoTranslate] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [suggestingIds, setSuggestingIds] = useState<Set<string>>(new Set());
  const [usingReferenceIds, setUsingReferenceIds] = useState<Set<string>>(new Set());
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadError(null);
    fetch(`/api/projects/${projectId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Server responded ${r.status}`);
        return r.json();
      })
      .then(setProject)
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Failed to load project"));
  }, [projectId]);

  useEffect(load, [load]);

  const filteredKeys = useMemo(() => {
    if (!project) return [];
    return project.keys.filter((k) => {
      if (changeFilter === "removed") {
        if (k.changeStatus !== "removed") return false;
      } else {
        if (k.changeStatus === "removed") return false;
        if (changeFilter !== "all" && k.changeStatus !== changeFilter) return false;
      }
      if (search) {
        const haystack = `${k.key} ${k.sourceText} ${k.referenceText ?? ""}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [project, search, changeFilter]);

  // Stable numbers: a string keeps its number regardless of search or filter (removed strings
  // are numbered separately so the active list has no gaps).
  const rowNumbers = useMemo(() => {
    const numbers = new Map<string, number>();
    if (!project) return numbers;
    let active = 0;
    let removed = 0;
    for (const k of project.keys) {
      numbers.set(k.id, k.changeStatus === "removed" ? ++removed : ++active);
    }
    return numbers;
  }, [project]);

  const selectedKey = project?.keys.find((k) => k.id === selectedKeyId) ?? null;

  async function patchKey(keyId: string, patch: Record<string, unknown>) {
    await fetch(`/api/keys/${keyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  }

  async function patchTranslation(
    translationId: string,
    patch: { text?: string; status?: string; reviewer?: string | null }
  ) {
    await fetch(`/api/translations/${translationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, by: CURRENT_USER }),
    });
    load();
  }

  function flashSuccess(message: string) {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage((current) => (current === message ? null : current)), 3000);
  }

  async function useReferenceText(translationId: string, text: string) {
    setUsingReferenceIds((prev) => new Set(prev).add(translationId));
    try {
      await patchTranslation(translationId, { text, status: "draft" });
      flashSuccess("Existing English copy added to the field.");
    } finally {
      setUsingReferenceIds((prev) => {
        const next = new Set(prev);
        next.delete(translationId);
        return next;
      });
    }
  }

  async function suggestOne(translationId: string) {
    setSuggestingIds((prev) => new Set(prev).add(translationId));
    setSuggestError(null);
    try {
      const res = await fetch(`/api/translations/${translationId}/suggest`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Suggest failed");
      }
      load();
    } catch (e) {
      setSuggestError(e instanceof Error ? e.message : "Suggest failed");
    } finally {
      setSuggestingIds((prev) => {
        const next = new Set(prev);
        next.delete(translationId);
        return next;
      });
    }
  }

  async function addComment(translationId: string, text: string) {
    await fetch(`/api/translations/${translationId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, author: CURRENT_USER }),
    });
    load();
  }

  async function renameProject(name: string) {
    if (!project || !name.trim() || name.trim() === project.name) {
      setEditingName(false);
      return;
    }
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setEditingName(false);
    load();
  }

  function exportLocale(locale: string, mode: "approved" | "all") {
    window.open(`/api/projects/${projectId}/export?locale=${encodeURIComponent(locale)}&mode=${mode}`, "_blank");
    setTimeout(load, 800);
  }

  if (!project) {
    if (loadError) {
      return (
        <div className="p-10 text-sm">
          <p className="text-rose-600">Couldn&apos;t load this project: {loadError}</p>
          <button onClick={load} className="mt-2 font-medium text-brand-600 underline hover:text-brand-700">
            Retry
          </button>
        </div>
      );
    }
    return <div className="p-10 text-sm text-slate-400">Loading project…</div>;
  }

  const activeKeys = project.keys.filter((k) => k.changeStatus !== "removed");
  const progress = project.targetLocales.map((locale) => {
    const translations = activeKeys
      .map((k) => k.translations.find((t) => t.locale === locale))
      .filter(Boolean) as ProjectDTO["keys"][number]["translations"];
    const approved = translations.filter((t) => t.status === "approved" || t.status === "exported").length;
    return { locale, approved, total: translations.length };
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/" className="text-xs text-slate-400 hover:text-slate-600">← All projects</Link>
          {editingName ? (
            <input
              autoFocus
              defaultValue={project.name}
              onBlur={(e) => renameProject(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setEditingName(false);
              }}
              className="mt-1 w-full max-w-md rounded-md border border-slate-300 px-2 py-0.5 text-xl font-semibold"
            />
          ) : (
            <h1
              onClick={() => setEditingName(true)}
              title="Click to rename"
              className="mt-1 cursor-text text-xl font-semibold hover:bg-slate-100 rounded-md px-2 -mx-2 py-0.5"
            >
              {project.name}
            </h1>
          )}
          <p className="mt-1 text-xs text-slate-500">
            {project.sourceLocale} → {project.targetLocales.join(", ")}
            {project.localeGroup ? ` · ${project.localeGroup}` : ""} · {activeKeys.length} keys
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            {progress.map((p) => (
              <span key={p.locale} className="text-xs text-slate-500">
                <span className="font-medium text-slate-700">{p.locale}</span>: {p.approved}/{p.total} approved
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowGlossary(true)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Glossary
          </button>
          <button
            onClick={() => setShowAdaptation(true)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Adaptation rules
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Import
          </button>
          <button
            onClick={() => setShowAutoTranslate(true)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            ✨ Auto-translate
          </button>
          <button
            onClick={() => setShowReset(true)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50"
          >
            Reset
          </button>
          <div className="group relative">
            <button className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600">
              Export ▾
            </button>
            <div className="invisible absolute right-0 z-20 mt-1 w-56 rounded-md border border-slate-200 bg-white p-1 shadow-lg group-hover:visible">
              {project.targetLocales.map((locale) => (
                <div key={locale} className="flex items-center justify-between px-2 py-1.5 text-xs">
                  <span className="font-medium">{locale}</span>
                  <span className="flex gap-2">
                    <button onClick={() => exportLocale(locale, "approved")} className="text-brand-600 hover:underline">
                      approved
                    </button>
                    <button onClick={() => exportLocale(locale, "all")} className="text-slate-500 hover:underline">
                      all
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {suggestError && (
        <div className="fixed bottom-4 right-4 z-[60] flex max-w-sm items-start justify-between gap-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 shadow-lg">
          <span>{suggestError}</span>
          <button onClick={() => setSuggestError(null)} className="text-rose-400 hover:text-rose-600">✕</button>
        </div>
      )}

      {successMessage && (
        <div className="fixed bottom-16 right-4 z-[60] flex max-w-sm items-start justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 shadow-lg">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-600">✕</button>
        </div>
      )}

      <div className="sticky top-0 z-30 mt-6 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 py-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search key, source, or reference text…"
          className="w-72 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">Since last import:</span>
          {CHANGE_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setChangeFilter(f)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize ${
                changeFilter === f ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <StringTable
          keys={filteredKeys}
          rowNumbers={rowNumbers}
          targetLocales={project.targetLocales}
          onOpenRow={setSelectedKeyId}
          onTranslationPatch={(id, patch) => patchTranslation(id, patch)}
          onSuggest={suggestOne}
          onUseReference={useReferenceText}
          suggestingIds={suggestingIds}
          usingReferenceIds={usingReferenceIds}
        />
      </div>

      {selectedKey && (
        <RowDetail
          keyEntry={selectedKey}
          targetLocales={project.targetLocales}
          currentUser={CURRENT_USER}
          onClose={() => setSelectedKeyId(null)}
          onKeyPatch={(patch) => patchKey(selectedKey.id, patch)}
          onTranslationPatch={(id, patch) => patchTranslation(id, patch)}
          onAddComment={addComment}
          onSuggest={suggestOne}
          onUseReference={useReferenceText}
          suggestingIds={suggestingIds}
          usingReferenceIds={usingReferenceIds}
        />
      )}

      {showImport && (
        <ImportModal
          projectId={projectId}
          targetLocales={project.targetLocales}
          importedBy={CURRENT_USER}
          onClose={() => setShowImport(false)}
          onImported={load}
        />
      )}

      {showAdaptation && (
        <AdaptationPanel
          projectId={projectId}
          targetLocales={project.targetLocales}
          rules={project.adaptationRules}
          onClose={() => setShowAdaptation(false)}
          onChange={load}
        />
      )}

      {showGlossary && (
        <GlossaryPanel
          projectId={projectId}
          targetLocales={project.targetLocales}
          terms={project.glossaryTerms}
          onClose={() => setShowGlossary(false)}
          onChange={load}
        />
      )}

      {showReset && (
        <ResetModal
          projectId={projectId}
          keys={project.keys}
          targetLocales={project.targetLocales}
          requestedBy={CURRENT_USER}
          onClose={() => setShowReset(false)}
          onDone={load}
        />
      )}

      {showAutoTranslate && (
        <AutoTranslateModal
          projectId={projectId}
          keys={project.keys}
          targetLocales={project.targetLocales}
          onClose={() => setShowAutoTranslate(false)}
          onDone={load}
        />
      )}
    </main>
  );
}

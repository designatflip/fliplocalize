import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

interface ImportBody {
  sourceJson: Record<string, string>;
  referenceJson?: Record<string, string>;
  translations?: Record<string, Record<string, string>>; // locale -> key -> text
  importedBy?: string;
}

function flattenJson(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flattenJson(v as Record<string, unknown>, fullKey));
    } else {
      out[fullKey] = String(v);
    }
  }
  return out;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { keys: { include: { translations: true } } },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = (await req.json()) as ImportBody;
  if (!body.sourceJson || typeof body.sourceJson !== "object") {
    return NextResponse.json(
      { error: "sourceJson is required and must be a flat or nested JSON object" },
      { status: 400 }
    );
  }

  const sourceFlat = flattenJson(body.sourceJson);
  const referenceFlat = body.referenceJson ? flattenJson(body.referenceJson) : {};
  const translationsFlat: Record<string, Record<string, string>> = {};
  for (const [locale, obj] of Object.entries(body.translations ?? {})) {
    translationsFlat[locale] = flattenJson(obj);
  }

  const importedBy = body.importedBy?.trim() || null;
  const now = new Date();
  const existingByKey = new Map(project.keys.map((k) => [k.key, k]));
  const targetLocales = project.targetLocales.split(",").map((s) => s.trim()).filter(Boolean);

  const summary = {
    newKeys: 0,
    changedKeys: 0,
    unchangedKeys: 0,
    removedKeys: 0,
    revivedKeys: 0,
    translationsSeeded: 0,
    translationsSkipped: 0,
  };

  // Every write below is batched into a handful of statements regardless of how many keys are
  // in the import (768+ in practice). This matters because each round trip to a networked/pooled
  // Postgres connection costs real time (unlike local SQLite) — looping one query per key per
  // locale made a large import take tens of minutes. Only the "changed" bucket (source text that
  // genuinely differs from last import) and the "fill a blank translation from imported text"
  // case stay as per-row loops, since their values vary per row and both are normally small —
  // most keys in a re-import are unchanged, and most projects don't import translation JSON
  // alongside the source file.
  const seenKeys = new Set<string>();
  const newKeyInputs: { id: string; key: string; sourceText: string; referenceText: string | null }[] = [];
  const unchangedIds: string[] = [];
  const changedRows: { id: string; sourceText: string; referenceText: string | null }[] = [];
  const keyIdByKey = new Map<string, string>();

  for (const [key, sourceText] of Object.entries(sourceFlat)) {
    seenKeys.add(key);
    const existing = existingByKey.get(key);
    const refText = referenceFlat[key];

    if (!existing) {
      const id = randomUUID();
      newKeyInputs.push({ id, key, sourceText, referenceText: refText ?? null });
      keyIdByKey.set(key, id);
      summary.newKeys++;
    } else {
      keyIdByKey.set(key, existing.id);
      const wasRemoved = existing.removedAt !== null;
      const textChanged = existing.sourceText !== sourceText;

      if (wasRemoved || textChanged) {
        changedRows.push({ id: existing.id, sourceText, referenceText: refText ?? existing.referenceText });
        if (wasRemoved) summary.revivedKeys++;
        else summary.changedKeys++;
      } else {
        unchangedIds.push(existing.id);
        summary.unchangedKeys++;
      }
    }
  }

  if (newKeyInputs.length > 0) {
    await prisma.stringKeyEntry.createMany({
      data: newKeyInputs.map((k) => ({
        id: k.id,
        projectId: project.id,
        key: k.key,
        sourceText: k.sourceText,
        referenceText: k.referenceText,
        changeStatus: "new",
        lastChangedAt: now,
      })),
      skipDuplicates: true,
    });
  }

  if (unchangedIds.length > 0) {
    await prisma.stringKeyEntry.updateMany({
      where: { id: { in: unchangedIds } },
      data: { changeStatus: "unchanged", removedAt: null },
    });
  }

  for (const row of changedRows) {
    await prisma.stringKeyEntry.update({
      where: { id: row.id },
      data: {
        sourceText: row.sourceText,
        referenceText: row.referenceText,
        changeStatus: "changed",
        lastChangedAt: now,
        removedAt: null,
      },
    });
  }

  const removedIds = project.keys
    .filter((k) => !seenKeys.has(k.key) && k.removedAt === null)
    .map((k) => k.id);
  if (removedIds.length > 0) {
    await prisma.stringKeyEntry.updateMany({
      where: { id: { in: removedIds } },
      data: { changeStatus: "removed", removedAt: now },
    });
    summary.removedKeys = removedIds.length;
  }

  // Ensure every (key, locale) pair has a translation row, bulk-creating missing ones and
  // filling blanks from imported translation JSON where applicable.
  const translationCreates: { id: string; stringKeyId: string; locale: string; text: string; status: string }[] = [];
  const historyCreates: { id: string; translationId: string; text: string; by: string | null }[] = [];
  const blankFillUpdates: { id: string; text: string }[] = [];

  for (const [key, stringKeyId] of keyIdByKey) {
    const existing = existingByKey.get(key);
    const existingTranslationsByLocale = new Map((existing?.translations ?? []).map((t) => [t.locale, t]));

    for (const locale of targetLocales) {
      const importedText = translationsFlat[locale]?.[key];
      const existingTranslation = existingTranslationsByLocale.get(locale);

      if (!existingTranslation) {
        const id = randomUUID();
        translationCreates.push({
          id,
          stringKeyId,
          locale,
          text: importedText ?? "",
          status: importedText ? "draft" : "untranslated",
        });
        if (importedText) {
          historyCreates.push({ id: randomUUID(), translationId: id, text: importedText, by: importedBy ?? "import" });
          summary.translationsSeeded++;
        }
      } else if (importedText && existingTranslation.status === "untranslated" && !existingTranslation.text) {
        blankFillUpdates.push({ id: existingTranslation.id, text: importedText });
        historyCreates.push({
          id: randomUUID(),
          translationId: existingTranslation.id,
          text: importedText,
          by: importedBy ?? "import",
        });
        summary.translationsSeeded++;
      } else if (importedText) {
        summary.translationsSkipped++;
      }
    }
  }

  if (translationCreates.length > 0) {
    await prisma.translation.createMany({ data: translationCreates, skipDuplicates: true });
  }
  for (const u of blankFillUpdates) {
    await prisma.translation.update({ where: { id: u.id }, data: { text: u.text, status: "draft" } });
  }
  if (historyCreates.length > 0) {
    await prisma.translationHistory.createMany({ data: historyCreates });
  }

  return NextResponse.json({ summary });
}

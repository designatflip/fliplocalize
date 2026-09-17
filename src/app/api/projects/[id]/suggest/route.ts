import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommHubData, matchGlossaryTerms, type CommHubBrandConstant } from "@/lib/commHub";
import { suggestTranslation } from "@/lib/claude";
import { resolveAdaptationRules, matchProjectGlossaryTerms } from "@/lib/translationContext";
import { mapWithConcurrency } from "@/lib/concurrency";

export const maxDuration = 60;

const CONCURRENCY = 4;
const MAX_ERRORS = 20;
// Concurrency 4, ~8-10s worst case per Claude call -> ~4-5 waves per batch, leaving headroom
// under maxDuration for DB/Comm-Hub overhead. Keeps each invocation well clear of a serverless timeout.
const BATCH_SIZE = 15;

function candidateWhere(projectId: string, locale: string) {
  return {
    locale,
    status: "untranslated",
    text: "",
    stringKey: { projectId, removedAt: null },
  } as const;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { locale, limit } = (await req.json().catch(() => ({}))) as { locale?: string; limit?: number };
  if (!locale) {
    return NextResponse.json({ error: "locale is required" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set. Add it to .env and restart the dev server to use AI suggestions." },
      { status: 400 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { adaptationRules: true, glossaryTerms: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const targetLocales = project.targetLocales.split(",").map((s) => s.trim()).filter(Boolean);
  if (!targetLocales.includes(locale)) {
    return NextResponse.json({ error: `${locale} is not a target locale for this project` }, { status: 400 });
  }

  const take = Math.min(Math.max(1, limit ?? BATCH_SIZE), BATCH_SIZE);
  const candidates = await prisma.translation.findMany({
    where: candidateWhere(project.id, locale),
    include: { stringKey: true },
    orderBy: { stringKey: { key: "asc" } },
    take,
  });

  const batch = { attempted: candidates.length, suggested: 0, failed: 0 };
  const errors: string[] = [];

  if (candidates.length > 0) {
    const { data: commHub } = await getCommHubData(); // fetched once per batch
    const brandConstants = (commHub.tone[0]?.brandConstants ?? []) as CommHubBrandConstant[];
    const adaptationRules = resolveAdaptationRules(project.adaptationRules, locale);

    await mapWithConcurrency(candidates, CONCURRENCY, async (translation) => {
      const key = translation.stringKey;
      try {
        const matchedGlossary = matchGlossaryTerms(key.sourceText, key.referenceText, commHub.glossary);
        const projectGlossaryTerms = matchProjectGlossaryTerms(key.sourceText, locale, project.glossaryTerms);

        const suggestion = await suggestTranslation({
          sourceLocale: project.sourceLocale,
          targetLocale: locale,
          sourceText: key.sourceText,
          referenceText: key.referenceText,
          notes: key.notes,
          screen: key.screen,
          component: key.component,
          charLimit: key.charLimit,
          placeholders: key.placeholders ? JSON.parse(key.placeholders) : [],
          matchedGlossary,
          mechanics: commHub.mechanics,
          brandConstants,
          projectGlossaryTerms,
          adaptationRules,
        });

        // Re-check right before writing: guards against a human editing this exact
        // row via the UI while this item's Claude call was in flight.
        const fresh = await prisma.translation.findUnique({ where: { id: translation.id } });
        if (!fresh || fresh.status !== "untranslated" || fresh.text.trim() !== "") {
          if (errors.length < MAX_ERRORS) errors.push(`${key.key}: skipped — changed during the run`);
          return;
        }

        await prisma.translation.update({
          where: { id: translation.id },
          data: {
            text: suggestion.text,
            status: "draft",
            aiGenerated: true,
            aiModel: suggestion.model,
            history: { create: [{ text: suggestion.text, by: `claude (${suggestion.model})` }] },
          },
        });
        batch.suggested++;
      } catch (err) {
        batch.failed++;
        if (errors.length < MAX_ERRORS) {
          errors.push(`${key.key}: ${err instanceof Error ? err.message : "failed"}`);
        }
      }
    });
  }

  const remaining = await prisma.translation.count({ where: candidateWhere(project.id, locale) });

  return NextResponse.json({ batch, remaining, errors });
}

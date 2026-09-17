import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeTranslation } from "@/lib/serialize";
import { getCommHubData, matchGlossaryTerms, type CommHubBrandConstant } from "@/lib/commHub";
import { MissingApiKeyError, suggestTranslation } from "@/lib/claude";
import { resolveAdaptationRules, matchProjectGlossaryTerms } from "@/lib/translationContext";

export const maxDuration = 45;

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const translation = await prisma.translation.findUnique({
    where: { id: params.id },
    include: {
      stringKey: {
        include: { project: { include: { adaptationRules: true, glossaryTerms: true } } },
      },
    },
  });
  if (!translation) return NextResponse.json({ error: "Translation not found" }, { status: 404 });
  if (translation.status === "approved" || translation.status === "exported") {
    return NextResponse.json(
      {
        error: `This translation is already ${translation.status} — change its status before generating a new AI suggestion.`,
      },
      { status: 409 }
    );
  }

  const { stringKey } = translation;
  const { project } = stringKey;

  try {
    const { data: commHub } = await getCommHubData();
    const matchedGlossary = matchGlossaryTerms(stringKey.sourceText, stringKey.referenceText, commHub.glossary);
    const brandConstants = (commHub.tone[0]?.brandConstants ?? []) as CommHubBrandConstant[];
    const adaptationRules = resolveAdaptationRules(project.adaptationRules, translation.locale);
    const projectGlossaryTerms = matchProjectGlossaryTerms(
      stringKey.sourceText,
      translation.locale,
      project.glossaryTerms
    );

    const suggestion = await suggestTranslation({
      sourceLocale: project.sourceLocale,
      targetLocale: translation.locale,
      sourceText: stringKey.sourceText,
      referenceText: stringKey.referenceText,
      notes: stringKey.notes,
      screen: stringKey.screen,
      component: stringKey.component,
      charLimit: stringKey.charLimit,
      placeholders: stringKey.placeholders ? JSON.parse(stringKey.placeholders) : [],
      matchedGlossary,
      mechanics: commHub.mechanics,
      brandConstants,
      projectGlossaryTerms,
      adaptationRules,
    });

    const updated = await prisma.translation.update({
      where: { id: translation.id },
      data: {
        text: suggestion.text,
        status: "draft",
        aiGenerated: true,
        aiModel: suggestion.model,
        history: { create: [{ text: suggestion.text, by: `claude (${suggestion.model})` }] },
      },
      include: { history: true, comments: true },
    });

    return NextResponse.json({ translation: serializeTranslation(updated) });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[suggest] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI suggestion failed" },
      { status: 502 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { locale, by } = (await req.json().catch(() => ({}))) as { locale?: string; by?: string };

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const targetLocales = project.targetLocales.split(",").map((s) => s.trim()).filter(Boolean);
  if (locale && !targetLocales.includes(locale)) {
    return NextResponse.json({ error: `${locale} is not a target locale for this project` }, { status: 400 });
  }

  // Anything that isn't already a pristine empty/untranslated row.
  const where = {
    stringKey: { projectId: project.id },
    ...(locale ? { locale } : {}),
    NOT: { text: "", status: "untranslated" },
  };

  // Record the clearing in each row's history (only rows that actually had text).
  const withText = await prisma.translation.findMany({
    where: { ...where, NOT: { text: "" } },
    select: { id: true },
  });
  if (withText.length > 0) {
    await prisma.translationHistory.createMany({
      data: withText.map((t) => ({ translationId: t.id, text: "", by: `${by ?? "user"} (reset)` })),
    });
  }

  const result = await prisma.translation.updateMany({
    where,
    data: {
      text: "",
      status: "untranslated",
      aiGenerated: false,
      aiModel: null,
      translator: null,
      reviewer: null,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({ reset: result.count });
}

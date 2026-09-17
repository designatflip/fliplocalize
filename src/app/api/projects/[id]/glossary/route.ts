import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeGlossaryTerm } from "@/lib/serialize";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { term, locale, approvedTranslation, notes } = body as {
    term?: string;
    locale?: string;
    approvedTranslation?: string;
    notes?: string;
  };

  if (!term?.trim() || !locale?.trim() || !approvedTranslation?.trim()) {
    return NextResponse.json(
      { error: "term, locale, and approvedTranslation are required" },
      { status: 400 }
    );
  }

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const created = await prisma.glossaryTerm.create({
    data: {
      projectId: project.id,
      term: term.trim(),
      locale: locale.trim(),
      approvedTranslation: approvedTranslation.trim(),
      notes: notes?.trim() || null,
    },
  });

  return NextResponse.json(serializeGlossaryTerm(created), { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeAdaptationRule } from "@/lib/serialize";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { dimension, values } = body as { dimension?: string; values?: Record<string, string> };

  if (!dimension?.trim() || !values || typeof values !== "object") {
    return NextResponse.json({ error: "dimension and values are required" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const count = await prisma.adaptationRule.count({ where: { projectId: project.id } });

  const rule = await prisma.adaptationRule.create({
    data: {
      projectId: project.id,
      localeGroup: project.localeGroup ?? "default",
      dimension: dimension.trim(),
      valuesJson: JSON.stringify(values),
      sortOrder: count,
    },
  });

  return NextResponse.json(serializeAdaptationRule(rule), { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeProject } from "@/lib/serialize";

const FULL_INCLUDE = {
  keys: {
    orderBy: { key: "asc" as const },
    include: {
      translations: {
        include: {
          history: true,
          comments: true,
        },
      },
    },
  },
  adaptationRules: true,
  glossaryTerms: true,
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: FULL_INCLUDE,
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(serializeProject(project));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.project.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ProjectSummaryDTO } from "@/lib/types";

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { keys: true } } },
  });

  const dto: ProjectSummaryDTO[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    sourceLocale: p.sourceLocale,
    targetLocales: p.targetLocales.split(",").map((s) => s.trim()).filter(Boolean),
    localeGroup: p.localeGroup,
    createdAt: p.createdAt.toISOString(),
    keyCount: p._count.keys,
  }));

  return NextResponse.json(dto);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, sourceLocale, targetLocales, localeGroup } = body as {
    name?: string;
    sourceLocale?: string;
    targetLocales?: string[];
    localeGroup?: string | null;
  };

  if (!name?.trim() || !sourceLocale?.trim() || !targetLocales?.length) {
    return NextResponse.json(
      { error: "name, sourceLocale, and at least one target locale are required" },
      { status: 400 }
    );
  }

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      sourceLocale: sourceLocale.trim(),
      targetLocales: targetLocales.map((l) => l.trim()).filter(Boolean).join(","),
      localeGroup: localeGroup?.trim() || null,
    },
  });

  return NextResponse.json({ id: project.id }, { status: 201 });
}

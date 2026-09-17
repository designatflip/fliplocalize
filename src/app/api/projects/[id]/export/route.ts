import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function setNested(obj: Record<string, unknown>, key: string, value: string) {
  const parts = key.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof cur[part] !== "object" || cur[part] === null || Array.isArray(cur[part])) {
      cur[part] = {};
    }
    cur = cur[part] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const locale = searchParams.get("locale");
  const mode = searchParams.get("mode") === "all" ? "all" : "approved"; // "approved" | "all"

  if (!locale) {
    return NextResponse.json({ error: "locale query param is required" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      keys: {
        where: { removedAt: null },
        include: { translations: { where: { locale } } },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const output: Record<string, unknown> = {};
  const includedTranslationIds: string[] = [];

  for (const k of project.keys) {
    const translation = k.translations[0];
    if (!translation) continue;

    if (mode === "approved") {
      if (translation.status !== "approved" && translation.status !== "exported") continue;
      includedTranslationIds.push(translation.id);
    }

    setNested(output, k.key, translation.text);
  }

  if (mode === "approved" && includedTranslationIds.length) {
    await prisma.translation.updateMany({
      where: { id: { in: includedTranslationIds }, status: "approved" },
      data: { status: "exported" },
    });
  }

  return NextResponse.json(output, {
    headers: {
      "Content-Disposition": `attachment; filename="${locale}.json"`,
    },
  });
}

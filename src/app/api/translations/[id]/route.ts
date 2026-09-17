import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeTranslation } from "@/lib/serialize";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { text, status, by, reviewer } = body as {
    text?: string;
    status?: string;
    by?: string;
    reviewer?: string | null;
  };

  const existing = await prisma.translation.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Translation not found" }, { status: 404 });

  const textChanged = text !== undefined && text !== existing.text;

  const updated = await prisma.translation.update({
    where: { id: params.id },
    data: {
      ...(text !== undefined ? { text } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(by !== undefined ? { translator: by } : {}),
      ...(reviewer !== undefined ? { reviewer } : {}),
      ...(textChanged ? { aiGenerated: false, aiModel: null } : {}),
      ...(textChanged
        ? { history: { create: [{ text: text as string, by: by ?? null }] } }
        : {}),
    },
    include: { history: true, comments: true },
  });

  return NextResponse.json(serializeTranslation(updated));
}

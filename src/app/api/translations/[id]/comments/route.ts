import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeComment } from "@/lib/serialize";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { text, author } = body as { text?: string; author?: string | null };

  if (!text?.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: {
      translationId: params.id,
      text: text.trim(),
      author: author?.trim() || null,
    },
  });

  return NextResponse.json(serializeComment(comment), { status: 201 });
}

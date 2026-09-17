import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeKey } from "@/lib/serialize";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { referenceText, screen, component, notes, charLimit, placeholders } = body as {
    referenceText?: string | null;
    screen?: string | null;
    component?: string | null;
    notes?: string | null;
    charLimit?: number | null;
    placeholders?: string[];
  };

  const key = await prisma.stringKeyEntry.update({
    where: { id: params.id },
    data: {
      ...(referenceText !== undefined ? { referenceText } : {}),
      ...(screen !== undefined ? { screen } : {}),
      ...(component !== undefined ? { component } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(charLimit !== undefined ? { charLimit } : {}),
      ...(placeholders !== undefined ? { placeholders: JSON.stringify(placeholders) } : {}),
    },
    include: { translations: { include: { history: true, comments: true } } },
  });

  return NextResponse.json(serializeKey(key));
}

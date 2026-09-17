import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeAdaptationRule } from "@/lib/serialize";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { dimension, values } = body as { dimension?: string; values?: Record<string, string> };

  const rule = await prisma.adaptationRule.update({
    where: { id: params.id },
    data: {
      ...(dimension !== undefined ? { dimension } : {}),
      ...(values !== undefined ? { valuesJson: JSON.stringify(values) } : {}),
    },
  });

  return NextResponse.json(serializeAdaptationRule(rule));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.adaptationRule.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

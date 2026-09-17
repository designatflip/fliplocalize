import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ADAPTATION_RULES: { dimension: string; values: Record<string, string> }[] = [
  { dimension: "Currency", values: { "en-MY": "MYR / RM", "en-PH": "PHP / ₱" } },
  {
    dimension: "Common payment rails",
    values: { "en-MY": "DuitNow, FPX", "en-PH": "GCash, InstaPay, PayMaya" },
  },
  {
    dimension: "Regulator (if referenced in copy)",
    values: { "en-MY": "Bank Negara Malaysia (BNM)", "en-PH": "Bangko Sentral ng Pilipinas (BSP)" },
  },
  {
    dimension: "Spelling convention",
    values: {
      "en-MY": 'British-leaning ("colour", "authorise")',
      "en-PH": 'American-leaning ("color", "authorize")',
    },
  },
  {
    dimension: "Formality",
    values: { "en-MY": "— to confirm with in-market reviewer", "en-PH": "— to confirm with in-market reviewer" },
  },
];

const SAMPLE_KEYS = [
  {
    key: "payment.confirm_button",
    sourceText: "Konfirmasi pembayaran",
    referenceText: "Confirm payment",
    screen: "Payment Review",
    component: "primary_button",
    notes: "Appears after user reviews amount + recipient",
    charLimit: 20,
    placeholders: ["{{amount}}"],
  },
  {
    key: "payment.cancel_button",
    sourceText: "Batalkan",
    referenceText: "Cancel",
    screen: "Payment Review",
    component: "secondary_button",
    notes: null,
    charLimit: 20,
    placeholders: [],
  },
  {
    key: "payment.insufficient_balance",
    sourceText: "Saldo tidak mencukupi",
    referenceText: "Insufficient balance",
    screen: "Payment Review",
    component: "error_banner",
    notes: "Shown when wallet balance is less than the payment amount",
    charLimit: 40,
    placeholders: [],
  },
  {
    key: "payment.success_title",
    sourceText: "Pembayaran berhasil",
    referenceText: "Payment successful",
    screen: "Payment Success",
    component: "title",
    notes: null,
    charLimit: 30,
    placeholders: [],
  },
];

async function main() {
  const existing = await prisma.project.findFirst({
    where: { name: "ID → MY/PH — Payment Flow" },
  });
  if (existing) {
    console.log("Seed project already exists, skipping.");
    return;
  }

  const project = await prisma.project.create({
    data: {
      name: "ID → MY/PH — Payment Flow",
      sourceLocale: "id-ID",
      targetLocales: "en-MY,en-PH",
      localeGroup: "en-variants",
    },
  });

  for (let i = 0; i < ADAPTATION_RULES.length; i++) {
    const r = ADAPTATION_RULES[i];
    await prisma.adaptationRule.create({
      data: {
        projectId: project.id,
        localeGroup: "en-variants",
        dimension: r.dimension,
        valuesJson: JSON.stringify(r.values),
        sortOrder: i,
      },
    });
  }

  for (const k of SAMPLE_KEYS) {
    await prisma.stringKeyEntry.create({
      data: {
        projectId: project.id,
        key: k.key,
        sourceText: k.sourceText,
        referenceText: k.referenceText,
        screen: k.screen,
        component: k.component,
        notes: k.notes,
        charLimit: k.charLimit,
        placeholders: JSON.stringify(k.placeholders),
        changeStatus: "new",
        translations: {
          create: [
            { locale: "en-MY", text: "", status: "untranslated" },
            { locale: "en-PH", text: "", status: "untranslated" },
          ],
        },
      },
    });
  }

  console.log(`Seeded project ${project.id} with ${SAMPLE_KEYS.length} keys.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

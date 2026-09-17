import type { AdaptationRule, GlossaryTerm } from "@prisma/client";

export function resolveAdaptationRules(
  rules: AdaptationRule[],
  locale: string
): { dimension: string; value: string }[] {
  return rules
    .map((r) => {
      const values = JSON.parse(r.valuesJson) as Record<string, string>;
      return { dimension: r.dimension, value: values[locale] };
    })
    .filter((r): r is { dimension: string; value: string } => Boolean(r.value));
}

export function matchProjectGlossaryTerms(
  sourceText: string,
  locale: string,
  terms: GlossaryTerm[]
): { term: string; approvedTranslation: string; notes: string | null }[] {
  const haystack = sourceText.toLowerCase();
  return terms
    .filter((g) => g.locale === locale && haystack.includes(g.term.toLowerCase()))
    .map((g) => ({ term: g.term, approvedTranslation: g.approvedTranslation, notes: g.notes }));
}

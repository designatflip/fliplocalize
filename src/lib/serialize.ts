import type {
  AdaptationRule,
  Comment,
  GlossaryTerm,
  Project,
  StringKeyEntry,
  Translation,
  TranslationHistory,
} from "@prisma/client";
import type {
  AdaptationRuleDTO,
  CommentDTO,
  GlossaryTermDTO,
  HistoryDTO,
  ProjectDTO,
  StringKeyDTO,
  TranslationDTO,
  TranslationStatus,
} from "./types";

type FullTranslation = Translation & {
  history: TranslationHistory[];
  comments: Comment[];
};
type FullKey = StringKeyEntry & { translations: FullTranslation[] };
type FullProject = Project & {
  keys: FullKey[];
  adaptationRules: AdaptationRule[];
  glossaryTerms: GlossaryTerm[];
};

export function serializeHistory(h: TranslationHistory): HistoryDTO {
  return { id: h.id, text: h.text, by: h.by, at: h.at.toISOString() };
}

export function serializeComment(c: Comment): CommentDTO {
  return {
    id: c.id,
    author: c.author,
    text: c.text,
    createdAt: c.createdAt.toISOString(),
  };
}

export function serializeTranslation(t: FullTranslation): TranslationDTO {
  return {
    id: t.id,
    locale: t.locale,
    text: t.text,
    status: t.status as TranslationStatus,
    translator: t.translator,
    reviewer: t.reviewer,
    aiGenerated: t.aiGenerated,
    aiModel: t.aiModel,
    updatedAt: t.updatedAt.toISOString(),
    history: [...t.history]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .map(serializeHistory),
    comments: [...t.comments]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(serializeComment),
  };
}

export function serializeKey(k: FullKey): StringKeyDTO {
  return {
    id: k.id,
    key: k.key,
    sourceText: k.sourceText,
    referenceText: k.referenceText,
    screen: k.screen,
    component: k.component,
    notes: k.notes,
    charLimit: k.charLimit,
    placeholders: k.placeholders ? JSON.parse(k.placeholders) : [],
    changeStatus: k.changeStatus as StringKeyDTO["changeStatus"],
    lastChangedAt: k.lastChangedAt.toISOString(),
    removedAt: k.removedAt ? k.removedAt.toISOString() : null,
    translations: k.translations.map(serializeTranslation),
  };
}

export function serializeAdaptationRule(r: AdaptationRule): AdaptationRuleDTO {
  return {
    id: r.id,
    dimension: r.dimension,
    values: JSON.parse(r.valuesJson),
    sortOrder: r.sortOrder,
  };
}

export function serializeGlossaryTerm(g: GlossaryTerm): GlossaryTermDTO {
  return {
    id: g.id,
    term: g.term,
    locale: g.locale,
    approvedTranslation: g.approvedTranslation,
    notes: g.notes,
  };
}

export function serializeProject(p: FullProject): ProjectDTO {
  return {
    id: p.id,
    name: p.name,
    sourceLocale: p.sourceLocale,
    targetLocales: p.targetLocales.split(",").map((s) => s.trim()).filter(Boolean),
    localeGroup: p.localeGroup,
    createdAt: p.createdAt.toISOString(),
    keys: p.keys.map(serializeKey),
    adaptationRules: [...p.adaptationRules]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(serializeAdaptationRule),
    glossaryTerms: p.glossaryTerms.map(serializeGlossaryTerm),
  };
}

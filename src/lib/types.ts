export type TranslationStatus =
  | "untranslated"
  | "draft"
  | "in_review"
  | "approved"
  | "exported";

export const STATUS_ORDER: TranslationStatus[] = [
  "untranslated",
  "draft",
  "in_review",
  "approved",
  "exported",
];

export const STATUS_LABEL: Record<TranslationStatus, string> = {
  untranslated: "Untranslated",
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  exported: "Exported",
};

export type ChangeStatus = "new" | "changed" | "unchanged" | "removed";

export interface CommentDTO {
  id: string;
  author: string | null;
  text: string;
  createdAt: string;
}

export interface HistoryDTO {
  id: string;
  text: string;
  by: string | null;
  at: string;
}

export interface TranslationDTO {
  id: string;
  locale: string;
  text: string;
  status: TranslationStatus;
  translator: string | null;
  reviewer: string | null;
  aiGenerated: boolean;
  aiModel: string | null;
  updatedAt: string;
  history: HistoryDTO[];
  comments: CommentDTO[];
}

export interface StringKeyDTO {
  id: string;
  key: string;
  sourceText: string;
  referenceText: string | null;
  screen: string | null;
  component: string | null;
  notes: string | null;
  charLimit: number | null;
  placeholders: string[];
  changeStatus: ChangeStatus;
  lastChangedAt: string;
  removedAt: string | null;
  translations: TranslationDTO[];
}

export interface AdaptationRuleDTO {
  id: string;
  dimension: string;
  values: Record<string, string>;
  sortOrder: number;
}

export interface GlossaryTermDTO {
  id: string;
  term: string;
  locale: string;
  approvedTranslation: string;
  notes: string | null;
}

export interface ProjectDTO {
  id: string;
  name: string;
  sourceLocale: string;
  targetLocales: string[];
  localeGroup: string | null;
  createdAt: string;
  keys: StringKeyDTO[];
  adaptationRules: AdaptationRuleDTO[];
  glossaryTerms: GlossaryTermDTO[];
}

export interface ProjectSummaryDTO {
  id: string;
  name: string;
  sourceLocale: string;
  targetLocales: string[];
  localeGroup: string | null;
  createdAt: string;
  keyCount: number;
}

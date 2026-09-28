import type { CommHubBrandConstant, CommHubGlossaryTerm, CommHubMechanic } from "./commHub";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5";

export class MissingApiKeyError extends Error {}

export interface SuggestTranslationInput {
  sourceLocale: string;
  targetLocale: string;
  sourceText: string;
  referenceText: string | null;
  notes: string | null;
  screen: string | null;
  component: string | null;
  charLimit: number | null;
  placeholders: string[];
  matchedGlossary: CommHubGlossaryTerm[];
  mechanics: CommHubMechanic[];
  brandConstants: CommHubBrandConstant[];
  projectGlossaryTerms: { term: string; approvedTranslation: string; notes: string | null }[];
  adaptationRules: { dimension: string; value: string }[];
}

export interface SuggestTranslationResult {
  text: string;
  model: string;
}

function formatExampleItem(item: unknown): string | null {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const obj = item as { type?: string; content?: string; url?: string };
    if (obj.type === "image") return null; // no useful text signal for a prompt
    if (typeof obj.content === "string") return obj.content;
  }
  return null;
}

function formatMechanics(mechanics: CommHubMechanic[]): string {
  const lines: string[] = [];
  for (const m of mechanics) {
    if (m.data?.kind === "repeater") {
      for (const rule of m.data.rules) {
        const doEx = rule.doExamples.map(formatExampleItem).filter(Boolean)[0];
        const dontEx = rule.dontExamples.map(formatExampleItem).filter(Boolean)[0];
        let line = `- **${m.rule}**: ${rule.ruleText}`;
        if (doEx) line += `  [Do: "${doEx}"]`;
        if (dontEx) line += ` [Don't: "${dontEx}"]`;
        lines.push(line);
      }
    } else if (m.data?.kind === "capitalization") {
      const applies = [...m.data.textComponents, ...m.data.uiComponents].filter(Boolean).join(", ");
      lines.push(`- **${m.rule}**${applies ? ` — applies to: ${applies}` : ""}`);
    } else {
      let line = `- **${m.rule}**${m.description ? `: ${m.description}` : ""}`;
      if (m.example) line += `  [Do: "${m.example}"]`;
      if (m.dont_example) line += ` [Don't: "${m.dont_example}"]`;
      lines.push(line);
    }
  }
  return lines.join("\n");
}

function formatGlossary(terms: CommHubGlossaryTerm[]): string {
  return terms
    .map((g) => {
      const avoid = g.avoid && g.avoid.length ? ` _Avoid:_ ${g.avoid.join(", ")}` : "";
      const def = g.definition ? ` — ${g.definition}` : "";
      return `- **${g.term_bahasa}** → **${g.term}**${def}${avoid}`;
    })
    .join("\n");
}

function formatBrandConstants(constants: CommHubBrandConstant[]): string {
  return constants.map((c) => `- **${c.constant} — ${c.heading}**: ${c.description}`).join("\n");
}

function buildSystemPrompt(input: SuggestTranslationInput): string {
  const sections: string[] = [
    `# Flip Localization Assistant`,
    ``,
    `You are a professional translator producing a first-draft localization for Flip, a financial technology company. Translate from ${input.sourceLocale} into ${input.targetLocale}. A human UX writer will review and may edit this draft before it ships — prioritize accuracy, Flip's approved terminology, and natural target-language phrasing over creative flourish.`,
    ``,
    `## Output format`,
    `Respond with ONLY the translated string. No preamble, no explanation, no surrounding quotes, no markdown.`,
  ];

  if (input.mechanics.length) {
    sections.push(``, `## Mechanics`, formatMechanics(input.mechanics));
  }
  if (input.brandConstants.length) {
    sections.push(``, `## Brand voice (Fair / Friendly / Smart)`, formatBrandConstants(input.brandConstants));
  }
  if (input.matchedGlossary.length) {
    sections.push(``, `## Approved glossary terms found in this string`, formatGlossary(input.matchedGlossary));
  }
  if (input.projectGlossaryTerms.length) {
    sections.push(
      ``,
      `## This project's own translation memory (${input.targetLocale})`,
      input.projectGlossaryTerms
        .map((t) => `- ${t.term} → ${t.approvedTranslation}${t.notes ? ` (${t.notes})` : ""}`)
        .join("\n")
    );
  }
  if (input.adaptationRules.length) {
    sections.push(
      ``,
      `## Locale adaptation for ${input.targetLocale}`,
      input.adaptationRules.map((r) => `- ${r.dimension}: ${r.value}`).join("\n")
    );
  }

  return sections.join("\n");
}

function buildUserPrompt(input: SuggestTranslationInput): string {
  const lines: string[] = [`Source text (${input.sourceLocale}): "${input.sourceText}"`];

  if (input.referenceText) lines.push(``, `Existing English reference: "${input.referenceText}"`);

  const contextParts = [input.screen, input.component].filter(Boolean).join(" / ");
  if (contextParts) lines.push(``, `Context: appears on ${contextParts}`);
  if (input.notes) lines.push(`Notes: ${input.notes}`);
  if (input.charLimit != null) {
    lines.push(`Character limit: ${input.charLimit} — keep the translation within this limit if at all possible.`);
  }
  if (input.placeholders.length) {
    lines.push(`Preserve these placeholders exactly as written, do not translate them: ${input.placeholders.join(", ")}`);
  }

  lines.push(``, `Translate this string into ${input.targetLocale}.`);
  return lines.join("\n");
}

function stripWrappingQuotes(text: string): string {
  const trimmed = text.trim();
  const pairs: [string, string][] = [
    ['"', '"'],
    ["'", "'"],
    ["“", "”"],
    ["‘", "’"],
  ];
  for (const [open, close] of pairs) {
    if (trimmed.startsWith(open) && trimmed.endsWith(close) && trimmed.length > 1) {
      return trimmed.slice(open.length, trimmed.length - close.length).trim();
    }
  }
  return trimmed;
}

export async function suggestTranslation(input: SuggestTranslationInput): Promise<SuggestTranslationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new MissingApiKeyError(
      "ANTHROPIC_API_KEY is not set. Add it to .env and restart the dev server to use AI suggestions."
    );
  }
  const model = process.env.CLAUDE_MODEL || DEFAULT_MODEL;

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      // Thinking is on by default; a small cap let it consume the whole budget on some strings,
      // leaving no room for the translation itself (stop_reason: max_tokens, no text block).
      max_tokens: 4096,
      output_config: { effort: "low" },
      system: [{ type: "text", text: buildSystemPrompt(input), cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildUserPrompt(input) }],
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Anthropic API error (${res.status})`);
  }

  const data = await res.json();
  const textBlock = (data.content as { type: string; text?: string }[] | undefined)?.find(
    (b) => b.type === "text" && b.text?.trim()
  );
  const raw = textBlock?.text?.trim();
  if (!raw) {
    const blockTypes = (data.content ?? []).map((b: { type: string }) => b.type).join(", ") || "none";
    throw new Error(
      `Claude returned no text (stop_reason: ${data.stop_reason ?? "unknown"}, content blocks: ${blockTypes})`
    );
  }

  return { text: stripWrappingQuotes(raw), model };
}
